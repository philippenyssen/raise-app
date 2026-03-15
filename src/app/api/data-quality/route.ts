import { NextResponse } from 'next/server';
import { getAllInvestors } from '@/lib/db';

interface FieldCheck {
  field: string;
  category: 'core' | 'intelligence' | 'relationship' | 'context';
  filled: number;
  total: number;
  pct: number;
}

interface InvestorCompleteness { id: string; name: string; completeness: number; missingFields: string[]; }

const FIELD_CONFIG: { field: string; category: 'core' | 'intelligence' | 'relationship' | 'context' }[] = [
  // Core fields
  { field: 'name', category: 'core' },
  { field: 'type', category: 'core' },
  { field: 'tier', category: 'core' },
  { field: 'status', category: 'core' },
  // Intelligence fields
  { field: 'partner', category: 'intelligence' },
  { field: 'fund_size', category: 'intelligence' },
  { field: 'check_size_range', category: 'intelligence' },
  { field: 'sector_thesis', category: 'intelligence' },
  // Relationship fields
  { field: 'warm_path', category: 'relationship' },
  { field: 'ic_process', category: 'relationship' },
  { field: 'speed', category: 'relationship' },
  // Context fields
  { field: 'portfolio_conflicts', category: 'context' },
  { field: 'notes', category: 'context' },];

function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return value > 0;
  return true;
}

export async function GET() {
  try {
    const investors = await getAllInvestors();
    const total = investors.length;

    if (total === 0) {
      return NextResponse.json({
        overallCompleteness: 0,
        fieldCompleteness: [],
        worstInvestors: [],
        bestInvestors: [],
        intelligenceReadiness: 0,
        recommendations: ['Add investors to get started.'],});
    }

    // Compute field-level completeness
    const fieldCompleteness: FieldCheck[] = FIELD_CONFIG.map(({ field, category }) => {
      const filled = investors.filter(inv => {
        const val = (inv as unknown as Record<string, unknown>)[field];
        // Core fields: 'type' always has a default, 'tier' always has default, 'status' always has default
        if (field === 'type' || field === 'tier' || field === 'status') return true;
        return isFieldFilled(val);
      }).length;
      return { field, category, filled, total, pct: Math.round((filled / total) * 100) };});

    // Compute per-investor completeness
    const investorScores: InvestorCompleteness[] = investors.map(inv => {
      const checkableFields = FIELD_CONFIG.filter(f => f.field !== 'name' && f.field !== 'type' && f.field !== 'tier' && f.field !== 'status');
      const missingFields: string[] = [];
      let filledCount = 0;

      for (const { field } of checkableFields) {
        const val = (inv as unknown as Record<string, unknown>)[field];
        if (isFieldFilled(val)) {
          filledCount++;
        } else {
          missingFields.push(field);
        }}

      const completeness = Math.round((filledCount / checkableFields.length) * 100);
      return { id: inv.id, name: inv.name, completeness, missingFields };});

    // Sort for worst and best
    const sorted = [...investorScores].sort((a, b) => a.completeness - b.completeness);
    const worstInvestors = sorted.filter(i => i.completeness < 100).slice(0, 10);
    const bestInvestors = sorted.filter(i => i.completeness >= 80).slice(-5).reverse();

    // Overall completeness
    const totalFields = FIELD_CONFIG.length * total;
    const totalFilled = fieldCompleteness.reduce((sum, f) => sum + f.filled, 0);
    const overallCompleteness = Math.round((totalFilled / totalFields) * 100);

    // Intelligence readiness: based on intelligence + relationship fields only
    const intelFields = fieldCompleteness.filter(f => f.category === 'intelligence' || f.category === 'relationship');
    const intelTotal = intelFields.reduce((sum, f) => sum + f.total, 0);
    const intelFilled = intelFields.reduce((sum, f) => sum + f.filled, 0);
    const intelligenceReadiness = intelTotal > 0 ? Math.round((intelFilled / intelTotal) * 100) : 0;

    // Generate actionable recommendations
    const recommendations: string[] = [];
    const sortedByGap = [...fieldCompleteness]
      .filter(f => f.category !== 'core' && f.pct < 100)
      .sort((a, b) => a.pct - b.pct);

    for (const field of sortedByGap.slice(0, 4)) {
      const missing = field.total - field.filled;
      const label = field.field.replace(/_/g, ' ');
      if (field.category === 'intelligence') {
        recommendations.push(`Fill ${label} for ${missing} investor${missing > 1 ? 's' : ''} to improve scoring accuracy`);
      } else if (field.category === 'relationship') {
        recommendations.push(`Add ${label} for ${missing} investor${missing > 1 ? 's' : ''} to unlock focus optimization`);
      } else {
        recommendations.push(`Complete ${label} for ${missing} investor${missing > 1 ? 's' : ''} for better risk assessment`);
      }}

    if (intelligenceReadiness < 50) {
      recommendations.push('Intelligence readiness is below 50% -- scoring and focus features will be unreliable');
    }

    return NextResponse.json({
      overallCompleteness,
      fieldCompleteness,
      worstInvestors,
      bestInvestors,
      intelligenceReadiness,
      recommendations,});
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to compute data quality' }, { status: 500 });
  }
}
