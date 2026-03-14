import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setConfig } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

const ALLOWED_KEYS = ['raise_config', 'scoring_weights', 'followup_cadence'];

export async function GET() {
  try {
    const results: Record<string, unknown> = {};
    for (const key of ALLOWED_KEYS) {
      const raw = await getConfig(key);
      results[key] = raw ? JSON.parse(raw) : null;
    }
    return NextResponse.json(results);
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

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
    return NextResponse.json({ success: true, key, value });
  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
