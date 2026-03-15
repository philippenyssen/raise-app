import { NextRequest, NextResponse } from 'next/server';
import { getAllDataRoomFiles, createDataRoomFile, deleteDataRoomFile } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

export async function GET() {
  try {
    const files = await getAllDataRoomFiles();
    return NextResponse.json(files);
  } catch {
    return NextResponse.json({ error: 'Failed to load data room files' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { filename, category, mime_type, size_bytes, extracted_text, summary } = body;

  if (!filename || !extracted_text) {
    return NextResponse.json({ error: 'filename and extracted_text are required' }, { status: 400 });
  }

  try {
    const file = await createDataRoomFile({
      filename: String(filename),
      category: String(category || 'other'),
      mime_type: String(mime_type || ''),
      size_bytes: Number(size_bytes) || 0,
      extracted_text: String(extracted_text).slice(0, 100_000),
      summary: summary ? String(summary) : undefined,
    });

    emitContextChange('data_room_uploaded', `Uploaded ${filename}`);
    return NextResponse.json(file, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create data room file' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  try {
    await deleteDataRoomFile(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete data room file' }, { status: 500 });
  }
}
