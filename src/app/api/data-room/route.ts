import { NextRequest, NextResponse } from 'next/server';
import { getAllDataRoomFiles, createDataRoomFile, deleteDataRoomFile } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

export async function GET() {
  const files = await getAllDataRoomFiles();
  return NextResponse.json(files);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { filename, category, mime_type, size_bytes, extracted_text, summary } = body;

  if (!filename || !extracted_text) {
    return NextResponse.json({ error: 'filename and extracted_text are required' }, { status: 400 });
  }

  const file = await createDataRoomFile({
    filename,
    category: category || 'other',
    mime_type: mime_type || '',
    size_bytes: size_bytes || 0,
    extracted_text,
    summary,
  });

  emitContextChange('data_room_uploaded', `Uploaded ${filename}`);
  return NextResponse.json(file);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await deleteDataRoomFile(id);
  return NextResponse.json({ success: true });
}
