import { NextResponse } from 'next/server';
import { getAllDocuments } from '@/lib/db';

interface ExtractedMetric { metric: string; value: string; document: string; }

interface ConsistencyCheck { metric: string; values: { document: string; value: string }[]; status: 'match' | 'mismatch'; }

function extractMetrics(title: string, content: string): ExtractedMetric[] {
  const metrics: ExtractedMetric[] = [];
  if (!content) return metrics;

  // Pre-money valuation
  const preMoneyPatterns = [
    /€([\d.,]+\s*[BMK]?(?:illion|n)?)\s*pre-money/gi,
    /pre-money\s*(?:valuation)?[:\s]*€([\d.,]+\s*[BMK]?(?:illion|n)?)/gi,
    /pre-money\s*(?:valuation)?[:\s]*([\d.,]+\s*[BMK]?(?:illion|n)?)\s*€?/gi,];
  for (const pattern of preMoneyPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      metrics.push({ metric: 'Pre-money valuation', value: normalizeValue(match[1]), document: title });
    }}

  // Equity raise amount
  const equityPatterns = [
    /€([\d.,]+\s*[BMK]?(?:illion|n)?)\s*(?:in\s+)?equity/gi,
    /equity\s*(?:raise|round)?[:\s]*€([\d.,]+\s*[BMK]?(?:illion|n)?)/gi,];
  for (const pattern of equityPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      metrics.push({ metric: 'Equity raise', value: normalizeValue(match[1]), document: title });
    }}

  // Revenue figures by year (e.g., "2025A: €51M revenue", "FY2026E revenue of €120M")
  const revenuePatterns = [
    /(?:FY)?(20\d{2})[AEe]?\s*[:\-]?\s*(?:revenue\s*(?:of\s*)?)?€([\d.,]+\s*[BMK]?(?:illion|n)?)\s*(?:revenue|rev)/gi,
    /(?:FY)?(20\d{2})[AEe]?\s*[:\-]?\s*€([\d.,]+\s*[BMK]?(?:illion|n)?)\s*(?:revenue|rev)/gi,
    /(?:revenue|rev)\s*(?:FY)?(20\d{2})[AEe]?\s*[:\-]?\s*€([\d.,]+\s*[BMK]?(?:illion|n)?)/gi,];
  for (const pattern of revenuePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const year = match[1];
      const value = match[2];
      metrics.push({ metric: `Revenue ${year}`, value: normalizeValue(value), document: title });
    }}

  // MOIC figures
  const moicPatterns = [
    /([\d.]+)x\s*(?:MOIC|return|multiple)/gi,
    /MOIC\s*(?:of\s*)?([\d.]+)x/gi,];
  for (const pattern of moicPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      metrics.push({ metric: 'MOIC', value: `${match[1]}x`, document: title });
    }}

  // Employee / FTE counts
  const ftePatterns = [
    /([\d,]+)\s*(?:employees?|FTEs?|people|headcount)/gi,];
  for (const pattern of ftePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      metrics.push({ metric: 'Headcount', value: match[1].replace(/,/g, ''), document: title });
    }}

  return metrics;
}

function normalizeValue(raw: string): string {
  return raw.replace(/\s+/g, '').trim();
}

function deduplicateMetrics(metrics: ExtractedMetric[]): ExtractedMetric[] {
  const seen = new Set<string>();
  const result: ExtractedMetric[] = [];
  for (const m of metrics) {
    const key = `${m.document}|${m.metric}|${m.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(m);
    }}
  return result;
}

export async function GET() {
  try {
    const documents = await getAllDocuments();
    const checkedAt = new Date().toISOString();

    if (documents.length < 2) { return NextResponse.json({ consistent: true, checks: [], checkedAt }); }

    // Extract metrics from all documents
    let allMetrics: ExtractedMetric[] = [];
    for (const doc of documents) {
      const extracted = extractMetrics(doc.title, doc.content);
      allMetrics = allMetrics.concat(extracted);
    }
    allMetrics = deduplicateMetrics(allMetrics);

    // Group by metric name
    const grouped: Record<string, { document: string; value: string }[]> = {};
    for (const m of allMetrics) {
      if (!grouped[m.metric]) grouped[m.metric] = [];
      grouped[m.metric].push({ document: m.document, value: m.value });
    }

    // Build checks: only include metrics found in 2+ documents
    const checks: ConsistencyCheck[] = [];
    for (const [metric, values] of Object.entries(grouped)) {
      const docNames = new Set(values.map(v => v.document));
      if (docNames.size < 2) continue;

      // Deduplicate per document (take first occurrence)
      const perDoc = new Map<string, string>();
      for (const v of values) {
        if (!perDoc.has(v.document)) {
          perDoc.set(v.document, v.value);
        }}

      const uniqueValues = new Set(perDoc.values());
      checks.push({
        metric,
        values: Array.from(perDoc.entries()).map(([document, value]) => ({ document, value })),
        status: uniqueValues.size === 1 ? 'match' : 'mismatch',});
    }

    // Sort: mismatches first, then alphabetically
    checks.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'mismatch' ? -1 : 1;
      return a.metric.localeCompare(b.metric);});

    const consistent = checks.every(c => c.status === 'match');

    return NextResponse.json({ consistent, checks, checkedAt });
  } catch (error) {
    console.error('[CONSISTENCY_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Consistency check failed', details: String(error) },
      { status: 500 });
  }}
