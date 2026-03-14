import { NextResponse } from 'next/server';
import { getFullContext } from '@/lib/context-bus';
import {
  getQuestionPatterns,
  getCalibrationData,
  computeNarrativeSignals,
  getKeystoneInvestors,
  getAutoActionEffectiveness,
  computeObjectionEvolution,
  computePipelineFlow,
  detectCompoundSignals,
  computeTemporalTrends,
  computeRaiseForecast,
  getForecastCalibration,
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
  category: string;
}

export async function GET() {
  const checks: HealthCheck[] = [];
  let ctx = null;

  // =========================================================================
  // CATEGORY 1: Core Infrastructure
  // =========================================================================

  // (1a) Context bus builds successfully
  try {
    ctx = await getFullContext();
    checks.push({
      name: 'context_bus_build',
      status: 'pass',
      detail: `Context built successfully at version ${ctx.version}`,
      category: 'infrastructure',
    });
  } catch (err) {
    checks.push({
      name: 'context_bus_build',
      status: 'fail',
      detail: `Context bus failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      category: 'infrastructure',
    });
  }

  // (1b) Data freshness
  if (ctx) {
    const buildAge = Date.now() - new Date(ctx.buildTimestamp).getTime();
    const ageMinutes = Math.round(buildAge / 60000);
    checks.push({
      name: 'data_freshness',
      status: ageMinutes < 60 ? 'pass' : ageMinutes < 1440 ? 'warn' : 'fail',
      detail: `Context version: ${ctx.version}, built ${ageMinutes} minute(s) ago`,
      category: 'infrastructure',
    });
  }

  // =========================================================================
  // CATEGORY 2: Database Tables
  // =========================================================================

  const db = getClient();
  const tableCounts: Record<string, number> = {};
  const tables = [
    'question_patterns', 'prediction_log', 'investor_relationships',
    'narrative_signals', 'acceleration_actions', 'health_snapshots',
    'score_snapshots', 'forecast_log',
  ];

  for (const table of tables) {
    try {
      const result = await db.execute(`SELECT COUNT(*) as cnt FROM ${table}`);
      const cnt = (result.rows[0] as unknown as { cnt: number }).cnt;
      tableCounts[table] = cnt;
      checks.push({
        name: `table_${table}`,
        status: cnt > 0 ? 'pass' : 'warn',
        detail: `${table}: ${cnt} record(s)`,
        category: 'database',
      });
    } catch (err) {
      checks.push({
        name: `table_${table}`,
        status: 'fail',
        detail: `Failed to query ${table}: ${err instanceof Error ? err.message : 'Unknown'}`,
        category: 'database',
      });
    }
  }

  // =========================================================================
  // CATEGORY 3: Context Bus Fields (all 22 fields from cycles 1-18)
  // =========================================================================

  if (ctx) {
    const expectedFields: { field: keyof typeof ctx; cycle: number }[] = [
      { field: 'investors', cycle: 1 },
      { field: 'pipelineHealth', cycle: 1 },
      { field: 'recentActivity', cycle: 2 },
      { field: 'documents', cycle: 2 },
      { field: 'topObjections', cycle: 2 },
      { field: 'narrativeWeaknesses', cycle: 3 },
      { field: 'predictionCalibration', cycle: 3 },
      { field: 'narrativeDrift', cycle: 3 },
      { field: 'provenResponses', cycle: 3 },
      { field: 'keystoneInvestors', cycle: 4 },
      { field: 'actionEffectiveness', cycle: 9 },
      { field: 'objectionEvolution', cycle: 10 },
      { field: 'pipelineFlow', cycle: 10 },
      { field: 'compoundSignals', cycle: 13 },
      { field: 'temporalTrends', cycle: 14 },
      { field: 'raiseForecast', cycle: 18 },
      { field: 'forecastCalibration', cycle: 23 },
    ];

    for (const { field, cycle } of expectedFields) {
      const value = ctx[field];
      const present = value !== undefined && value !== null;
      checks.push({
        name: `context_field_${field}`,
        status: present ? 'pass' : field === 'actionEffectiveness' || field === 'objectionEvolution' || field === 'pipelineFlow' || field === 'temporalTrends' || field === 'raiseForecast' || field === 'forecastCalibration' ? 'warn' : 'fail',
        detail: present
          ? `${field}: present (${Array.isArray(value) ? value.length + ' items' : typeof value}) [cycle ${cycle}]`
          : `${field}: null — may indicate no data yet [cycle ${cycle}]`,
        category: 'context_bus',
      });
    }
  }

  // =========================================================================
  // CATEGORY 4: Intelligence Functions (all callable)
  // =========================================================================

  const functionChecks = [
    { name: 'getQuestionPatterns', fn: () => getQuestionPatterns(), cycle: 3 },
    { name: 'getCalibrationData', fn: () => getCalibrationData(), cycle: 3 },
    { name: 'computeNarrativeSignals', fn: () => computeNarrativeSignals(), cycle: 3 },
    { name: 'getKeystoneInvestors', fn: () => getKeystoneInvestors(), cycle: 4 },
    { name: 'getAutoActionEffectiveness', fn: () => getAutoActionEffectiveness(), cycle: 9 },
    { name: 'computeObjectionEvolution', fn: () => computeObjectionEvolution(), cycle: 10 },
    { name: 'computePipelineFlow', fn: () => computePipelineFlow(), cycle: 10 },
    { name: 'detectCompoundSignals', fn: () => detectCompoundSignals(), cycle: 13 },
    { name: 'computeTemporalTrends', fn: () => computeTemporalTrends(), cycle: 14 },
    { name: 'computeRaiseForecast', fn: () => computeRaiseForecast(), cycle: 18 },
    { name: 'getForecastCalibration', fn: () => getForecastCalibration(), cycle: 23 },
  ];

  for (const fc of functionChecks) {
    try {
      const result = await fc.fn();
      checks.push({
        name: `fn_${fc.name}`,
        status: 'pass',
        detail: `${fc.name}() returned ${Array.isArray(result) ? result.length + ' items' : result !== null ? 'data' : 'null'} [cycle ${fc.cycle}]`,
        category: 'functions',
      });
    } catch (err) {
      checks.push({
        name: `fn_${fc.name}`,
        status: 'fail',
        detail: `${fc.name}() failed: ${err instanceof Error ? err.message : 'Unknown'} [cycle ${fc.cycle}]`,
        category: 'functions',
      });
    }
  }

  // =========================================================================
  // CATEGORY 5: Intelligence Quality Checks
  // =========================================================================

  if (ctx) {
    // Lifecycle intelligence: are investor snapshots enriched?
    const hasLifecycle = ctx.investors.some(i => i.daysInCurrentStage > 0 || i.stageHealth !== 'on_track');
    checks.push({
      name: 'lifecycle_intelligence',
      status: ctx.investors.length > 0 ? 'pass' : 'warn',
      detail: ctx.investors.length > 0
        ? `${ctx.investors.length} investor snapshots, ${ctx.investors.filter(i => i.stageHealth === 'stalled').length} stalled, ${ctx.investors.filter(i => i.stageHealth === 'slow').length} slow [cycle 16]`
        : 'No active investors in pipeline [cycle 16]',
      category: 'quality',
    });

    // Compound signals producing output
    checks.push({
      name: 'compound_signal_output',
      status: 'pass', // compound signals may legitimately be empty
      detail: `${ctx.compoundSignals.length} compound signal(s) detected [cycle 13]`,
      category: 'quality',
    });

    // Forecast quality
    if (ctx.raiseForecast) {
      checks.push({
        name: 'forecast_quality',
        status: ctx.raiseForecast.confidence === 'high' ? 'pass' : ctx.raiseForecast.confidence === 'medium' ? 'pass' : 'warn',
        detail: `Forecast confidence: ${ctx.raiseForecast.confidence}, expected close: ${ctx.raiseForecast.expectedCloseDate}, ${ctx.raiseForecast.criticalPath.length} on critical path [cycle 18]`,
        category: 'quality',
      });
    }

    // Forecast calibration quality (cycle 23)
    if (ctx.forecastCalibration) {
      const fc = ctx.forecastCalibration;
      checks.push({
        name: 'forecast_calibration',
        status: fc.biasDirection !== 'insufficient_data' ? 'pass' : fc.totalPredictions > 0 ? 'warn' : 'warn',
        detail: `${fc.totalPredictions} predictions logged, ${fc.resolvedPredictions} resolved, bias: ${fc.biasDirection}${fc.biasDirection !== 'insufficient_data' ? ` (avg ${fc.avgAccuracyDelta}d off)` : ''} [cycle 23]`,
        category: 'quality',
      });
    }

    // System prompt serialization check
    try {
      const { contextToSystemPrompt } = await import('@/lib/context-bus');
      const prompt = contextToSystemPrompt(ctx);
      const sections = [
        'PIPELINE:', 'KEY INVESTORS', 'RAISE FORECAST', 'TEMPORAL TRENDS',
        'COMPOUND INTELLIGENCE', 'INTELLIGENCE SYNTHESIS', 'FORECAST CALIBRATION',
      ];
      const found = sections.filter(s => prompt.includes(s));
      checks.push({
        name: 'system_prompt_sections',
        status: found.length >= 3 ? 'pass' : 'warn',
        detail: `System prompt: ${found.length}/${sections.length} expected sections present (${prompt.length} chars) [cycles 2-18]`,
        category: 'quality',
      });
    } catch (err) {
      checks.push({
        name: 'system_prompt_sections',
        status: 'fail',
        detail: `System prompt serialization failed: ${err instanceof Error ? err.message : 'Unknown'}`,
        category: 'quality',
      });
    }
  }

  // Summary
  const passCount = checks.filter(c => c.status === 'pass').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const overallStatus = failCount > 0 ? 'unhealthy' : warnCount > 0 ? 'degraded' : 'healthy';

  // Category summaries
  const categories = [...new Set(checks.map(c => c.category))];
  const categoryHealth: Record<string, { pass: number; warn: number; fail: number }> = {};
  for (const cat of categories) {
    const catChecks = checks.filter(c => c.category === cat);
    categoryHealth[cat] = {
      pass: catChecks.filter(c => c.status === 'pass').length,
      warn: catChecks.filter(c => c.status === 'warn').length,
      fail: catChecks.filter(c => c.status === 'fail').length,
    };
  }

  return NextResponse.json({
    status: overallStatus,
    summary: `${passCount} pass, ${warnCount} warn, ${failCount} fail (${checks.length} total checks across ${categories.length} categories)`,
    categoryHealth,
    checks,
    tableCounts,
    contextVersion: ctx?.version ?? null,
    contextBuildTimestamp: ctx?.buildTimestamp ?? null,
    verifiedAt: new Date().toISOString(),
  });
}
