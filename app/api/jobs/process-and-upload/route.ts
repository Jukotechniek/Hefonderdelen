import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import type { FileObject } from '@supabase/storage-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL of anon key niet geconfigureerd. Zet NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY in je .env bestand.'
  );
}

async function runPythonBackgroundRemoval(inputPath: string, outputPath: string) {
  const scriptPath = path.join(process.cwd(), 'scripts', 'remove_bg.py');
  const pythonCmd = process.env.PYTHON || 'python';

  await new Promise<void>((resolve, reject) => {
    const child = spawn(pythonCmd, [scriptPath, inputPath, outputPath]);

    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Python script exited with code ${code}. stderr: ${stderr}`));
      }
    });
  });
}

async function processAndUploadJob(
  authHeader: string | null,
  productId: string,
  productName: string,
  description: string,
  files: File[]
) {
  const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    global: {
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    },
    auth: {
      persistSession: false
    }
  });

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hefonderdelen-job-'));

  try {
    const articleNumber = `TVH/${productId}`;
    const folderPrefix = `tvh-${productId}/`;

    // Bestaand aantal afbeeldingen bepalen voor nummering
    const { data: existingFiles, error: listError } = await supabase.storage
      .from('product-images')
      .list(folderPrefix, {
        limit: 100,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (listError) {
      console.error('Error listing existing files:', listError);
    }

    const existingCount =
      (existingFiles as FileObject[] | null)?.filter((f) =>
        f.name.match(/\.(jpg|jpeg|png|webp)$/i)
      ).length ?? 0;

    let index = existingCount + 1;

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const inputPath = path.join(tmpDir, `in-${index}`);
      const outputPath = path.join(tmpDir, `out-${index}.jpg`);

      await fs.writeFile(inputPath, Buffer.from(arrayBuffer));

      // Probeer het Python-script meerdere keren per bestand zodat
      // incidentele fouten niet de hele job stoppen.
      const maxRetries = 2;
      let success = false;

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          await runPythonBackgroundRemoval(inputPath, outputPath);
          success = true;
          break;
        } catch (err) {
          console.error(
            `Python processing failed for tvh-${productId}-${index} (attempt ${attempt}):`,
            err
          );

          if (attempt > maxRetries) {
            console.error(
              `Giving up on tvh-${productId}-${index} after ${attempt} attempts, skipping this image.`
            );
          } else {
            // Kleine pauze tussen pogingen om piekproblemen (bv. geheugen) de kans
            // te geven om te herstellen.
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }

      if (!success) {
        // Ga door met volgende bestand in plaats van de hele job te stoppen.
        index += 1;
        continue;
      }

      const outputBuffer = await fs.readFile(outputPath);

      const fileName = `${folderPrefix}tvh-${productId}-${index}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, outputBuffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) {
        console.error('Error uploading processed image:', uploadError);
      } else {
        console.log(`Processed image uploaded: ${fileName}`);
      }

      index += 1;
    }

    // Productnaam + beschrijving opslaan/aanmaken
    if (productName.trim().length > 0 || description.trim().length > 0) {
      const { data: existingProduct, error: searchError } = await supabase
        .from('products')
        .select('id, article_number')
        .eq('article_number', articleNumber)
        .maybeSingle();

      if (searchError) {
        console.error('Error searching for product:', searchError);
        return;
      }

      const productNameToSave =
        productName && productName.trim() ? productName.trim() : `TVH ${productId}`;

      if (existingProduct) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            product_name: productNameToSave,
            shopify_description: description.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('article_number', articleNumber);

        if (updateError) {
          console.error('Error updating product:', updateError);
        } else {
          console.log('Product updated in background job:', productId);
        }
      } else {
        const { error: insertError } = await supabase.from('products').insert({
          article_number: articleNumber,
          product_name: productNameToSave,
          shopify_description: description.trim() || null
        });

        if (insertError) {
          console.error('Error inserting product:', insertError);
        } else {
          console.log('Product inserted in background job:', productId);
        }
      }
    }
  } catch (error) {
    console.error('Background job failed:', error);
  } finally {
    try {
      const files = await fs.readdir(tmpDir);
      await Promise.all(files.map((f) => fs.unlink(path.join(tmpDir, f))));
      await fs.rmdir(tmpDir);
    } catch (cleanupError) {
      console.error('Error cleaning up temp dir:', cleanupError);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');

    const formData = await req.formData();

    const productId = (formData.get('productId') || '').toString().trim();
    const productName = (formData.get('productName') || '').toString();
    const description = (formData.get('description') || '').toString();

    const files = formData.getAll('images').filter((f): f is File => f instanceof File);

    if (!productId) {
      return NextResponse.json({ error: 'productId ontbreekt' }, { status: 400 });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'Geen afbeeldingen ontvangen' }, { status: 400 });
    }

    // Fire-and-forget background job met dezelfde Supabase-user als de frontend
    (async () => {
      await processAndUploadJob(authHeader, productId, productName, description, files);
    })().catch((err) => {
      console.error('Failed to start background job:', err);
    });

    return NextResponse.json({ status: 'queued' }, { status: 202 });
  } catch (error: any) {
    console.error('Job route error:', error);

    return NextResponse.json(
      {
        error: 'Fout bij starten van verwerkingsjob',
        details: error?.message || 'Onbekende fout'
      },
      { status: 500 }
    );
  }
}

