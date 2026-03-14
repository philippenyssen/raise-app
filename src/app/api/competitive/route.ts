import { NextRequest, NextResponse } from 'next/server';
import { getMeetings } from '@/lib/db';

interface CompetitorEntry {
  name: string;
  mention_count: number;
  investors: string[];
  latest_mention: string;
  meetings: { meeting_id: string; investor_name: string; date: string }[];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const allMeetings = await getMeetings();

  const filtered = allMeetings.filter(m => {
    if (from && m.date < from) return false;
    if (to && m.date > to) return false;
    return true;
  });

  const competitorMap = new Map<string, CompetitorEntry>();

  for (const m of filtered) {
    let mentions: string[] = [];
    try {
      const parsed = JSON.parse(m.competitive_mentions || '[]');
      if (Array.isArray(parsed)) mentions = parsed;
    } catch { /* ignore parse errors */ }

    for (const name of mentions) {
      const normalized = name.trim();
      if (!normalized) continue;
      const key = normalized.toLowerCase();

      if (!competitorMap.has(key)) {
        competitorMap.set(key, {
          name: normalized,
          mention_count: 0,
          investors: [],
          latest_mention: m.date,
          meetings: [],
        });
      }

      const entry = competitorMap.get(key)!;
      entry.mention_count++;
      if (!entry.investors.includes(m.investor_name)) {
        entry.investors.push(m.investor_name);
      }
      if (m.date > entry.latest_mention) {
        entry.latest_mention = m.date;
      }
      entry.meetings.push({
        meeting_id: m.id,
        investor_name: m.investor_name,
        date: m.date,
      });
    }
  }

  const competitors = Array.from(competitorMap.values())
    .sort((a, b) => b.mention_count - a.mention_count);

  return NextResponse.json({
    competitors,
    total_meetings_scanned: filtered.length,
    date_range: { from: from || null, to: to || null },
  });
}
