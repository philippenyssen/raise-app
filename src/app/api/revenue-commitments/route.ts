import { NextRequest, NextResponse } from 'next/server';
import { getRevenueCommitments, createRevenueCommitment, updateRevenueCommitment, deleteRevenueCommitment } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status') || undefined;
    const confidenceMin = req.nextUrl.searchParams.get('confidence_min');
    const parsedConfMin = confidenceMin ? parseFloat(confidenceMin) : undefined;
    const commitments = await getRevenueCommitments({
      status,
      confidence_min: parsedConfMin !== undefined && !isNaN(parsedConfMin) && parsedConfMin >= 0 && parsedConfMin <= 1 ? parsedConfMin : undefined,
    });

    // Compute summary
    const active = (commitments as Array<{ status: string; amount_eur: number; confidence: number; contract_type: string }>)
      .filter(c => c.status === 'active');
    const totalCommitted = active.reduce((s, c) => s + c.amount_eur, 0);
    const weightedCommitted = active.reduce((s, c) => s + c.amount_eur * c.confidence, 0);
    const byType = active.reduce<Record<string, number>>((acc, c) => {
      acc[c.contract_type] = (acc[c.contract_type] || 0) + c.amount_eur;
      return acc;
    }, {});

    return NextResponse.json({
      commitments,
      summary: {
        total_committed_eur: totalCommitted,
        probability_weighted_eur: weightedCommitted,
        by_type: byType,
        count: active.length,
      },
    }, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
  } catch (err) {
    console.error('[COMMITMENTS_GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to load revenue commitments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const customer = (body.customer ?? body.counterparty) as string | undefined;
  if (!customer || typeof customer !== 'string') {
    return NextResponse.json({ error: 'customer is required' }, { status: 400 });
  }
  body.customer = customer.trim();
  const textLimits: Record<string, number> = { customer: 255, contract_name: 500, contract_type: 100, notes: 5000 };
  for (const [field, max] of Object.entries(textLimits)) {
    if (body[field] && typeof body[field] === 'string' && (body[field] as string).length > max) {
      return NextResponse.json({ error: `${field} exceeds maximum length of ${max} characters` }, { status: 400 });
    }
  }
  if (!body.amount_eur || typeof body.amount_eur !== 'number' || body.amount_eur <= 0 || body.amount_eur > 10_000_000_000) {
    return NextResponse.json({ error: 'amount_eur must be a positive number up to 10,000,000,000' }, { status: 400 });
  }
  if (body.confidence !== undefined && (typeof body.confidence !== 'number' || body.confidence < 0 || body.confidence > 1)) {
    return NextResponse.json({ error: 'confidence must be a number between 0 and 1' }, { status: 400 });
  }
  try {
    const commitment = await createRevenueCommitment(body as unknown as Parameters<typeof createRevenueCommitment>[0]);
    emitContextChange('commitment_created', `Revenue commitment: ${(body.counterparty as string) || (body.contract_name as string) || ''}`);
    return NextResponse.json(commitment, { status: 201 });
  } catch (err) {
    console.error('[COMMITMENTS_POST]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to create revenue commitment' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  try {
    const id = body.id as string;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const ALLOWED = new Set(['customer', 'program', 'contract_type', 'amount_eur', 'start_date', 'end_date', 'annual_amount', 'confidence', 'status', 'source_doc', 'notes']);
    const updates = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.has(k)));
    if (updates.amount_eur !== undefined && (typeof updates.amount_eur !== 'number' || updates.amount_eur <= 0 || updates.amount_eur > 10_000_000_000)) {
      return NextResponse.json({ error: 'amount_eur must be a positive number up to 10,000,000,000' }, { status: 400 });
    }
    if (updates.confidence !== undefined && (typeof updates.confidence !== 'number' || updates.confidence < 0 || updates.confidence > 1)) {
      return NextResponse.json({ error: 'confidence must be between 0 and 1' }, { status: 400 });
    }
    await updateRevenueCommitment(id, updates);
    emitContextChange('commitment_updated', `Commitment ${id} updated`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[COMMITMENTS_PUT]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to update revenue commitment' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  try {
    await deleteRevenueCommitment(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[COMMITMENTS_DELETE]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to delete revenue commitment' }, { status: 500 });
  }
}
