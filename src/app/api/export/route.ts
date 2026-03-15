import { NextRequest, NextResponse } from 'next/server';
import { getAllInvestors, getMeetings, getAllTasks, getActivityLog } from '@/lib/db';

const VALID_TYPES = ['investors', 'meetings', 'tasks', 'activity', 'pipeline'] as const;
type ExportType = (typeof VALID_TYPES)[number];

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCSV(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCSVValue).join(',');
  const dataLines = rows.map(row => row.map(escapeCSVValue).join(','));
  return [headerLine, ...dataLines].join('\n');
}

function csvResponse(csv: string, type: string): NextResponse {
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=raise-${type}-${date}.csv`,
    },});
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') as ExportType | null;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type parameter. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 },);
    }

    if (type === 'investors') {
      const investors = await getAllInvestors();
      const headers = ['name', 'type', 'tier', 'status', 'partner', 'fund_size', 'check_size_range', 'enthusiasm', 'notes', 'created_at'];
      const rows = investors.map(inv => [
        inv.name, inv.type, inv.tier, inv.status, inv.partner, inv.fund_size,
        inv.check_size_range, inv.enthusiasm, inv.notes, inv.created_at,]);
      return csvResponse(toCSV(headers, rows), type);
    }

    if (type === 'meetings') {
      const meetings = await getMeetings();
      const headers = ['investor_name', 'date', 'type', 'duration_minutes', 'enthusiasm_score', 'next_steps', 'status_after', 'raw_notes'];
      const rows = meetings.map(m => [
        m.investor_name, m.date, m.type, m.duration_minutes, m.enthusiasm_score,
        m.next_steps, m.status_after, m.raw_notes,]);
      return csvResponse(toCSV(headers, rows), type);
    }

    if (type === 'tasks') {
      const tasks = await getAllTasks();
      const headers = ['title', 'status', 'priority', 'phase', 'investor_name', 'due_date', 'assignee', 'description'];
      const rows = tasks.map(t => [
        t.title, t.status, t.priority, t.phase, t.investor_name, t.due_date,
        t.assignee, t.description,]);
      return csvResponse(toCSV(headers, rows), type);
    }

    if (type === 'activity') {
      const events = await getActivityLog(10000);
      const headers = ['event_type', 'subject', 'detail', 'investor_name', 'created_at'];
      const rows = events.map(e => [
        e.event_type, e.subject, e.detail, e.investor_name, e.created_at,]);
      return csvResponse(toCSV(headers, rows), type);
    }

    // type === 'pipeline'
    const investors = await getAllInvestors();
    const meetings = await getMeetings();

    const meetingsByInvestor = new Map<string, { count: number; latest: string }>();
    for (const m of meetings) {
      const entry = meetingsByInvestor.get(m.investor_id);
      if (!entry) {
        meetingsByInvestor.set(m.investor_id, { count: 1, latest: m.date });
      } else {
        entry.count += 1;
        if (m.date > entry.latest) entry.latest = m.date;
      }}

    const headers = ['name', 'status', 'tier', 'type', 'enthusiasm', 'fund_size', 'meetings_count', 'latest_meeting_date'];
    const rows = investors.map(inv => {
      const stats = meetingsByInvestor.get(inv.id);
      return [
        inv.name, inv.status, inv.tier, inv.type, inv.enthusiasm, inv.fund_size,
        stats?.count ?? 0, stats?.latest ?? '',];});
    return csvResponse(toCSV(headers, rows), type);
  } catch (e) {
    console.error('[EXPORT_GET]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to export data' }, { status: 500 });
  }
}
