import type { Investor, Meeting, InvestorPortfolioCo, IntelligenceBrief, Objection, EngagementSignal, InvestorStatus } from './types';
import type { ScoreSnapshot } from './db';
import { computeNetworkEffectData } from './db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreDimension {
  name: string;
  score: number; // 0-100
  signal: 'strong' | 'moderate' | 'weak' | 'unknown';
  evidence: string;
}

export interface InvestorScore {
  overall: number; // 0-100
  dimensions: ScoreDimension[];
  momentum: 'accelerating' | 'steady' | 'decelerating' | 'stalled';
  predictedOutcome: 'likely_close' | 'possible' | 'long_shot' | 'unlikely';
  nextBestAction: string;
  risks: string[];
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function signal(score: number): 'strong' | 'moderate' | 'weak' | 'unknown' {
  if (score >= 70) return 'strong';
  if (score >= 40) return 'moderate';
  if (score > 0) return 'weak';
  return 'unknown';
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return Math.abs(da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24);
}

function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Parse a money string like "$50-100M", "€25M", "50M-100M" into [low, high] in millions */
function parseMoneyRange(s: string): [number, number] | null {
  if (!s) return null;
  const cleaned = s.replace(/[€$£,]/g, '').trim().toLowerCase();

  // Try range: "50-100m", "50m-100m"
  const rangeMatch = cleaned.match(/([\d.]+)\s*m?\s*[-–to]+\s*([\d.]+)\s*m/i);
  if (rangeMatch) {
    return [parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2])];
  }

  // Try single value: "100m", "2b", "500k"
  const singleMatch = cleaned.match(/([\d.]+)\s*(m|b|k|bn|million|billion)?/i);
  if (singleMatch) {
    let val = parseFloat(singleMatch[1]);
    const unit = (singleMatch[2] || '').toLowerCase();
    if (unit === 'b' || unit === 'bn' || unit === 'billion') val *= 1000;
    if (unit === 'k') val /= 1000;
    // If no unit and value >= 1000, assume it's already in millions (unlikely for check sizes)
    return [val * 0.8, val * 1.2]; // +/- 20% for single values
  }

  return null;
}

// ---------------------------------------------------------------------------
// Status progression ordering (higher = further along)
// ---------------------------------------------------------------------------

const STATUS_PROGRESSION: Record<InvestorStatus, number> = {
  identified: 0,
  contacted: 1,
  nda_signed: 2,
  meeting_scheduled: 3,
  met: 4,
  engaged: 5,
  in_dd: 6,
  term_sheet: 7,
  closed: 8,
  passed: -1,
  dropped: -1,
};

// ---------------------------------------------------------------------------
// Dimension Scorers
// ---------------------------------------------------------------------------

export function computeEngagementScore(
  investor: Investor,
  meetings: Meeting[],
): ScoreDimension {
  if (meetings.length === 0) {
    // No meetings — score based only on status
    const statusPts = STATUS_PROGRESSION[investor.status] ?? 0;
    const score = clamp(statusPts * 8);
    return {
      name: 'Engagement',
      score,
      signal: signal(score),
      evidence: meetings.length === 0
        ? `No meetings yet. Status: ${investor.status}`
        : `${meetings.length} meetings`,
    };
  }

  const now = new Date().toISOString();
  const sorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];

  // Meeting count score (0-25): 1=5, 2=10, 3=15, 4=20, 5+=25
  const countPts = Math.min(25, meetings.length * 5);

  // Recency score (0-25): meeting within 7 days=25, 14d=20, 30d=12, 60d=5, 90d+=0
  const daysSinceLast = daysBetween(latest.date, now);
  let recencyPts = 0;
  if (daysSinceLast <= 7) recencyPts = 25;
  else if (daysSinceLast <= 14) recencyPts = 20;
  else if (daysSinceLast <= 30) recencyPts = 12;
  else if (daysSinceLast <= 60) recencyPts = 5;

  // Enthusiasm score (0-25): recency-weighted enthusiasm (recent meetings count 3x more)
  const latestTime = new Date(sorted[sorted.length - 1]?.date || new Date().toISOString()).getTime();
  let enthWeightedSum = 0;
  let enthWeightTotal = 0;
  for (const m of meetings) {
    const age = Math.max(0, (latestTime - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24));
    const decay = Math.exp(-age / 30); // half-life ~21 days
    const weight = Math.max(0.1, decay);
    enthWeightedSum += (m.enthusiasm_score || 0) * weight;
    enthWeightTotal += weight;
  }
  const avgEnthusiasm = enthWeightTotal > 0 ? enthWeightedSum / enthWeightTotal : 0;
  const enthPts = clamp((avgEnthusiasm / 5) * 25, 0, 25);

  // Engagement signals score (0-25): check for high-signal behaviors
  let signalPts = 0;
  for (const m of meetings) {
    const signals = parseJsonSafe<Partial<EngagementSignal>>(m.engagement_signals, {});
    if (signals.asked_about_process) signalPts += 4;
    if (signals.asked_about_timeline) signalPts += 4;
    if (signals.requested_followup) signalPts += 5;
    if (signals.body_language_at_pricing === 'positive') signalPts += 4;
  }
  signalPts = Math.min(25, signalPts);

  const score = clamp(countPts + recencyPts + enthPts + signalPts);
  const evidence = `${meetings.length} meetings, last ${Math.round(daysSinceLast)}d ago, avg enthusiasm ${avgEnthusiasm.toFixed(1)}/5`;

  return { name: 'Engagement', score, signal: signal(score), evidence };
}

export function computeThesisFitScore(
  investor: Investor,
  portfolio: InvestorPortfolioCo[],
): ScoreDimension {
  const thesis = (investor.sector_thesis || '').toLowerCase();
  if (!thesis) {
    return { name: 'Thesis Fit', score: 0, signal: 'unknown', evidence: 'No sector thesis data available' };
  }

  // Check for relevant keywords
  const relevantKeywords = [
    'space', 'aerospace', 'defense', 'defence', 'satellite', 'deeptech', 'deep tech',
    'hardware', 'industrial', 'manufacturing', 'climate', 'govtech', 'government',
    'infrastructure', 'sar', 'earth observation', 'security', 'dual-use', 'dual use',
    'european', 'europe', 'sovereignty', 'frontier', 'hard tech',
  ];
  const partialKeywords = [
    'tech', 'b2b', 'enterprise', 'growth', 'generalist',
  ];

  let keywordScore = 0;
  let matchedKeywords: string[] = [];
  for (const kw of relevantKeywords) {
    if (thesis.includes(kw)) {
      keywordScore += 10;
      matchedKeywords.push(kw);
    }
  }
  for (const kw of partialKeywords) {
    if (thesis.includes(kw)) {
      keywordScore += 3;
      matchedKeywords.push(kw);
    }
  }
  keywordScore = Math.min(60, keywordScore);

  // Portfolio relevance bonus (0-40): scan portfolio companies for overlap
  let portfolioBonus = 0;
  let relevantPortfolio: string[] = [];
  for (const co of portfolio) {
    const sector = (co.sector || '').toLowerCase();
    const relevance = (co.relevance || '').toLowerCase();
    if (relevance.includes('synergy') || relevance.includes('relevant')) {
      portfolioBonus += 10;
      relevantPortfolio.push(co.company);
    } else if (sector && relevantKeywords.some(kw => sector.includes(kw))) {
      portfolioBonus += 8;
      relevantPortfolio.push(co.company);
    }
  }
  portfolioBonus = Math.min(40, portfolioBonus);

  const score = clamp(keywordScore + portfolioBonus);
  const evidence = matchedKeywords.length > 0
    ? `Thesis matches: ${matchedKeywords.slice(0, 4).join(', ')}${relevantPortfolio.length > 0 ? `. Relevant portfolio: ${relevantPortfolio.slice(0, 3).join(', ')}` : ''}`
    : `Thesis: "${thesis.slice(0, 60)}${thesis.length > 60 ? '...' : ''}"`;

  return { name: 'Thesis Fit', score, signal: signal(score), evidence };
}

export function computeCheckSizeFitScore(
  investor: Investor,
  targetEquityM: number, // total raise in millions
): ScoreDimension {
  const checkRange = parseMoneyRange(investor.check_size_range);
  if (!checkRange) {
    return { name: 'Check Size Fit', score: 0, signal: 'unknown', evidence: 'No check size data available' };
  }

  const [low, high] = checkRange;
  // Typical lead check = 15-30% of round, co-lead = 10-20%, participant = 5-15%
  const idealLeadLow = targetEquityM * 0.15;
  const idealLeadHigh = targetEquityM * 0.35;

  let score: number;
  if (high >= idealLeadLow && low <= idealLeadHigh) {
    // Perfect fit — their range overlaps with lead check range
    score = 90;
  } else if (high >= targetEquityM * 0.05 && low <= targetEquityM * 0.5) {
    // Reasonable fit — can participate meaningfully
    score = 65;
  } else if (high < targetEquityM * 0.05) {
    // Too small
    score = 20;
  } else if (low > targetEquityM * 0.5) {
    // Too large (rare issue, usually fine)
    score = 50;
  } else {
    score = 30;
  }

  const evidence = `Check range: ${investor.check_size_range} vs ${targetEquityM}M raise (lead: ${Math.round(idealLeadLow)}-${Math.round(idealLeadHigh)}M)`;

  return { name: 'Check Size Fit', score: clamp(score), signal: signal(score), evidence };
}

export function computeSpeedMatchScore(
  investor: Investor,
  targetCloseDate: string | null,
): ScoreDimension {
  const speed = (investor.speed || 'medium').toLowerCase();
  const icProcess = (investor.ic_process || '').toLowerCase();

  // Base speed score
  let baseScore: number;
  if (speed === 'fast') baseScore = 90;
  else if (speed === 'medium') baseScore = 60;
  else baseScore = 30;

  // IC process adjustments
  if (icProcess.includes('weekly') || icProcess.includes('fast') || icProcess.includes('quick')) {
    baseScore += 10;
  }
  if (icProcess.includes('monthly') || icProcess.includes('quarterly')) {
    baseScore -= 15;
  }
  if (icProcess.includes('committee') || icProcess.includes('board')) {
    baseScore -= 5; // Slight penalty for formal process
  }

  // Timeline pressure: if target close is soon and they're slow, bigger penalty
  if (targetCloseDate) {
    const daysToClose = daysBetween(new Date().toISOString(), targetCloseDate);
    if (daysToClose < 60 && speed === 'slow') {
      baseScore -= 20;
    } else if (daysToClose < 90 && speed === 'slow') {
      baseScore -= 10;
    }
  }

  const score = clamp(baseScore);
  const evidence = `Speed: ${investor.speed}${icProcess ? `. IC: ${icProcess.slice(0, 60)}` : ''}`;

  return { name: 'Speed Match', score, signal: signal(score), evidence };
}

export function computeConflictRiskScore(
  investor: Investor,
  portfolio: InvestorPortfolioCo[],
): ScoreDimension {
  const conflicts = (investor.portfolio_conflicts || '').toLowerCase().trim();

  // Check explicit conflict field
  let hasExplicitConflict = false;
  let conflictSeverity = 0;

  if (conflicts) {
    hasExplicitConflict = true;
    if (conflicts.includes('direct') || conflicts.includes('competitive') || conflicts.includes('conflict')) {
      conflictSeverity = 3;
    } else if (conflicts.includes('adjacent') || conflicts.includes('overlap') || conflicts.includes('similar')) {
      conflictSeverity = 2;
    } else if (conflicts.includes('none') || conflicts.includes('no conflict') || conflicts.includes('clear') || conflicts.includes('n/a')) {
      hasExplicitConflict = false;
      conflictSeverity = 0;
    } else {
      conflictSeverity = 1;
    }
  }

  // Check portfolio companies for conflict signals
  let portfolioConflicts = 0;
  let conflictCompanies: string[] = [];
  for (const co of portfolio) {
    const relevance = (co.relevance || '').toLowerCase();
    if (relevance.includes('conflict') || relevance.includes('compet')) {
      portfolioConflicts++;
      conflictCompanies.push(co.company);
    }
  }

  // Score: 100 = no conflict, 0 = severe conflict
  let score: number;
  if (!hasExplicitConflict && portfolioConflicts === 0) {
    score = portfolio.length > 0 ? 95 : 70; // high if verified, moderate if unknown
  } else if (conflictSeverity >= 3 || portfolioConflicts >= 2) {
    score = 15;
  } else if (conflictSeverity >= 2 || portfolioConflicts >= 1) {
    score = 40;
  } else {
    score = 60;
  }

  let evidence: string;
  if (conflictCompanies.length > 0) {
    evidence = `Potential conflicts: ${conflictCompanies.join(', ')}`;
  } else if (hasExplicitConflict) {
    evidence = `Conflicts noted: ${investor.portfolio_conflicts.slice(0, 80)}`;
  } else if (portfolio.length > 0) {
    evidence = `${portfolio.length} portfolio companies reviewed, no conflicts identified`;
  } else {
    evidence = 'No portfolio data to assess conflicts';
  }

  return { name: 'Conflict Risk', score: clamp(score), signal: signal(score), evidence };
}

export function computeWarmPathScore(investor: Investor): ScoreDimension {
  const path = (investor.warm_path || '').toLowerCase().trim();

  if (!path) {
    return { name: 'Warm Path', score: 0, signal: 'unknown', evidence: 'No intro path specified' };
  }

  // Score based on intro quality
  let score: number;
  if (path.includes('board') || path.includes('founder') || path.includes('ceo') || path.includes('partner intro') || path.includes('lp')) {
    score = 95; // Board member, CEO, or partner-level intro
  } else if (path.includes('portfolio') || path.includes('co-investor') || path.includes('mutual') || path.includes('advisor')) {
    score = 80; // Portfolio company or co-investor intro
  } else if (path.includes('banker') || path.includes('placement') || path.includes('intermediary')) {
    score = 65; // Banker/placement agent
  } else if (path.includes('conference') || path.includes('event') || path.includes('met at')) {
    score = 50; // Conference connection
  } else if (path.includes('cold') || path.includes('inbound') || path.includes('website')) {
    score = 25; // Cold outreach
  } else if (path.includes('linkedin') || path.includes('email')) {
    score = 30; // Digital outreach
  } else {
    // Has some path info but unclear quality
    score = 45;
  }

  return {
    name: 'Warm Path',
    score: clamp(score),
    signal: signal(score),
    evidence: `Path: ${investor.warm_path.slice(0, 80)}`,
  };
}

export function computeMeetingQualityScore(
  meetings: Meeting[],
): ScoreDimension {
  if (meetings.length === 0) {
    return { name: 'Meeting Quality', score: 0, signal: 'unknown', evidence: 'No meetings logged' };
  }

  let totalScore = 0;
  let showstopperCount = 0;
  let significantCount = 0;
  let unresolvedCount = 0;
  let totalDuration = 0;
  let deepDiveCount = 0;

  for (const m of meetings) {
    // Meeting type quality
    const typeScores: Record<string, number> = {
      intro: 2,
      management_presentation: 4,
      deep_dive: 6,
      site_visit: 7,
      dd_session: 8,
      negotiation: 9,
      social: 3,
    };
    totalScore += typeScores[m.type] || 2;

    if (m.type === 'deep_dive' || m.type === 'dd_session' || m.type === 'site_visit') {
      deepDiveCount++;
    }

    totalDuration += m.duration_minutes || 60;

    // Objection analysis
    const objs = parseJsonSafe<Objection[]>(m.objections, []);
    for (const o of objs) {
      if (o.severity === 'showstopper') showstopperCount++;
      if (o.severity === 'significant') significantCount++;
      if (o.response_effectiveness === 'unresolved') unresolvedCount++;
    }
  }

  // Normalize meeting type score (0-30)
  const typePts = Math.min(30, (totalScore / meetings.length) * 3.3);

  // Duration score (0-20): longer = more engaged, avg meeting > 60 min is good
  const avgDuration = totalDuration / meetings.length;
  const durationPts = clamp(Math.min(20, (avgDuration / 90) * 20), 0, 20);

  // Deep dive bonus (0-20): having advanced meeting types
  const deepDivePts = Math.min(20, deepDiveCount * 10);

  // Objection penalty (0 to -30)
  const objPenalty = Math.min(30, showstopperCount * 15 + significantCount * 5 + unresolvedCount * 8);

  // Progression bonus (0-30): are meetings progressing in type?
  const sorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date));
  let progressionPts = 0;
  if (sorted.length >= 2) {
    const first = typeScores(sorted[0].type);
    const last = typeScores(sorted[sorted.length - 1].type);
    if (last > first) progressionPts = 20;
    else if (last === first && meetings.length > 1) progressionPts = 10;
  }

  const score = clamp(typePts + durationPts + deepDivePts + progressionPts - objPenalty);

  const parts: string[] = [];
  parts.push(`${meetings.length} meetings`);
  parts.push(`avg ${Math.round(avgDuration)}min`);
  if (deepDiveCount > 0) parts.push(`${deepDiveCount} deep engagements`);
  if (showstopperCount > 0) parts.push(`${showstopperCount} showstoppers`);
  if (unresolvedCount > 0) parts.push(`${unresolvedCount} unresolved`);

  return { name: 'Meeting Quality', score, signal: signal(score), evidence: parts.join(', ') };
}

function typeScores(type: string): number {
  const scores: Record<string, number> = {
    intro: 2,
    management_presentation: 4,
    deep_dive: 6,
    site_visit: 7,
    dd_session: 8,
    negotiation: 9,
    social: 3,
  };
  return scores[type] || 2;
}

export function computeMomentumScore(
  investor: Investor,
  meetings: Meeting[],
): { momentum: 'accelerating' | 'steady' | 'decelerating' | 'stalled'; score: number; evidence: string } {
  if (meetings.length === 0) {
    // No meetings: check status age
    const statusIdx = STATUS_PROGRESSION[investor.status] ?? 0;
    if (statusIdx <= 0) {
      return { momentum: 'stalled', score: 10, evidence: `Status: ${investor.status}, no meetings` };
    }
    return { momentum: 'stalled', score: 20, evidence: `Status: ${investor.status}, no meetings logged` };
  }

  const sorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date));
  const now = new Date().toISOString();
  const latestMeeting = sorted[sorted.length - 1];
  const daysSinceLatest = daysBetween(latestMeeting.date, now);

  // 1. Enthusiasm trend (most important signal)
  let enthTrend: 'up' | 'flat' | 'down' = 'flat';
  if (sorted.length >= 2) {
    const recentAvg = sorted.slice(-Math.min(2, sorted.length)).reduce((s, m) => s + m.enthusiasm_score, 0) / Math.min(2, sorted.length);
    const earlierAvg = sorted.slice(0, Math.max(1, sorted.length - 2)).reduce((s, m) => s + m.enthusiasm_score, 0) / Math.max(1, sorted.length - 2);
    if (recentAvg > earlierAvg + 0.3) enthTrend = 'up';
    else if (recentAvg < earlierAvg - 0.3) enthTrend = 'down';
  }

  // 2. Meeting frequency trend
  let freqTrend: 'up' | 'flat' | 'down' = 'flat';
  if (sorted.length >= 3) {
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
    }
    const firstHalf = gaps.slice(0, Math.ceil(gaps.length / 2));
    const secondHalf = gaps.slice(Math.ceil(gaps.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    if (secondAvg < firstAvg * 0.7) freqTrend = 'up'; // meetings getting closer together
    else if (secondAvg > firstAvg * 1.5) freqTrend = 'down'; // meetings getting further apart
  }

  // 3. Meeting type progression
  let typeTrend: 'up' | 'flat' | 'down' = 'flat';
  if (sorted.length >= 2) {
    const firstType = typeScores(sorted[0].type);
    const lastType = typeScores(sorted[sorted.length - 1].type);
    if (lastType > firstType) typeTrend = 'up';
    else if (lastType < firstType) typeTrend = 'down';
  }

  // Determine momentum
  const upSignals = [enthTrend, freqTrend, typeTrend].filter(t => t === 'up').length;
  const downSignals = [enthTrend, freqTrend, typeTrend].filter(t => t === 'down').length;

  let momentum: 'accelerating' | 'steady' | 'decelerating' | 'stalled';
  let score: number;

  if (daysSinceLatest > 45) {
    momentum = 'stalled';
    score = 15;
  } else if (daysSinceLatest > 30) {
    momentum = downSignals > 0 ? 'decelerating' : 'stalled';
    score = 25;
  } else if (upSignals >= 2) {
    momentum = 'accelerating';
    score = 90;
  } else if (downSignals >= 2) {
    momentum = 'decelerating';
    score = 30;
  } else if (upSignals > downSignals) {
    momentum = 'accelerating';
    score = 75;
  } else if (downSignals > upSignals) {
    momentum = 'decelerating';
    score = 35;
  } else {
    momentum = 'steady';
    score = 55;
  }

  const evidenceParts: string[] = [];
  if (enthTrend !== 'flat') evidenceParts.push(`enthusiasm ${enthTrend}`);
  if (freqTrend !== 'flat') evidenceParts.push(`frequency ${freqTrend}`);
  if (typeTrend !== 'flat') evidenceParts.push(`depth ${typeTrend}`);
  evidenceParts.push(`last meeting ${Math.round(daysSinceLatest)}d ago`);

  return { momentum, score, evidence: evidenceParts.join(', ') };
}

// ---------------------------------------------------------------------------
// Predicted Outcome
// ---------------------------------------------------------------------------

function predictOutcome(overall: number, momentum: string, investor: Investor): 'likely_close' | 'possible' | 'long_shot' | 'unlikely' {
  const status = investor.status;

  // Terminal states
  if (status === 'closed') return 'likely_close';
  if (status === 'passed' || status === 'dropped') return 'unlikely';

  // Term sheet stage
  if (status === 'term_sheet') {
    if (overall >= 50) return 'likely_close';
    return 'possible';
  }

  // DD stage
  if (status === 'in_dd') {
    if (overall >= 60 && momentum === 'accelerating') return 'likely_close';
    if (overall >= 45) return 'possible';
    return 'long_shot';
  }

  // Earlier stages: mostly driven by score
  if (overall >= 75 && momentum === 'accelerating') return 'likely_close';
  if (overall >= 55) return 'possible';
  if (overall >= 30) return 'long_shot';
  return 'unlikely';
}

// ---------------------------------------------------------------------------
// Risk Identification
// ---------------------------------------------------------------------------

function identifyRisks(
  investor: Investor,
  meetings: Meeting[],
  dimensions: ScoreDimension[],
  momentum: string,
): string[] {
  const risks: string[] = [];

  // Check dimension-based risks
  const dimMap = new Map(dimensions.map(d => [d.name, d]));

  const conflict = dimMap.get('Conflict Risk');
  if (conflict && conflict.score < 50) {
    risks.push(`Portfolio conflict detected: ${conflict.evidence}`);
  }

  const checkFit = dimMap.get('Check Size Fit');
  if (checkFit && checkFit.score < 40 && checkFit.signal !== 'unknown') {
    risks.push(`Check size mismatch: ${checkFit.evidence}`);
  }

  const speedMatch = dimMap.get('Speed Match');
  if (speedMatch && speedMatch.score < 40) {
    risks.push(`Timeline misalignment: investor process may be too slow for fundraise`);
  }

  const warmPath = dimMap.get('Warm Path');
  if (warmPath && warmPath.score < 30) {
    risks.push('Weak intro path may limit access to decision makers');
  }

  // Meeting-based risks
  if (meetings.length > 0) {
    const allObjections = meetings.flatMap(m => parseJsonSafe<Objection[]>(m.objections, []));
    const showstoppers = allObjections.filter(o => o.severity === 'showstopper');
    const unresolved = allObjections.filter(o => o.response_effectiveness === 'unresolved');

    if (showstoppers.length > 0) {
      risks.push(`${showstoppers.length} showstopper objection(s): ${showstoppers.map(o => o.text).join('; ').slice(0, 100)}`);
    }
    if (unresolved.length > 0) {
      risks.push(`${unresolved.length} unresolved objection(s) outstanding`);
    }

    // Check for declining enthusiasm
    const sorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length >= 2) {
      const last = sorted[sorted.length - 1].enthusiasm_score;
      const secondLast = sorted[sorted.length - 2].enthusiasm_score;
      if (last < secondLast && last <= 2) {
        risks.push('Enthusiasm declining to low levels');
      }
    }
  }

  // Momentum risk
  if (momentum === 'stalled') {
    const daysSince = meetings.length > 0
      ? Math.round(daysBetween(meetings.sort((a, b) => b.date.localeCompare(a.date))[0].date, new Date().toISOString()))
      : 0;
    risks.push(`Process stalled${daysSince > 0 ? ` (${daysSince} days since last meeting)` : ''}`);
  }

  // Status-based risks
  if (investor.status === 'identified' && meetings.length === 0) {
    risks.push('Not yet contacted — early stage, outcome uncertain');
  }

  return risks;
}

// ---------------------------------------------------------------------------
// Next Best Action
// ---------------------------------------------------------------------------

function determineNextAction(
  investor: Investor,
  meetings: Meeting[],
  dimensions: ScoreDimension[],
  momentum: string,
  risks: string[],
  trajectory?: ConvictionTrajectory,
): string {
  const status = investor.status;
  const dimMap = new Map(dimensions.map(d => [d.name, d]));
  const latestMeeting = meetings.length > 0
    ? meetings.sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;

  // Terminal states
  if (status === 'closed') return 'Deal closed. Monitor for follow-on or co-investor referrals.';
  if (status === 'passed') return 'Investor passed. Consider re-engaging at next milestone (e.g., post-IRIS2 delivery, post-revenue uptick).';
  if (status === 'dropped') return 'Investor dropped. Archive and revisit if strategic context changes.';

  // Term sheet stage
  if (status === 'term_sheet') return 'In term sheet. Prioritize negotiation on key terms. Prepare board materials and closing conditions checklist.';

  // Trajectory-driven urgency override
  if (trajectory && trajectory.trend !== 'insufficient_data') {
    if (trajectory.velocityPerWeek > 1.5 && trajectory.predictedTermSheetDate && trajectory.predictedTermSheetDate !== 'now') {
      const daysToTS = Math.round((new Date(trajectory.predictedTermSheetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysToTS > 0 && daysToTS < 30) {
        return `Trajectory predicts term sheet readiness by ${trajectory.predictedTermSheetDate}. Prepare board materials and term sheet framework NOW. Push for formal DD start if not already in DD.`;
      }
    }
    if (trajectory.trend === 'decelerating' && trajectory.velocityPerWeek < -2) {
      return `Conviction decelerating at ${trajectory.velocityPerWeek} pts/week. Diagnose root cause: unresolved objection? competitor? internal politics? Schedule urgent check-in with ${investor.partner || investor.name}.`;
    }
  }

  // If stalled, re-engagement is priority
  if (momentum === 'stalled') {
    if (latestMeeting) {
      return `Process stalled. Send a value-add update (new milestone, market data, or comparable deal) to re-engage ${investor.partner || investor.name}. Consider warm re-intro through a different path.`;
    }
    return `No engagement yet. Activate warm intro path${investor.warm_path ? ` via ${investor.warm_path}` : ''} and send tailored one-pager.`;
  }

  // Unresolved objections take priority
  if (risks.some(r => r.includes('showstopper'))) {
    const objs = meetings.flatMap(m => parseJsonSafe<Objection[]>(m.objections, []))
      .filter(o => o.severity === 'showstopper');
    return `Address showstopper objection: "${objs[0]?.text || 'key concern'}". Prepare targeted data/analysis and request a focused follow-up call.`;
  }

  // Status-based actions
  switch (status) {
    case 'identified':
      return `Initiate contact through ${investor.warm_path || 'best available intro path'}. Send customized one-pager tailored to ${investor.sector_thesis || 'their thesis'}.`;
    case 'contacted':
      return 'Follow up to schedule initial meeting. Share teaser or executive brief as hook.';
    case 'nda_signed':
      return 'NDA signed. Schedule management presentation and share deck + key data room documents.';
    case 'meeting_scheduled':
      return 'Prepare for upcoming meeting. Review their portfolio for discussion points and prepare for likely objections.';
    case 'met':
      return latestMeeting?.next_steps
        ? `Execute next steps from meeting: ${latestMeeting.next_steps}`
        : 'Send follow-up materials within 48 hours. Propose deep dive on financial model or site visit.';
    case 'engaged': {
      const engagement = dimMap.get('Engagement');
      if (engagement && engagement.score >= 60) {
        return 'Strong engagement. Push for DD process start — propose structured DD timeline and data room access.';
      }
      return 'Schedule deep dive session. Share financial model and address key questions from prior meetings.';
    }
    case 'in_dd':
      return 'In due diligence. Ensure rapid response to DD requests (<24h). Schedule management references and expert calls. Prepare term sheet framework.';
    default:
      return 'Review investor status and determine appropriate next step based on latest interactions.';
  }
}

// ---------------------------------------------------------------------------
// Forecast Alignment Dimension (cycle 21)
// ---------------------------------------------------------------------------

/**
 * Scores how well-positioned this investor is based on forecast data.
 * High score = investor is predicted to close soon with high confidence.
 * Factors: predicted days to close, confidence, critical path membership, path probability.
 */
export function computeForecastAlignmentScore(
  forecastData: { predictedDaysToClose: number; confidence: string; isCriticalPath: boolean; pathProbability: number } | null,
): ScoreDimension {
  if (!forecastData) {
    return { name: 'Forecast Alignment', score: 0, signal: 'unknown', evidence: 'No forecast data available' };
  }

  let score = 50; // baseline
  const parts: string[] = [];

  // Days to close: closer = better (0-30 pts)
  if (forecastData.predictedDaysToClose <= 30) {
    score += 30;
    parts.push(`~${forecastData.predictedDaysToClose}d to close (very near)`);
  } else if (forecastData.predictedDaysToClose <= 60) {
    score += 20;
    parts.push(`~${forecastData.predictedDaysToClose}d to close (near)`);
  } else if (forecastData.predictedDaysToClose <= 90) {
    score += 10;
    parts.push(`~${forecastData.predictedDaysToClose}d to close`);
  } else {
    score -= 10;
    parts.push(`~${forecastData.predictedDaysToClose}d to close (distant)`);
  }

  // Confidence: high/medium/low (0-20 pts)
  if (forecastData.confidence === 'high') {
    score += 20;
    parts.push('high confidence');
  } else if (forecastData.confidence === 'medium') {
    score += 10;
    parts.push('medium confidence');
  } else {
    score -= 5;
    parts.push('low confidence');
  }

  // Critical path membership (0-15 pts)
  if (forecastData.isCriticalPath) {
    score += 15;
    parts.push('on critical path');
  }

  // Path probability (0-10 pts)
  if (forecastData.pathProbability >= 0.5) {
    score += 10;
  } else if (forecastData.pathProbability >= 0.2) {
    score += 5;
  }

  score = clamp(score);
  return { name: 'Forecast Alignment', score, signal: signal(score), evidence: parts.join(' | ') };
}

// ---------------------------------------------------------------------------
// Network Effect Dimension
// ---------------------------------------------------------------------------

export function computeNetworkEffectScore(
  networkData: { score: number; evidence: string; positiveSignals: string[]; negativeSignals: string[] } | null,
): ScoreDimension {
  if (!networkData || networkData.score === 0 && networkData.positiveSignals.length === 0 && networkData.negativeSignals.length === 0) {
    return { name: 'Network Effect', score: 0, signal: 'unknown', evidence: 'No relationship data available' };
  }

  const score = clamp(networkData.score);
  const parts: string[] = [];
  if (networkData.positiveSignals.length > 0) {
    parts.push(`+${networkData.positiveSignals.length} positive: ${networkData.positiveSignals.slice(0, 2).join('; ')}`);
  }
  if (networkData.negativeSignals.length > 0) {
    parts.push(`-${networkData.negativeSignals.length} negative: ${networkData.negativeSignals.slice(0, 2).join('; ')}`);
  }
  if (parts.length === 0) parts.push(networkData.evidence);

  return { name: 'Network Effect', score, signal: signal(score), evidence: parts.join(' | ') };
}

// ---------------------------------------------------------------------------
// Main Scorer
// ---------------------------------------------------------------------------

export function computeInvestorScore(
  investor: Investor,
  meetings: Meeting[],
  portfolio: InvestorPortfolioCo[],
  briefs: IntelligenceBrief[],
  raiseConfig: { targetEquityM: number; targetCloseDate: string | null },
  networkData?: { score: number; evidence: string; positiveSignals: string[]; negativeSignals: string[] } | null,
  forecastData?: { predictedDaysToClose: number; confidence: string; isCriticalPath: boolean; pathProbability: number } | null,
): InvestorScore {
  // Compute all dimensions
  const engagement = computeEngagementScore(investor, meetings);
  const thesisFit = computeThesisFitScore(investor, portfolio);
  const checkSizeFit = computeCheckSizeFitScore(investor, raiseConfig.targetEquityM);
  const speedMatch = computeSpeedMatchScore(investor, raiseConfig.targetCloseDate);
  const conflictRisk = computeConflictRiskScore(investor, portfolio);
  const warmPath = computeWarmPathScore(investor);
  const meetingQuality = computeMeetingQualityScore(meetings);
  const { momentum, score: momentumScore, evidence: momentumEvidence } = computeMomentumScore(investor, meetings);

  const momentumDimension: ScoreDimension = {
    name: 'Momentum',
    score: momentumScore,
    signal: signal(momentumScore),
    evidence: momentumEvidence,
  };

  // 9th dimension: Network Effect
  const networkEffect = computeNetworkEffectScore(networkData || null);

  // 10th dimension: Forecast Alignment (cycle 21)
  const forecastAlignment = computeForecastAlignmentScore(forecastData || null);

  const dimensions = [
    engagement,
    thesisFit,
    checkSizeFit,
    speedMatch,
    conflictRisk,
    warmPath,
    meetingQuality,
    momentumDimension,
    networkEffect,
    forecastAlignment,
  ];

  // Dynamic weights by raise phase — early-stage needs thesis fit > momentum;
  // late-stage (DD/negotiation) needs momentum > thesis fit
  // Network Effect grows in importance as the raise progresses (cascade dynamics)
  // Forecast Alignment grows in importance as the raise progresses (timeline matters more in DD/negotiation)
  const phaseWeights: Record<string, Record<string, number>> = {
    discovery: {
      'Engagement': 0.10, 'Thesis Fit': 0.23, 'Check Size Fit': 0.13,
      'Speed Match': 0.05, 'Conflict Risk': 0.10, 'Warm Path': 0.14,
      'Meeting Quality': 0.10, 'Momentum': 0.10, 'Network Effect': 0.03, 'Forecast Alignment': 0.02,
    },
    outreach: {
      'Engagement': 0.13, 'Thesis Fit': 0.18, 'Check Size Fit': 0.10,
      'Speed Match': 0.09, 'Conflict Risk': 0.10, 'Warm Path': 0.13,
      'Meeting Quality': 0.10, 'Momentum': 0.10, 'Network Effect': 0.04, 'Forecast Alignment': 0.03,
    },
    mgmt_presentations: {
      'Engagement': 0.17, 'Thesis Fit': 0.13, 'Check Size Fit': 0.10,
      'Speed Match': 0.09, 'Conflict Risk': 0.09, 'Warm Path': 0.09,
      'Meeting Quality': 0.13, 'Momentum': 0.10, 'Network Effect': 0.05, 'Forecast Alignment': 0.05,
    },
    due_diligence: {
      'Engagement': 0.12, 'Thesis Fit': 0.08, 'Check Size Fit': 0.09,
      'Speed Match': 0.13, 'Conflict Risk': 0.12, 'Warm Path': 0.05,
      'Meeting Quality': 0.13, 'Momentum': 0.13, 'Network Effect': 0.08, 'Forecast Alignment': 0.07,
    },
    negotiation: {
      'Engagement': 0.07, 'Thesis Fit': 0.05, 'Check Size Fit': 0.13,
      'Speed Match': 0.16, 'Conflict Risk': 0.12, 'Warm Path': 0.04,
      'Meeting Quality': 0.08, 'Momentum': 0.16, 'Network Effect': 0.09, 'Forecast Alignment': 0.10,
    },
  };
  const raisePhase = (raiseConfig as Record<string, unknown>).raisePhase as string || 'mgmt_presentations';
  const weights = phaseWeights[raisePhase] || phaseWeights.mgmt_presentations;

  let overall = 0;
  let weightSum = 0;
  for (const dim of dimensions) {
    const w = weights[dim.name] || 0.1;
    // Skip unknown dimensions from weighted calc to avoid penalizing missing data unfairly
    if (dim.signal !== 'unknown') {
      overall += dim.score * w;
      weightSum += w;
    }
  }

  // Normalize if not all dimensions contributed
  if (weightSum > 0 && weightSum < 1) {
    overall = overall / weightSum;
  }

  // Status bonus: advanced stages get a floor
  const statusFloor: Record<string, number> = {
    in_dd: 40,
    term_sheet: 55,
    closed: 80,
  };
  if (statusFloor[investor.status] && overall < statusFloor[investor.status]) {
    overall = statusFloor[investor.status];
  }

  // Status penalty: terminal negative states get a cap
  if (investor.status === 'passed' || investor.status === 'dropped') {
    overall = Math.min(overall, 15);
  }

  overall = clamp(overall);

  const risks = identifyRisks(investor, meetings, dimensions, momentum);
  const nextBestAction = determineNextAction(investor, meetings, dimensions, momentum, risks, (raiseConfig as Record<string, unknown>).trajectory as ConvictionTrajectory | undefined);
  const predictedOutcome = predictOutcome(overall, momentum, investor);

  return {
    overall,
    dimensions,
    momentum,
    predictedOutcome,
    nextBestAction,
    risks,
    lastUpdated: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Conviction Trajectory
// ---------------------------------------------------------------------------

export interface ConvictionTrajectory {
  dataPoints: { date: string; score: number; enthusiasm: number }[];
  trend: 'accelerating' | 'steady' | 'decelerating' | 'insufficient_data';
  velocityPerWeek: number; // points per week
  predictedScoreIn30Days: number;
  predictedTermSheetDate: string | null; // estimated date when score reaches 80+
  confidenceLevel: 'high' | 'medium' | 'low';
}

/**
 * Simple linear regression: returns slope and intercept
 * x = days since first data point, y = score
 */
function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const yMean = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (const p of points) {
    const predicted = slope * p.x + intercept;
    ssRes += (p.y - predicted) ** 2;
    ssTot += (p.y - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

// ---------------------------------------------------------------------------
// Enhanced Trajectory (Advanced Analysis — Cycle 10 Depth)
// ---------------------------------------------------------------------------

export interface EnhancedTrajectory extends ConvictionTrajectory {
  acceleration: number; // second derivative, pts/week/week
  hasInflection: boolean;
  inflectionDate: string | null;
  pattern: 'accelerating' | 'decelerating' | 'plateau' | 'inflecting' | 'insufficient_data';
  plateauDuration: number; // weeks at plateau, 0 if not in plateau
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Advanced trajectory analysis: inflection detection, acceleration (2nd derivative),
 * plateau detection, and risk classification.
 * Backward-compatible — extends ConvictionTrajectory.
 */
export function computeAdvancedTrajectory(snapshots: ScoreSnapshot[]): EnhancedTrajectory {
  // Get base trajectory first
  const base = computeConvictionTrajectory(snapshots);

  // Default enhanced fields for insufficient data
  if (snapshots.length < 3) {
    return {
      ...base,
      acceleration: 0,
      hasInflection: false,
      inflectionDate: null,
      pattern: 'insufficient_data',
      plateauDuration: 0,
      riskLevel: base.trend === 'decelerating' ? 'medium' : 'low',
    };
  }

  const firstDate = new Date(snapshots[0].snapshot_date).getTime();
  const msPerDay = 1000 * 60 * 60 * 24;
  const regressionPoints = snapshots.map(s => ({
    x: (new Date(s.snapshot_date).getTime() - firstDate) / msPerDay,
    y: s.overall_score,
  }));

  // --- Acceleration (2nd derivative) ---
  // Compute velocity (slope) over sliding windows, then take the slope of those velocities.
  // We use 3-point windows to compute local slopes, then regress those slopes.
  const localSlopes: { x: number; slope: number }[] = [];
  for (let i = 1; i < regressionPoints.length; i++) {
    const dx = regressionPoints[i].x - regressionPoints[i - 1].x;
    if (dx > 0) {
      localSlopes.push({
        x: (regressionPoints[i].x + regressionPoints[i - 1].x) / 2,
        slope: (regressionPoints[i].y - regressionPoints[i - 1].y) / dx,
      });
    }
  }

  let acceleration = 0; // pts/day/day
  if (localSlopes.length >= 2) {
    const slopeRegression = linearRegression(
      localSlopes.map(s => ({ x: s.x, y: s.slope }))
    );
    acceleration = slopeRegression.slope;
  }
  // Convert to pts/week/week
  const accelerationPerWeekPerWeek = Math.round(acceleration * 7 * 7 * 100) / 100;

  // --- Inflection Detection ---
  // An inflection is where the trajectory changed direction.
  // Compare slope of last 3 points vs slope of all points.
  // If they differ by more than 1 standard deviation of residuals, that's an inflection.
  let hasInflection = false;
  let inflectionDate: string | null = null;

  if (regressionPoints.length >= 4) {
    const allReg = linearRegression(regressionPoints);
    const lastN = Math.min(3, regressionPoints.length - 1);
    const recentPoints = regressionPoints.slice(-lastN);
    const recentReg = linearRegression(recentPoints);

    // Compute standard deviation of residuals from the all-points regression
    let sumSqResidual = 0;
    for (const p of regressionPoints) {
      const predicted = allReg.slope * p.x + allReg.intercept;
      sumSqResidual += (p.y - predicted) ** 2;
    }
    const residualStd = Math.sqrt(sumSqResidual / regressionPoints.length);
    // Normalize slope difference relative to the data range
    const slopeDiff = Math.abs(recentReg.slope - allReg.slope);
    // The slope itself is in pts/day; residualStd is in pts. Use a scaled threshold.
    const xRange = regressionPoints[regressionPoints.length - 1].x - regressionPoints[0].x;
    const threshold = xRange > 0 ? residualStd / xRange : 0;

    if (threshold > 0 && slopeDiff > threshold) {
      hasInflection = true;
      // The inflection is approximately where recent segment starts
      const inflectionIdx = Math.max(0, snapshots.length - lastN);
      inflectionDate = snapshots[inflectionIdx].snapshot_date;
    }
  }

  // --- Plateau Detection ---
  // A plateau is when velocity is near zero for 3+ consecutive snapshots.
  let plateauDuration = 0;
  const plateauThreshold = 2; // score change of <=2 pts between consecutive snapshots = flat
  let currentPlateauCount = 0;

  for (let i = regressionPoints.length - 1; i >= 1; i--) {
    const scoreDelta = Math.abs(regressionPoints[i].y - regressionPoints[i - 1].y);
    if (scoreDelta <= plateauThreshold) {
      currentPlateauCount++;
    } else {
      break; // plateau broken going backwards
    }
  }

  const isInPlateau = currentPlateauCount >= 3;
  if (isInPlateau) {
    // Compute duration in weeks
    const plateauStartIdx = regressionPoints.length - 1 - currentPlateauCount;
    const plateauStartDay = regressionPoints[Math.max(0, plateauStartIdx)].x;
    const latestDay = regressionPoints[regressionPoints.length - 1].x;
    plateauDuration = Math.round((latestDay - plateauStartDay) / 7 * 10) / 10;
  }

  // --- Pattern Classification ---
  let pattern: EnhancedTrajectory['pattern'];
  if (isInPlateau) {
    pattern = 'plateau';
  } else if (hasInflection) {
    pattern = 'inflecting';
  } else if (accelerationPerWeekPerWeek > 0.3) {
    pattern = 'accelerating';
  } else if (accelerationPerWeekPerWeek < -0.3) {
    pattern = 'decelerating';
  } else if (Math.abs(base.velocityPerWeek) < 0.5) {
    pattern = 'plateau'; // low velocity even if not strictly consecutive flat
  } else if (base.velocityPerWeek > 0) {
    pattern = 'accelerating';
  } else {
    pattern = 'decelerating';
  }

  // --- Risk Level ---
  let riskLevel: EnhancedTrajectory['riskLevel'];
  const currentScore = snapshots[snapshots.length - 1].overall_score;

  if (pattern === 'decelerating' && base.velocityPerWeek < -3) {
    riskLevel = 'critical'; // rapid decline
  } else if (pattern === 'decelerating' && base.velocityPerWeek < -1.5) {
    riskLevel = 'high';
  } else if (pattern === 'plateau' && plateauDuration > 3 && currentScore < 50) {
    riskLevel = 'high'; // stuck at low score
  } else if (pattern === 'plateau' && plateauDuration > 2) {
    riskLevel = 'medium'; // indecision
  } else if (pattern === 'inflecting' && base.velocityPerWeek < 0) {
    riskLevel = 'high'; // just started declining
  } else if (pattern === 'decelerating') {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return {
    ...base,
    acceleration: accelerationPerWeekPerWeek,
    hasInflection,
    inflectionDate,
    pattern,
    plateauDuration,
    riskLevel,
  };
}

export function computeConvictionTrajectory(snapshots: ScoreSnapshot[]): ConvictionTrajectory {
  if (snapshots.length < 2) {
    const point = snapshots[0];
    return {
      dataPoints: snapshots.map(s => ({ date: s.snapshot_date, score: s.overall_score, enthusiasm: s.enthusiasm ?? 0 })),
      trend: 'insufficient_data',
      velocityPerWeek: 0,
      predictedScoreIn30Days: point?.overall_score ?? 0,
      predictedTermSheetDate: null,
      confidenceLevel: 'low',
    };
  }

  const dataPoints = snapshots.map(s => ({
    date: s.snapshot_date,
    score: s.overall_score,
    enthusiasm: s.enthusiasm ?? 0,
  }));

  // Convert dates to days since first snapshot
  const firstDate = new Date(snapshots[0].snapshot_date).getTime();
  const regressionPoints = snapshots.map(s => ({
    x: (new Date(s.snapshot_date).getTime() - firstDate) / (1000 * 60 * 60 * 24),
    y: s.overall_score,
  }));

  const { slope, r2 } = linearRegression(regressionPoints);

  // Slope is points per day; convert to points per week
  const velocityPerWeek = Math.round(slope * 7 * 10) / 10;

  // Determine trend
  let trend: ConvictionTrajectory['trend'];
  if (snapshots.length < 3) {
    trend = 'insufficient_data';
  } else if (velocityPerWeek > 1.5) {
    trend = 'accelerating';
  } else if (velocityPerWeek < -1.5) {
    trend = 'decelerating';
  } else {
    trend = 'steady';
  }

  // Predict score in 30 days
  const lastPoint = regressionPoints[regressionPoints.length - 1];
  const daysFromFirstToNow = lastPoint.x;
  const daysFromFirstTo30 = daysFromFirstToNow + 30;
  const rawPrediction = slope * daysFromFirstTo30 + (linearRegression(regressionPoints).intercept);
  const predictedScoreIn30Days = clamp(Math.round(rawPrediction));

  // Predict term sheet date (when score reaches 80)
  let predictedTermSheetDate: string | null = null;
  const currentScore = snapshots[snapshots.length - 1].overall_score;
  if (currentScore >= 80) {
    predictedTermSheetDate = 'now'; // already there
  } else if (slope > 0) {
    // Solve: slope * x + intercept = 80, where x is days from first snapshot
    const { intercept } = linearRegression(regressionPoints);
    const daysTo80 = (80 - intercept) / slope;
    const daysFromNow = daysTo80 - daysFromFirstToNow;
    if (daysFromNow > 0 && daysFromNow < 365) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + Math.round(daysFromNow));
      predictedTermSheetDate = targetDate.toISOString().split('T')[0];
    }
  }

  // Confidence based on R-squared and number of data points
  let confidenceLevel: ConvictionTrajectory['confidenceLevel'];
  if (snapshots.length >= 7 && r2 > 0.6) {
    confidenceLevel = 'high';
  } else if (snapshots.length >= 4 && r2 > 0.3) {
    confidenceLevel = 'medium';
  } else {
    confidenceLevel = 'low';
  }

  return {
    dataPoints,
    trend,
    velocityPerWeek,
    predictedScoreIn30Days,
    predictedTermSheetDate,
    confidenceLevel,
  };
}
