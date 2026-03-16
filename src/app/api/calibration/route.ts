import { NextResponse } from 'next/server';
import { getCalibrationData } from '@/lib/db';

export async function GET() {
  try {
    const data = await getCalibrationData();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' } });
  } catch (err) {
    console.error('[CALIBRATION]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to fetch calibration data' }, { status: 500 });
  }
}
