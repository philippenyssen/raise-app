import { NextRequest, NextResponse } from 'next/server';
import { getRevenueCommitments, createRevenueCommitment, updateRevenueCommitment, deleteRevenueCommitment } from '@/lib/db';

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
  try {
    const body = await req.json();
    const commitment = await createRevenueCommitment(body);
    return NextResponse.json(commitment);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await updateRevenueCommitment(id, updates);
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
