import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

export async function POST(req: NextRequest) {
  let tmpDir: string | null = null;

  try {
    const contentType = req.headers.get('content-type') || '';

    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Ongeldig request type. Verwacht multipart/form-data met veldnaam "image".' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('image');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Geen geldig afbeeldingsbestand ontvangen (veldnaam: "image").' },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: 'Het bestand is leeg.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Bestand is te groot. Maximale grootte is 10MB.' },
        { status: 413 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Alleen JPEG, PNG of WebP afbeeldingen zijn toegestaan.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Schrijf naar tijdelijke map zodat Python er mee kan werken
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hefonderdelen-bg-'));
    const inputPath = path.join(tmpDir, 'input-image');
    const outputPath = path.join(tmpDir, 'output-image.jpg');

    await fs.writeFile(inputPath, inputBuffer);

    await runPythonBackgroundRemoval(inputPath, outputPath);

    const outputBuffer = await fs.readFile(outputPath);

    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': outputBuffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Image processing failed:', error);

    return NextResponse.json(
      {
        error:
          'Fout bij verwerken van afbeelding met het Python script. Controleer of Python, rembg, Pillow en numpy geïnstalleerd zijn.',
        details: error?.message || 'Onbekende fout',
      },
      { status: 500 }
    );
  } finally {
    if (tmpDir) {
      try {
        const files = await fs.readdir(tmpDir);
        await Promise.all(files.map((f) => fs.unlink(path.join(tmpDir!, f))));
        await fs.rmdir(tmpDir);
      } catch {
        // Fouten bij opruimen negeren
      }
    }
  }
}
