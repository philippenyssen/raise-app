import { NextResponse } from 'next/server';
import { getDataRoomFileCount } from '@/lib/db';

export async function GET() {
  try {
    const count = await getDataRoomFileCount();
    return NextResponse.json({ count });
  } catch (e) {
    console.error('[DATA_ROOM_COUNT]', e instanceof Error ? e.message : e);
    return NextResponse.json({ count: 0 });
  }
}
