import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { createServerSupabaseClient } from './server-supabase';

const PHOTO_BUCKET = 'product-images';
const MAX_PROCESSING_ATTEMPTS = 3;

type PhotoProcessingJob = {
  id: string;
  product_id: string;
  sequence_number: number;
  original_storage_path: string | null;
  processed_storage_path: string | null;
  attempt_count: number;
};

let queueDrainPromise: Promise<void> | null = null;

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
        return;
      }

      reject(new Error(`Python script exited with code ${code}. stderr: ${stderr}`));
    });
  });
}

function getOriginalExtension(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.jpg' || extension === '.jpeg' || extension === '.png' || extension === '.webp') {
    return extension;
  }

  return '.jpg';
}

function getProcessedStoragePath(productId: string, sequenceNumber: number) {
  const folderPrefix = `tvh-${productId}/`;
  return `${folderPrefix}tvh-${productId}-${sequenceNumber}.jpg`;
}

async function claimNextPhotoProcessingJob(authHeader?: string | null) {
  const supabase = createServerSupabaseClient({ authHeader });
  const { data, error } = await supabase.rpc('claim_next_photo_processing_job');

  if (error) {
    throw new Error(`Kon volgende fotojob niet claimen: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0] as PhotoProcessingJob;
}

async function markPhotoProcessingJobFailed(jobId: string, errorMessage: string, authHeader?: string | null) {
  const supabase = createServerSupabaseClient({ authHeader });
  const { error } = await supabase
    .from('photo_processing_jobs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      finished_at: new Date().toISOString()
    })
    .eq('id', jobId);

  if (error) {
    console.error(`Kon fotojob ${jobId} niet op failed zetten:`, error);
  }
}

async function markPhotoProcessingJobProcessed(
  jobId: string,
  processedStoragePath: string,
  authHeader?: string | null
) {
  const supabase = createServerSupabaseClient({ authHeader });
  const { error } = await supabase
    .from('photo_processing_jobs')
    .update({
      status: 'processed',
      processed_storage_path: processedStoragePath,
      finished_at: new Date().toISOString(),
      error_message: null
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Kon fotojob ${jobId} niet afronden: ${error.message}`);
  }
}

async function processPhotoJob(job: PhotoProcessingJob, authHeader?: string | null) {
  if (!job.original_storage_path) {
    await markPhotoProcessingJobFailed(
      job.id,
      'Originele opslaglocatie ontbreekt voor deze fotojob.',
      authHeader
    );
    return;
  }

  const supabase = createServerSupabaseClient({ authHeader });
  const { data: originalFile, error: downloadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .download(job.original_storage_path);

  if (downloadError || !originalFile) {
    await markPhotoProcessingJobFailed(
      job.id,
      `Originele foto kon niet worden gedownload: ${downloadError?.message || 'onbekende fout'}`,
      authHeader
    );
    return;
  }

  let tmpDir: string | null = null;

  try {
    const inputBuffer = Buffer.from(await originalFile.arrayBuffer());
    const originalExtension = getOriginalExtension(job.original_storage_path);

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hefonderdelen-queue-'));
    const inputPath = path.join(tmpDir, `input${originalExtension}`);
    const outputPath = path.join(tmpDir, 'output.jpg');

    await fs.writeFile(inputPath, inputBuffer);

    let processingError: string | null = null;
    for (let attempt = 1; attempt <= MAX_PROCESSING_ATTEMPTS; attempt += 1) {
      try {
        await runPythonBackgroundRemoval(inputPath, outputPath);
        processingError = null;
        break;
      } catch (error: any) {
        processingError = error?.message || 'Onbekende fout tijdens wit maken.';

        if (attempt < MAX_PROCESSING_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    if (processingError) {
      await markPhotoProcessingJobFailed(job.id, processingError, authHeader);
      return;
    }

    const outputBuffer = await fs.readFile(outputPath);
    const processedStoragePath = getProcessedStoragePath(job.product_id, job.sequence_number);
    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(
      processedStoragePath,
      outputBuffer,
      {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg'
      }
    );

    if (uploadError) {
      await markPhotoProcessingJobFailed(
        job.id,
        `Verwerkte foto kon niet worden opgeslagen: ${uploadError.message}`,
        authHeader
      );
      return;
    }

    await markPhotoProcessingJobProcessed(job.id, processedStoragePath, authHeader);
  } catch (error: any) {
    await markPhotoProcessingJobFailed(
      job.id,
      error?.message || 'Onbekende fout tijdens verwerken.',
      authHeader
    );
  } finally {
    if (tmpDir) {
      const currentTmpDir = tmpDir;

      try {
        const files = await fs.readdir(currentTmpDir);
        await Promise.all(files.map((fileName) => fs.unlink(path.join(currentTmpDir, fileName))));
        await fs.rmdir(currentTmpDir);
      } catch (cleanupError) {
        console.error('Kon tijdelijke queuebestanden niet volledig opruimen:', cleanupError);
      }
    }
  }
}

async function drainPhotoProcessingQueue(authHeader?: string | null) {
  while (true) {
    const nextJob = await claimNextPhotoProcessingJob(authHeader);

    if (!nextJob) {
      return;
    }

    await processPhotoJob(nextJob, authHeader);
  }
}

export function kickPhotoProcessingQueue(authHeader?: string | null) {
  if (!queueDrainPromise) {
    queueDrainPromise = drainPhotoProcessingQueue(authHeader).finally(() => {
      queueDrainPromise = null;
    });
  }

  return queueDrainPromise;
}
