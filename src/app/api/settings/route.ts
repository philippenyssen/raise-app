import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setConfig } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

const ALLOWED_KEYS = ['raise_config', 'scoring_weights', 'followup_cadence'];

export async function GET() {
  try {
    const results: Record<string, unknown> = {};
    for (const key of ALLOWED_KEYS) {
      const raw = await getConfig(key);
      if (raw) { try { results[key] = JSON.parse(raw); } catch { results[key] = null; } } else { results[key] = null; }
    }
    return NextResponse.json(results, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
  } catch (error) {
    console.error('[SETTINGS_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  try {
    const key = body.key as string;
    const value = body.value;

    if (!key || !ALLOWED_KEYS.includes(key)) {
      return NextResponse.json(
        { error: `Invalid config key. Allowed: ${ALLOWED_KEYS.join(', ')}` },
        { status: 400 }
      );
    }

    if (value === undefined || value === null) {
      return NextResponse.json({ error: 'Value is required' }, { status: 400 });
    }

    await setConfig(key, JSON.stringify(value));

    emitContextChange('settings_updated', `Config key "${key}" updated`);
    return NextResponse.json({ ok: true, key, value });
  } catch (error) {
    console.error('[SETTINGS_PUT]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
