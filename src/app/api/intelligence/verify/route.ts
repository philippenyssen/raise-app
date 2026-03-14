import { NextResponse } from 'next/server';
import { getFullContext } from '@/lib/context-bus';
import {
  getQuestionPatterns,
  getCalibrationData,
  computeNarrativeSignals,
  getKeystoneInvestors,
} from '@/lib/db';
import { createClient } from '@libsql/client';

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:raise.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
}

export async function GET() {
  const checks: HealthCheck[] = [];
  let ctx = null;

  // (a) Context bus builds successfully
  try {
    ctx = await getFullContext();
    checks.push({
      name: 'context_bus_build',
      status: 'pass',
      detail: `Context built successfully at version ${ctx.version}`,
    });
  } catch (err) {
    checks.push({
      name: 'context_bus_build',
      status: 'fail',
      detail: `Context bus failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
  }

  // (b) Data freshness
  if (ctx) {
    const buildAge = Date.now() - new Date(ctx.buildTimestamp).getTime();
    const ageMinutes = Math.round(buildAge / 60000);
    checks.push({
      name: 'data_freshness',
      status: ageMinutes < 60 ? 'pass' : ageMinutes < 1440 ? 'warn' : 'fail',
      detail: `Context version: ${ctx.version}, built ${ageMinutes} minute(s) ago (${ctx.buildTimestamp})`,
    });
  } else {
    checks.push({
      name: 'data_freshness',
      status: 'fail',
      detail: 'Cannot check freshness — context build failed',
    });
  }

  // (c) Count records in key intelligence tables
  const db = getClient();
  const tableCounts: Record<string, number> = {};
  const tables = ['question_patterns', 'prediction_log', 'investor_relationships', 'narrative_signals'];

  for (const table of tables) {
    try {
      const result = await db.execute(`SELECT COUNT(*) as cnt FROM ${table}`);
      const cnt = (result.rows[0] as unknown as { cnt: number }).cnt;
      tableCounts[table] = cnt;
      checks.push({
        name: `table_${table}`,
        status: cnt > 0 ? 'pass' : 'warn',
        detail: `${table}: ${cnt} record(s)`,
      });
    } catch (err) {
      checks.push({
        name: `table_${table}`,
        status: 'fail',
        detail: `Failed to query ${table}: ${err instanceof Error ? err.message : 'Unknown'}`,
      });
    }
  }

  // (d) Context bus includes all expected fields
  if (ctx) {
    const expectedFields: (keyof typeof ctx)[] = [
      'narrativeWeaknesses',
      'predictionCalibration',
      'narrativeDrift',
      'provenResponses',
      'keystoneInvestors',
    ];
    for (const field of expectedFields) {
      const value = ctx[field];
      const present = value !== undefined && value !== null;
      checks.push({
        name: `context_field_${field}`,
        status: present ? 'pass' : 'fail',
        detail: present
          ? `${field}: present (${Array.isArray(value) ? value.length + ' items' : typeof value})`
          : `${field}: MISSING from context`,
      });
    }
  }

  // (e) Verify supporting functions are callable
  const functionChecks = [
    { name: 'getQuestionPatterns', fn: () => getQuestionPatterns() },
    { name: 'getCalibrationData', fn: () => getCalibrationData() },
    { name: 'computeNarrativeSignals', fn: () => computeNarrativeSignals() },
    { name: 'getKeystoneInvestors', fn: () => getKeystoneInvestors() },
  ];

  for (const fc of functionChecks) {
    try {
      const result = await fc.fn();
      checks.push({
        name: `fn_${fc.name}`,
        status: 'pass',
        detail: `${fc.name}() returned ${Array.isArray(result) ? result.length + ' items' : 'data'}`,
      });
    } catch (err) {
      checks.push({
        name: `fn_${fc.name}`,
        status: 'fail',
        detail: `${fc.name}() failed: ${err instanceof Error ? err.message : 'Unknown'}`,
      });
    }
  }

  // Summary
  const passCount = checks.filter(c => c.status === 'pass').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const overallStatus = failCount > 0 ? 'unhealthy' : warnCount > 0 ? 'degraded' : 'healthy';

  return NextResponse.json({
    status: overallStatus,
    summary: `${passCount} pass, ${warnCount} warn, ${failCount} fail (${checks.length} total checks)`,
    checks,
    tableCounts,
    contextVersion: ctx?.version ?? null,
    contextBuildTimestamp: ctx?.buildTimestamp ?? null,
    verifiedAt: new Date().toISOString(),
  });
}
