import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { kickPhotoProcessingQueue } from '../../../../lib/photo-processing-queue';
import { createServerSupabaseClient } from '../../../../lib/server-supabase';

export const runtime = 'nodejs';

const PHOTO_BUCKET = 'product-images';

type ReservedPhotoJob = {
  id: string;
  sequence_number: number;
  original_filename: string;
  mime_type: string | null;
};

function getExtensionFromMimeType(mimeType: string) {
  if (mimeType === 'image/png') {
    return '.png';
  }

  if (mimeType === 'image/webp') {
    return '.webp';
  }

  return '.jpg';
}

function getSafeOriginalExtension(file: File) {
  const originalExtension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';

  if (originalExtension === '.jpg' || originalExtension === '.jpeg' || originalExtension === '.png' || originalExtension === '.webp') {
    return originalExtension;
  }

  return getExtensionFromMimeType(file.type);
}

async function upsertProduct(
  productId: string,
  productName: string,
  description: string,
  authHeader: string | null
) {
  const supabase = createServerSupabaseClient({ authHeader });
  const articleNumber = `TVH/${productId}`;
  const productNameToSave = productName.trim() ? productName.trim() : `TVH ${productId}`;

  const { error } = await supabase.from('products').upsert(
    {
      article_number: articleNumber,
      product_name: productNameToSave,
      shopify_description: description.trim() || null,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: 'article_number'
    }
  );

  if (error) {
    throw new Error(`Product kon niet worden opgeslagen: ${error.message}`);
  }
}

export async function POST(req: NextRequest) {
  const uploadedOriginalPaths: string[] = [];
  let batchId: string | null = null;
  const authHeader = req.headers.get('authorization');

  try {
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

    const supabase = createServerSupabaseClient({ authHeader });
    const articleNumber = `TVH/${productId}`;

    await upsertProduct(productId, productName, description, authHeader);

    batchId = randomUUID();
    const reservePayload = files.map((file, index) => ({
      original_filename: file.name || `image-${index + 1}${getSafeOriginalExtension(file)}`,
      mime_type: file.type || null
    }));

    const { data: reservedJobs, error: reserveError } = await supabase.rpc('reserve_photo_processing_jobs', {
      p_batch_id: batchId,
      p_product_id: productId,
      p_article_number: articleNumber,
      p_product_name: productName.trim() ? productName.trim() : `TVH ${productId}`,
      p_description: description.trim() || null,
      p_files: reservePayload
    });

    if (reserveError || !reservedJobs || reservedJobs.length !== files.length) {
      throw new Error(
        reserveError?.message || 'Kon geen wachtrij-records reserveren voor alle foto\'s.'
      );
    }

    for (const [index, file] of files.entries()) {
      const reservedJob = reservedJobs[index] as ReservedPhotoJob;
      const originalStoragePath = `_queue/originals/tvh-${productId}/${batchId}/${reservedJob.id}${getSafeOriginalExtension(file)}`;
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(
        originalStoragePath,
        fileBuffer,
        {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || reservedJob.mime_type || 'application/octet-stream'
        }
      );

      if (uploadError) {
        throw new Error(`Originele foto kon niet worden opgeslagen: ${uploadError.message}`);
      }

      uploadedOriginalPaths.push(originalStoragePath);

      const { error: updateJobError } = await supabase
        .from('photo_processing_jobs')
        .update({
          original_storage_path: originalStoragePath
        })
        .eq('id', reservedJob.id);

      if (updateJobError) {
        throw new Error(`Wachtrij-record kon niet worden bijgewerkt: ${updateJobError.message}`);
      }
    }

    kickPhotoProcessingQueue(authHeader).catch((error) => {
      console.error('Queue runner kon niet worden gestart:', error);
    });

    return NextResponse.json(
      {
        status: 'stored',
        batchId,
        queued: files.length,
        message: 'Foto\'s zijn veilig opgeslagen en worden op de achtergrond verwerkt.'
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Job route error:', error);

    if (batchId) {
      try {
        const supabase = createServerSupabaseClient({ authHeader });

        if (uploadedOriginalPaths.length > 0) {
          const { error: removeError } = await supabase.storage
            .from(PHOTO_BUCKET)
            .remove(uploadedOriginalPaths);

          if (removeError) {
            console.error('Kon opgeslagen originelen niet volledig opruimen:', removeError);
          }
        }

        const { error: deleteJobsError } = await supabase
          .from('photo_processing_jobs')
          .delete()
          .eq('batch_id', batchId);

        if (deleteJobsError) {
          console.error('Kon wachtrij-records niet opruimen:', deleteJobsError);
        }
      } catch (cleanupError) {
        console.error('Opruimen na mislukte enqueue faalde:', cleanupError);
      }
    }

    return NextResponse.json(
      {
        error: 'Fout bij starten van verwerkingsjob',
        details: error?.message || 'Onbekende fout'
      },
      { status: 500 }
    );
  }
}

