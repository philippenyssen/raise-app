import { NextRequest, NextResponse } from 'next/server';
import { getAllInvestors, getInvestor, createInvestor, updateInvestor, deleteInvestor, resolvePrediction, resolveForecastPredictions, buildRelationshipGraph, createTask, logActivity } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

// Allowlisted fields that can be updated via API
const ALLOWED_UPDATE_FIELDS = new Set([
  'name', 'type', 'tier', 'status', 'partner', 'fund_size', 'check_size_range',
  'sector_thesis', 'warm_path', 'ic_process', 'speed', 'portfolio_conflicts',
  'notes', 'enthusiasm', 'committed_amount',]);

function filterFields<T extends Record<string, unknown>>(data: T, allowed: Set<string>): Partial<T> {
  const filtered: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    if (allowed.has(key)) filtered[key] = data[key];
  }
  return filtered as Partial<T>;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id');
    if (id) {
      const investor = await getInvestor(id);
      if (!investor) return NextResponse.json({ error: `Investor ${id} not found` }, { status: 404 });
      return NextResponse.json(investor, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } });
    }
    const investors = await getAllInvestors();
    return NextResponse.json(investors, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } });
  } catch (error) {
    console.error('[INVESTORS_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to fetch investors' },
      { status: 500 });
  }}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required and must be a non-empty string' }, { status: 400 });
  }
  body.name = (body.name as string).trim();
  const textLimits: Record<string, number> = { name: 255, sector_thesis: 2000, warm_path: 1000, ic_process: 2000, notes: 10000, portfolio_conflicts: 2000, partner: 255, fund_size: 100, check_size_range: 100 };
  for (const [field, max] of Object.entries(textLimits)) {
    if (body[field] && typeof body[field] === 'string' && (body[field] as string).length > max) {
      return NextResponse.json({ error: `${field} exceeds maximum length of ${max} characters` }, { status: 400 });
    }
  }

  if (body.tier !== undefined && (typeof body.tier !== 'number' || body.tier < 1 || body.tier > 4)) {
    return NextResponse.json({ error: 'tier must be a number between 1 and 4' }, { status: 400 });
  }

  const validTypes = ['vc', 'growth', 'sovereign', 'strategic', 'debt', 'family_office'];
  if (body.type !== undefined && !validTypes.includes(body.type as string)) {
    return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
  }

  try {
    const investor = await createInvestor(filterFields(body, ALLOWED_UPDATE_FIELDS) as { name: string });
    emitContextChange('investor_created', `Created investor ${body.name}`);

    // Rebuild relationship graph after creating a new investor (non-blocking)
    try { buildRelationshipGraph().catch(e => console.error('[RELATIONSHIP_GRAPH]', e instanceof Error ? e.message : e)); } catch { /* non-blocking */ }

    // Fire-and-forget: trigger enrichment for the newly created investor (5s timeout)
    try {
      const baseUrl = req.nextUrl.origin;
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), 5000);
      fetch(`${baseUrl}/api/enrichment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enrich', investor_id: investor.id, auto_apply: true }),
        signal: ac.signal,
      }).catch(e => console.error('[AUTO_ENRICH]', e instanceof Error ? e.message : e)).finally(() => clearTimeout(tid));
    } catch (e) { console.error('[AUTO_ENRICH_TRIGGER]', e instanceof Error ? e.message : e); }

    return NextResponse.json(investor, { status: 201 });
  } catch (error) {
    console.error('[INVESTORS_POST]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to create investor' },
      { status: 500 });
  }}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const { id, ...rawUpdates } = body;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required and must be a string' }, { status: 400 });
  }

  const validStatuses = ['identified', 'contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet', 'closed', 'passed', 'dropped'];
  if (rawUpdates.status && !validStatuses.includes(rawUpdates.status as string)) {
    return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
  }

  if (rawUpdates.enthusiasm !== undefined) {
    const enth = rawUpdates.enthusiasm as number;
    if (typeof enth !== 'number' || enth < 0 || enth > 5) {
      return NextResponse.json({ error: 'enthusiasm must be a number between 0 and 5' }, { status: 400 });
    }}

  const updates = filterFields(rawUpdates, ALLOWED_UPDATE_FIELDS);
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update. Allowed fields: ' + [...ALLOWED_UPDATE_FIELDS].join(', ') }, { status: 400 });
  }

  try {
    await updateInvestor(id as string, updates);

    // Resolve predictions when investor reaches terminal state
    // Re-read status to avoid race condition with concurrent updates
    if (updates.status && ['passed', 'dropped', 'closed'].includes(updates.status as string)) {
      try {
        const current = await getInvestor(id as string);
        if (current && current.status === updates.status) {
          const outcome = updates.status as 'closed' | 'passed' | 'dropped';
          await resolvePrediction(id as string, outcome, outcome === 'closed' ? new Date().toISOString().split('T')[0] : undefined);
          await resolveForecastPredictions(id as string, outcome);
        }
      } catch (e) { console.error('[RESOLVE_PREDICTION]', e instanceof Error ? e.message : e); }
    }

    // Auto-create tasks on key status transitions
    if (updates.status) {
      const investor = await getInvestor(id as string).catch(() => null);
      const name = investor?.name || id;
      const statusTasks: Record<string, { title: string; description: string; priority: 'high' | 'medium'; phase: import('@/lib/types').RaisePhase; due_days: number }[]> = {
        nda_signed: [
          { title: `Prepare data room access for ${name}`, description: 'NDA signed — grant data room access and send introductory materials.', priority: 'high', phase: 'outreach', due_days: 1 },
        ],
        in_dd: [
          { title: `Prepare DD materials for ${name}`, description: 'Investor entering due diligence. Ensure financials, cap table, and legal docs are current.', priority: 'high', phase: 'due_diligence', due_days: 2 },
          { title: `Schedule DD sessions with ${name}`, description: 'Coordinate management presentations and technical deep-dives.', priority: 'medium', phase: 'due_diligence', due_days: 3 },
        ],
        term_sheet: [
          { title: `Review term sheet from ${name}`, description: 'Term sheet received. Review economics, governance, and protective provisions with counsel.', priority: 'high', phase: 'negotiation', due_days: 1 },
          { title: `Compare ${name} terms against other offers`, description: 'Run term comparison analysis and update deal mechanics page.', priority: 'high', phase: 'negotiation', due_days: 2 },
        ],
        closed: [
          { title: `Post-close onboarding for ${name}`, description: 'Send welcome package, schedule board introductions, update cap table.', priority: 'medium', phase: 'closing', due_days: 5 },
        ],
        passed: [
          { title: `Post-mortem: why ${name} passed`, description: 'Document the pass reason, key objections, and lessons learned. Update competitive intel if relevant.', priority: 'high', phase: 'preparation', due_days: 2 },
          { title: `Archive ${name} for potential re-engagement`, description: 'Record timing, relationship contacts, and conditions under which re-engagement would make sense.', priority: 'medium', phase: 'preparation', due_days: 5 },
        ],
        dropped: [
          { title: `Document drop reason for ${name}`, description: 'Record why this investor was dropped and whether re-engagement is possible in future rounds.', priority: 'medium', phase: 'preparation', due_days: 5 },
        ],
      };
      const tasks = statusTasks[updates.status as string];
      if (tasks) {
        for (const t of tasks) {
          try {
            await createTask({
              title: t.title, description: t.description, assignee: '',
              due_date: new Date(Date.now() + t.due_days * 864e5).toISOString().split('T')[0],
              status: 'pending', priority: t.priority, phase: t.phase,
              investor_id: id as string, investor_name: name, auto_generated: true,
            });
          } catch (e) { console.error('[STATUS_TASK]', e instanceof Error ? e.message : e); }
        }
        try {
          await logActivity({ event_type: 'status_changed', subject: `${name} moved to ${updates.status}`, detail: `${tasks.length} task(s) auto-created`, investor_id: id as string, investor_name: name });
        } catch (e) { console.error('[STATUS_ACTIVITY]', e instanceof Error ? e.message : e); }
      }
    }

    emitContextChange('investor_updated', `Updated investor ${id}${updates.status ? ` status=${updates.status}` : ''}`);

    // Rebuild relationship graph when warm_path changes (non-blocking)
    if (updates.warm_path !== undefined) {
      try { buildRelationshipGraph().catch(e => console.error('[RELATIONSHIP_GRAPH]', e instanceof Error ? e.message : e)); } catch { /* non-blocking */ }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[INVESTORS_PUT]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to update investor' },
      { status: 500 });
  }}

export async function DELETE(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });

  try {
    const investor = await getInvestor(id);
    if (!investor) { return NextResponse.json({ error: `Investor ${id} not found` }, { status: 404 }); }
    await deleteInvestor(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[INVESTORS_DELETE]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to delete investor' },
      { status: 500 });
  }}
