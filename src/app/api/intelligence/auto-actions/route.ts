import { NextResponse } from 'next/server';
import { generateAutoActions, getAccelerationActions } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

/**
 * POST /api/intelligence/auto-actions
 *
 * Triggers the autonomous action engine — evaluates all rules against current data,
 * creates acceleration_actions for new detections, and emits context changes.
 */
export async function POST() {
  try {
    const result = await generateAutoActions();

    // Emit context change for each action created
    for (const action of result.actionsCreated) {
      emitContextChange(
        'acceleration_executed',
        `Auto-action created: ${action.trigger_type} for ${action.investor_name || 'pipeline'} — ${action.action_type}`,
      );
    }

    return NextResponse.json({
      ...result,
      summary: result.actionsCreated.length > 0
        ? `Created ${result.actionsCreated.length} auto-action(s) from ${result.patternsDetected} detected pattern(s). ${result.skippedDuplicate} duplicate(s) skipped.`
        : `No new actions needed. ${result.patternsDetected} pattern(s) detected, all already have pending actions.`,
    });
  } catch (error) {
    console.error('Auto-action generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate auto-actions', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/intelligence/auto-actions
 *
 * Returns current pending auto-generated actions (identified by [AUTO] prefix in description).
 */
export async function GET() {
  try {
    const pending = await getAccelerationActions({ status: 'pending' });

    // Filter to auto-generated actions (they have [AUTO] prefix in description)
    const autoActions = pending.filter(a => a.description.startsWith('[AUTO]'));

    return NextResponse.json({
      autoActions,
      count: autoActions.length,
      totalPending: pending.length,
    });
  } catch (error) {
    console.error('Auto-action fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auto-actions', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
