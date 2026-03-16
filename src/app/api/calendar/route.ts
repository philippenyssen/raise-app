import { NextRequest, NextResponse } from 'next/server';
import { getClient, groupByInvestorId } from '@/lib/api-helpers';
import type { InvestorRow, MeetingRow, FollowupRow } from '@/lib/api-types';

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const rangeStart = searchParams.get('start') ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const rangeEnd = searchParams.get('end') ?? new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);

    const db = getClient();

    const [investorRows, meetingRows, followupRows, taskRows] = await Promise.all([
      db.execute(`SELECT id, name, tier, status FROM investors WHERE status NOT IN ('passed', 'dropped')`),
      db.execute({
        sql: `SELECT id, investor_id, date, type, duration_minutes, location, investor_name
              FROM meetings WHERE date >= ? AND date <= ? ORDER BY date ASC`,
        args: [rangeStart, rangeEnd],
      }),
      db.execute({
        sql: `SELECT f.id, f.investor_id, f.due_at, f.action_type, f.description, f.status, i.name as investor_name
              FROM followup_actions f
              LEFT JOIN investors i ON f.investor_id = i.id
              WHERE f.due_at >= ? AND f.due_at <= ? ORDER BY f.due_at ASC`,
        args: [rangeStart, rangeEnd],
      }),
      db.execute({
        sql: `SELECT t.id, t.investor_id, t.title, t.due_date, t.priority, t.status, i.name as investor_name
              FROM tasks t
              LEFT JOIN investors i ON t.investor_id = i.id
              WHERE t.due_date >= ? AND t.due_date <= ? AND t.status != 'completed'
              ORDER BY t.due_date ASC`,
        args: [rangeStart, rangeEnd],
      }),
    ]);

    const investors = investorRows.rows as unknown as InvestorRow[];
    const meetings = meetingRows.rows as unknown as (MeetingRow & { location?: string; investor_name?: string; duration_minutes?: number })[];
    const followups = followupRows.rows as unknown as (FollowupRow & { investor_name?: string; action_type?: string; description?: string })[];
    const tasks = taskRows.rows as unknown as { id: string; investor_id: string; title: string; due_date: string; priority: string; status: string; investor_name: string }[];

    const investorMap = new Map(investors.map(i => [i.id, i]));

    interface CalendarEvent {
      id: string;
      date: string;
      type: 'meeting' | 'followup' | 'task';
      title: string;
      investorId: string;
      investorName: string;
      investorTier: number;
      status: string;
      meta: Record<string, string | number | undefined>;
    }

    const events: CalendarEvent[] = [];

    for (const m of meetings) {
      const inv = investorMap.get(m.investor_id);
      events.push({
        id: m.id,
        date: m.date.split('T')[0],
        type: 'meeting',
        title: `${(m.type || 'meeting').replace(/_/g, ' ')} with ${m.investor_name || inv?.name || 'Unknown'}`,
        investorId: m.investor_id,
        investorName: m.investor_name || inv?.name || 'Unknown',
        investorTier: inv?.tier ?? 3,
        status: 'scheduled',
        meta: { meetingType: m.type, duration: m.duration_minutes, location: m.location },
      });
    }

    for (const f of followups) {
      const inv = investorMap.get(f.investor_id);
      const dueDate = (f.due_at || '').split('T')[0];
      events.push({
        id: f.id,
        date: dueDate,
        type: 'followup',
        title: `${(f.action_type || 'follow-up').replace(/_/g, ' ')}: ${(f.description || '').slice(0, 80)}`,
        investorId: f.investor_id,
        investorName: f.investor_name || inv?.name || 'Unknown',
        investorTier: inv?.tier ?? 3,
        status: f.status,
        meta: { actionType: f.action_type },
      });
    }

    for (const t of tasks) {
      const inv = investorMap.get(t.investor_id);
      events.push({
        id: t.id,
        date: (t.due_date || '').split('T')[0],
        type: 'task',
        title: t.title,
        investorId: t.investor_id,
        investorName: t.investor_name || inv?.name || 'Unknown',
        investorTier: inv?.tier ?? 3,
        status: t.status,
        meta: { priority: t.priority },
      });
    }

    events.sort((a, b) => a.date.localeCompare(b.date) || a.investorTier - b.investorTier);

    // Group by date
    const byDate: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!byDate[ev.date]) byDate[ev.date] = [];
      byDate[ev.date].push(ev);
    }

    // Summary
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = byDate[today] ?? [];
    const upcomingMeetings = events.filter(e => e.type === 'meeting' && e.date >= today).length;
    const overdueFU = events.filter(e => e.type === 'followup' && e.date < today && e.status === 'pending').length;
    const busyDays = Object.entries(byDate).filter(([, evts]) => evts.length >= 3).length;

    return NextResponse.json({
      events,
      byDate,
      summary: {
        totalEvents: events.length,
        todayCount: todayEvents.length,
        upcomingMeetings,
        overdueFollowups: overdueFU,
        busyDays,
        dateRange: { start: rangeStart, end: rangeEnd },
      },
      generated_at: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        'Server-Timing': `total;dur=${Date.now() - t0}`,
      },
    });
  } catch (error) {
    console.error('[CALENDAR_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to load calendar data' }, { status: 500 });
  }
}
