import { NextRequest, NextResponse } from 'next/server';
import { getDocument, getRaiseConfig, getAllDocuments } from '@/lib/db';
import { improveSection, checkConsistency, findWeakArguments, polishGoldmanStyle } from '@/lib/ai';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const operation = body.operation as string | undefined;
  const section = body.section as string | undefined;
  const instruction = body.instruction as string | undefined;

  const doc = await getDocument(id);
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  try {
    let result: unknown;

    switch (operation) {
      case 'improve': {
        result = await improveSection(section || doc.content, instruction || 'Improve clarity and concision', doc.content);
        break;
      }
      case 'consistency': {
        const allDocs = await getAllDocuments();
        const config = await getRaiseConfig();
        result = await checkConsistency(
          allDocs.map(d => ({ title: d.title, content: d.content })),
          config
        );
        break;
      }
      case 'weak_arguments': {
        result = await findWeakArguments(doc.content);
        break;
      }
      case 'goldman': {
        result = await polishGoldmanStyle(section || doc.content);
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 400 });
    }

    return NextResponse.json({ result });
  } catch (err) {
    console.error('AI operation failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI operation failed' },
      { status: 500 }
    );
  }
}
