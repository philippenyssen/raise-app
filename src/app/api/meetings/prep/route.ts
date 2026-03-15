import { NextRequest, NextResponse } from 'next/server';
import {
  getInvestor,
  getMeetings,
  getObjectionPlaybook,
  getQuestionPatternsForType,
  getProvenResponsesForTopics,
  getAggregatedCompetitiveIntel,
  getInvestorRelationships,
  getInvestorPartners,
  getInvestorPortfolio,
  getObjectionsByInvestor,
  computeEngagementVelocity,
  detectFomoDynamics,
  computeNetworkCascades,
  computeWinLossPatterns,
} from '@/lib/db';

/**
 * Meeting Prep Intelligence API
 *
 * Provides cross-investor synthesis for meeting preparation:
 * - Question patterns: what investors of this type typically ask
 * - Proven responses: what worked best when addressing each topic
 * - Competitive intel: aggregated from all meetings, not just this investor
 * - Network connections: relationships to other pipeline investors
 * - Unresolved objections: what still needs addressing
 *
 * GET /api/meetings/prep?investor_id=<id>
 */
export async function GET(req: NextRequest) {
  try {
    const investorId = req.nextUrl.searchParams.get('investor_id');
    if (!investorId) { return NextResponse.json({ error: 'investor_id is required' }, { status: 400 }); }

    const investor = await getInvestor(investorId);
    if (!investor) { return NextResponse.json({ error: 'Investor not found' }, { status: 404 }); }

    // Load all intelligence sources in parallel
    const [
      meetings,
      _investorObjections,
      playbook,
      typeQuestionPatterns,
      aggregatedCompetitiveIntel,
      investorRelationships,
      _partners,
      _portfolio,
    ] = await Promise.all([
      getMeetings(investorId),
      getObjectionsByInvestor(investorId),
      getObjectionPlaybook(),
      getQuestionPatternsForType(investor.type),
      getAggregatedCompetitiveIntel(),
      getInvestorRelationships(investorId).catch(() => []),
      getInvestorPartners(investorId).catch(() => []),
      getInvestorPortfolio(investorId).catch(() => []),]);

    // Get proven responses for the top objection topics
    const topObjectionTopics = playbook.slice(0, 10).map(p => p.topic);
    const provenResponses = await getProvenResponsesForTopics(topObjectionTopics);

    // Extract unresolved objections from this investor's meetings
    const unresolvedObjections: { text: string; severity: string; topic: string; meetingDate: string }[] = [];
    for (const m of meetings) {
      try {
        const objs = JSON.parse(m.objections || '[]') as Array<{
          text: string; severity: string; topic: string; addressed?: boolean; response_effectiveness?: string;
        }>;
        for (const o of objs) {
          if (!o.addressed && o.response_effectiveness !== 'resolved') {
            unresolvedObjections.push({
              text: o.text,
              severity: o.severity,
              topic: o.topic,
              meetingDate: m.date,});
          }}
      } catch { /* skip malformed */ }
    }

    // Build network context
    const networkConnections = investorRelationships.map(r => {
      const isA = r.investor_a_id === investorId;
      return {
        relatedInvestor: isA ? (r.investor_b_name || 'Unknown') : (r.investor_a_name || 'Unknown'),
        relatedInvestorId: isA ? r.investor_b_id : r.investor_a_id,
        relationshipType: r.relationship_type,
        theirStatus: isA ? (r.investor_b_status || 'unknown') : (r.investor_a_status || 'unknown'),
        theirEnthusiasm: isA ? (r.investor_b_enthusiasm || 0) : (r.investor_a_enthusiasm || 0),
        strength: r.strength,
        evidence: r.evidence,
      };});

    // Build the meeting prep intelligence response
    const prepIntel = {
      investor: {
        id: investor.id,
        name: investor.name,
        type: investor.type,
        tier: investor.tier,
        status: investor.status,
        enthusiasm: investor.enthusiasm,
        partner: investor.partner,},

      // Cross-investor question patterns: "Investors of type X typically ask about..."
      questionPatterns: {
        summary: typeQuestionPatterns.length > 0
          ? `${investor.type} investors most frequently ask about: ${typeQuestionPatterns.slice(0, 3).map(p => p.topic).join(', ')}`
          : `No question pattern data for ${investor.type} investors yet`,
        patterns: typeQuestionPatterns.slice(0, 8).map(p => ({
          topic: p.topic,
          frequency: p.questionCount,
          exampleQuestions: p.exampleQuestions,
          prepGuidance: `Prepare specific data points for "${p.topic}" — ${p.questionCount} ${investor.type} investors have asked about this`,
        })),},

      // Proven responses: "When asked about [topic], this response worked best"
      provenResponses: {
        summary: provenResponses.length > 0
          ? `${provenResponses.length} proven response(s) available from the objection playbook`
          : 'No proven responses yet — this meeting will help build the playbook',
        responses: provenResponses.map(r => ({
          topic: r.topic,
          bestResponse: r.bestResponse,
          effectiveness: r.effectiveness,
          enthusiasmLift: r.enthusiasmLift,
          guidance: r.enthusiasmLift > 0
            ? `This response lifted enthusiasm by +${r.enthusiasmLift} — use it or adapt it`
            : 'Effective response — consider adapting to this investor',
        })),},

      // Competitive intel: aggregated from all meetings
      competitiveIntel: {
        summary: aggregatedCompetitiveIntel.length > 0
          ? `${aggregatedCompetitiveIntel.length} competitor(s) mentioned across all meetings. Most discussed: ${aggregatedCompetitiveIntel.slice(0, 3).map(c => c.competitor).join(', ')}`
          : 'No competitive intel gathered from meetings yet',
        competitors: aggregatedCompetitiveIntel.slice(0, 8).map(c => ({
          name: c.competitor,
          mentionCount: c.mentionCount,
          mentionedBy: c.investors,
          latestMention: c.latestMention,
          context: c.context.slice(0, 3),
          prepGuidance: c.mentionCount >= 3
            ? `Frequently discussed competitor — prepare differentiation talking points`
            : c.mentionCount >= 2
            ? `Multiple investors have mentioned this — be ready to address`
            : `Mentioned by ${c.investors.join(', ')} — may come up`,
        })),},

      // Network connections: how this investor relates to others in pipeline
      networkConnections: {
        summary: networkConnections.length > 0
          ? `${investor.name} has ${networkConnections.length} connection(s) to other pipeline investors`
          : 'No network connections detected',
        connections: networkConnections.map(c => ({
          ...c,
          strategicImplication: c.theirStatus === 'closed' || c.theirStatus === 'term_sheet'
            ? `${c.relatedInvestor} has committed — use as social proof / reference`
            : c.theirEnthusiasm >= 4
            ? `${c.relatedInvestor} is enthusiastic — potential momentum signal to share`
            : c.theirStatus === 'passed'
            ? `${c.relatedInvestor} has passed — be prepared if asked about this`
            : `${c.relatedInvestor} is in process (${c.theirStatus}) — neutral reference`,
        })),},

      // Unresolved objections from prior meetings with this investor
      unresolvedObjections: {
        summary: unresolvedObjections.length > 0
          ? `${unresolvedObjections.length} unresolved objection(s) from previous meetings — MUST address`
          : 'No unresolved objections — clean slate',
        objections: unresolvedObjections.map(o => {
          // Find if there's a proven response for this topic
          const proven = provenResponses.find(r => r.topic === o.topic);
          return {
            ...o,
            suggestedResponse: proven
              ? `Proven response (${proven.effectiveness}): ${proven.bestResponse}`
              : 'No proven response — prepare a targeted answer',};
        }),},

      // Meeting history context
      meetingHistory: {
        totalMeetings: meetings.length,
        latestMeeting: meetings[0] ? {
          date: meetings[0].date,
          type: meetings[0].type,
          enthusiasm: meetings[0].enthusiasm_score,
          nextSteps: meetings[0].next_steps,
        } : null,
        enthusiasmTrajectory: meetings.map(m => ({
          date: m.date,
          score: m.enthusiasm_score,
        })).reverse(),},

      // Tactical intelligence: velocity, FOMO, cascades, win/loss (cycle 35)
      tacticalIntelligence: await (async () => {
        try {
          const [velocities, fomos, cascades, winLoss] = await Promise.all([
            computeEngagementVelocity().catch(() => []),
            detectFomoDynamics().catch(() => []),
            computeNetworkCascades().catch(() => []),
            computeWinLossPatterns().catch(() => null),]);

          const thisVelocity = velocities.find(v => v.investorId === investorId);
          const fomoForThis = fomos.find(f => f.affectedInvestors.some(a => a.name === investor.name));
          const cascadeForThis = cascades.find(c => c.cascadeChain.some(ch => ch.investorId === investorId));

          return {
            velocity: thisVelocity ? {
              acceleration: thisVelocity.acceleration,
              signal: thisVelocity.signal,
              daysSinceLastMeeting: thisVelocity.daysSinceLastMeeting,
              avgDaysBetween: thisVelocity.avgDaysBetweenMeetings,
            } : null,
            fomoPressure: fomoForThis ? {
              trigger: fomoForThis.advancingInvestor,
              advancingTo: fomoForThis.advancingTo,
              intensity: fomoForThis.fomoIntensity,
              recommendation: fomoForThis.recommendation,
            } : null,
            cascadeDependency: cascadeForThis ? {
              keystone: cascadeForThis.keystoneName,
              chainLength: cascadeForThis.cascadeChain.length,
              signal: cascadeForThis.signal,
            } : null,
            winLossSignal: winLoss ? {
              keyPredictors: winLoss.distinguishingFactors.filter(f => f.significance === 'high').slice(0, 3).map(f => ({ factor: f.factor, closedAvg: f.closedAvg, passedAvg: f.passedAvg })),
              insights: winLoss.insights.slice(0, 2),
            } : null,};
        } catch { return null; }
      })(),

      generatedAt: new Date().toISOString(),};

    return NextResponse.json(prepIntel);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to generate meeting prep intelligence' },
      { status: 500 },);
  }}
