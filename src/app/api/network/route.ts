import { NextResponse } from 'next/server';
import { computeNetworkCascades } from '@/lib/db';
import { getClient } from '@/lib/api-helpers';

function parseCheckSizeMidpoint(range: string): number {
  if (!range) return 0;
  const cleaned = range.replace(/[€$£,]/g, '').trim().toLowerCase();
  const rangeMatch = cleaned.match(/([\d.]+)\s*m?\s*[-–to]+\s*([\d.]+)\s*m/i);
  if (rangeMatch) { return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2; }
  const singleMatch = cleaned.match(/([\d.]+)\s*(m|b|k|bn|million|billion)?/i);
  if (singleMatch) {
    let val = parseFloat(singleMatch[1]);
    const unit = (singleMatch[2] || '').toLowerCase();
    if (unit === 'b' || unit === 'bn' || unit === 'billion') val *= 1000;
    if (unit === 'k') val /= 1000;
    return val;
  }
  return 0;
}

export async function GET() {
  try {
    const cascades = await computeNetworkCascades();
    const db = getClient();

    const investorResult = await db.execute(
      `SELECT id, name, tier, status, enthusiasm, check_size_range FROM investors WHERE status NOT IN ('passed', 'dropped')`);
    const investorLookup = new Map<string, { name: string; tier: number; status: string; enthusiasm: number; checkSize: string; capitalM: number }>();
    for (const row of investorResult.rows as unknown as Array<{ id: string; name: string; tier: number; status: string; enthusiasm: number; check_size_range: string }>) {
      const capitalM = parseCheckSizeMidpoint(row.check_size_range || '');
      investorLookup.set(row.id, {
        name: row.name,
        tier: row.tier,
        status: row.status,
        enthusiasm: row.enthusiasm,
        checkSize: row.check_size_range || '',
        capitalM,});
    }

    const enrichedCascades = cascades.map(cascade => {
      const keystoneInfo = investorLookup.get(cascade.keystoneId);
      const chainWithCapital = cascade.cascadeChain.map(link => {
        const info = investorLookup.get(link.investorId);
        const capitalM = info?.capitalM || 0;
        return {
          ...link,
          checkSize: info?.checkSize || '',
          capitalM,
          expectedCapitalM: Math.round(capitalM * link.probability * 100) / 100,
        };});

      const totalCascadeCapitalM = chainWithCapital.reduce((sum, l) => sum + l.capitalM, 0);
      const expectedCascadeCapitalM = chainWithCapital.reduce((sum, l) => sum + l.expectedCapitalM, 0);

      return {
        keystoneId: cascade.keystoneId,
        keystoneName: cascade.keystoneName,
        keystoneTier: keystoneInfo?.tier || 3,
        keystoneStatus: keystoneInfo?.status || 'unknown',
        keystoneEnthusiasm: keystoneInfo?.enthusiasm || 0,
        keystoneCheckSize: keystoneInfo?.checkSize || '',
        keystoneCapitalM: keystoneInfo?.capitalM || 0,
        cascadeChain: chainWithCapital,
        chainLength: chainWithCapital.length,
        totalCascadeProbability: cascade.totalCascadeProbability,
        totalCascadeCapitalM: Math.round(totalCascadeCapitalM * 100) / 100,
        expectedCascadeCapitalM: Math.round(expectedCascadeCapitalM * 100) / 100,
        networkBottleneck: cascade.networkBottleneck,
        signal: cascade.signal,
      };});

    enrichedCascades.sort((a, b) => b.expectedCascadeCapitalM - a.expectedCascadeCapitalM);

    const totalExpectedCapitalM = enrichedCascades.reduce((sum, c) => {
      return sum + c.keystoneCapitalM + c.expectedCascadeCapitalM;
    }, 0);

    const totalInvestorsConnected = new Set(
      enrichedCascades.flatMap(c => [c.keystoneId, ...c.cascadeChain.map(l => l.investorId)])
    ).size;

    const avgChainLength = enrichedCascades.length > 0
      ? Math.round((enrichedCascades.reduce((sum, c) => sum + c.chainLength, 0) / enrichedCascades.length) * 10) / 10
      : 0;

    const strongestChain = enrichedCascades.length > 0
      ? enrichedCascades.reduce((best, c) => c.expectedCascadeCapitalM > best.expectedCascadeCapitalM ? c : best)
      : null;

    const weakestChain = enrichedCascades.length > 0
      ? enrichedCascades.reduce((worst, c) => c.expectedCascadeCapitalM < worst.expectedCascadeCapitalM ? c : worst)
      : null;

    const worstBottleneck = enrichedCascades
      .filter(c => c.networkBottleneck)
      .sort((a, b) => {
        const aImpact = Math.abs(a.networkBottleneck?.impactIfPass || 0) * a.expectedCascadeCapitalM;
        const bImpact = Math.abs(b.networkBottleneck?.impactIfPass || 0) * b.expectedCascadeCapitalM;
        return bImpact - aImpact;
      })[0] || null;

    return NextResponse.json({
      cascades: enrichedCascades,
      summary: {
        totalExpectedCapitalM: Math.round(totalExpectedCapitalM * 100) / 100,
        totalInvestorsConnected,
        avgChainLength,
        keystoneCount: enrichedCascades.length,
        strongestChain: strongestChain ? { name: strongestChain.keystoneName, capitalM: strongestChain.expectedCascadeCapitalM } : null,
        weakestChain: weakestChain ? { name: weakestChain.keystoneName, capitalM: weakestChain.expectedCascadeCapitalM } : null,},
      bottleneckAlert: worstBottleneck ? {
        keystoneName: worstBottleneck.keystoneName,
        bottleneckName: worstBottleneck.networkBottleneck!.investorName,
        impactIfPass: worstBottleneck.networkBottleneck!.impactIfPass,
        capitalAtRiskM: worstBottleneck.expectedCascadeCapitalM,
      } : null,
      generatedAt: new Date().toISOString(),});
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute network cascades', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 });
  }}
