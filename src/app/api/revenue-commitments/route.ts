import { NextRequest, NextResponse } from 'next/server';
import { getRevenueCommitments, createRevenueCommitment, updateRevenueCommitment, deleteRevenueCommitment } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status') || undefined;
    const confidenceMin = req.nextUrl.searchParams.get('confidence_min');
    const commitments = await getRevenueCommitments({
      status,
      confidence_min: confidenceMin ? parseFloat(confidenceMin) : undefined,
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
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  if (!body.counterparty || typeof body.counterparty !== 'string') {
    return NextResponse.json({ error: 'counterparty is required' }, { status: 400 });
  }
  if (!body.amount_eur || typeof body.amount_eur !== 'number') {
    return NextResponse.json({ error: 'amount_eur is required and must be a number' }, { status: 400 });
  }
  try {
    const commitment = await createRevenueCommitment(body as unknown as Parameters<typeof createRevenueCommitment>[0]);
    emitContextChange('commitment_created', `Revenue commitment: ${(body.counterparty as string) || (body.contract_name as string) || ''}`);
    return NextResponse.json(commitment, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
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
    const { id: _id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await updateRevenueCommitment(id, updates);
    emitContextChange('commitment_updated', `Commitment ${id} updated`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    await deleteRevenueCommitment(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
