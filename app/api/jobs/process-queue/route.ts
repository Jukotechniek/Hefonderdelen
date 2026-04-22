import { NextResponse } from 'next/server';
import { kickPhotoProcessingQueue } from '../../../../lib/photo-processing-queue';

export const runtime = 'nodejs';

export async function POST() {
  try {
    kickPhotoProcessingQueue().catch((error) => {
      console.error('Queue runner kon niet worden gestart via process-queue route:', error);
    });

    return NextResponse.json({ status: 'started' }, { status: 202 });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Queue runner kon niet worden gestart.',
        details: error?.message || 'Onbekende fout'
      },
      { status: 500 }
    );
  }
}
