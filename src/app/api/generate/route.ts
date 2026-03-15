import { NextRequest, NextResponse } from 'next/server';
import { getRaiseConfig, getAllDocuments, getDataRoomContext, createDocument, updateDocument, getModelSheets, updateModelSheet } from '@/lib/db';
import { generateDeliverable, generateModelFromContext } from '@/lib/generate';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { type } = body as { type: string };

  try {
    const raiseConfig = await getRaiseConfig();
    const dataRoomContext = await getDataRoomContext();
    const allDocs = await getAllDocuments();

    const context = {
      dataRoomContext,
      raiseConfig: raiseConfig ? JSON.stringify(raiseConfig, null, 2) : 'Not configured',
      existingDocs: allDocs.map(d => ({ title: d.title, type: d.type, content: d.content })),
    };

    if (type === 'model') {
      // Generate model assumptions and populate the first sheet
      const cells = await generateModelFromContext(context);
      const sheets = await getModelSheets();
      const assumptionsSheet = sheets.find(s => s.sheet_name === 'Assumptions');
      if (assumptionsSheet) {
        await updateModelSheet(assumptionsSheet.id, { data: JSON.stringify(cells) });
      }
      return NextResponse.json({ ok: true, type: 'model', sheetsUpdated: 1 });
    }

    // Generate document
    const TYPE_TITLES: Record<string, string> = {
      teaser: 'Series C Teaser',
      exec_summary: 'Executive Summary',
      memo: 'Investment Memorandum',
      dd_memo: 'Confirmatory DD Memorandum',
      deck: 'Management Presentation',
    };

    const content = await generateDeliverable(type, context);

    // Validate generated content before saving
    if (!content || typeof content !== 'string' || content.trim().length < 50) {
      return NextResponse.json(
        { error: 'AI generated insufficient content. Please try again.' },
        { status: 422 }
      );
    }

    // Create or update the document
    const existing = allDocs.find(d => d.type === type);
    if (existing) {
      await updateDocument(existing.id, {
        content,
        change_summary: `AI-generated from data room (${new Date().toISOString()})`,
      });
      return NextResponse.json({ ok: true, type, documentId: existing.id, action: 'updated' });
    } else {
      // Create new
      const doc = await createDocument({
        title: TYPE_TITLES[type] || type,
        type,
        content,
      });
      return NextResponse.json({ ok: true, type, documentId: doc.id, action: 'created' }, { status: 201 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed';
    // Detect billing/authentication errors and provide clear guidance
    if (msg.includes('credit balance') || msg.includes('too low')) {
      return NextResponse.json(
        { error: 'Anthropic API: insufficient credits. Check console.anthropic.com/settings/billing — make sure credits are on the same workspace as the API key. If you just added credits, try generating a new API key and redeploying.' },
        { status: 402 }
      );
    }
    if (msg.includes('authentication') || msg.includes('api_key') || msg.includes('401')) {
      return NextResponse.json(
        { error: 'Anthropic API key missing or invalid. Set ANTHROPIC_API_KEY in environment variables and redeploy.' },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
