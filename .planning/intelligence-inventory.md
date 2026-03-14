# Intelligence Inventory — Raise App
> Auto-updated after each improvement cycle. Consumed by expert panel to prevent re-suggestion and enable compounding.

## Cycle Log
| Cycle | Date | Focus | Intelligence Gain | Files Changed |
|-------|------|-------|-------------------|---------------|
| 1 | 2026-03-14 | Feedback loops + scoring depth | 7 cross-feature feedback loops, recency-weighted enthusiasm, phase-dynamic weights, trajectory prediction, investor-specific close probabilities | scoring.ts, db.ts, stress-test, momentum, pulse |
| 2 | 2026-03-14 | Context propagation | Unified context bus — every write invalidates cache, all 12→15 data sources aggregated, workspace AI gets full context | context-bus.ts, 11 API routes, workspace |
| 3 | 2026-03-14 | Deep intelligence | Cross-investor question patterns, prediction calibration, narrative drift, objection fix, intelligence inventory | db.ts, context-bus.ts, meetings, stress-test, investors |
| 4 | 2026-03-14 | Relationship graph + meeting prep | Investor relationship graph (co-investment + warm path), 9th scoring dimension (Network Effect), keystone investor detection, cross-investor meeting prep API, aggregated competitive intel | db.ts, scoring.ts, context-bus.ts, meeting-brief/route.ts, meetings/prep/route.ts, investors/[id]/score/route.ts |
| 5 | 2026-03-14 | Self-calibration + timing intelligence | Auto-weight calibration from resolved predictions, cross-investor timing correlation (competitive tension / engagement gaps / DD sync), document auto-strengthening from question convergence, automatic relationship graph rebuild, timing signals in context bus | stress-test/route.ts, momentum/route.ts, documents/strengthen/route.ts, investors/route.ts, context-bus.ts, db.ts |
| 6 | 2026-03-14 | Monte Carlo + narrative drift + co-investor detection + verification | Monte Carlo confidence intervals (P10/P50/P90), narrative drift consumption in momentum (anomaly/alert enrichment), market deal co-investor detection in relationship graph, intelligence flow verification endpoint, Monte Carlo in context bus | stress-test/route.ts, momentum/route.ts, db.ts, context-bus.ts, intelligence/verify/route.ts |
| 7 | 2026-03-14 | Intelligence Synthesis | 6-instruction reasoning framework for workspace AI (pattern synthesis, strategic prioritization, conviction arcs, contradiction detection, predictive reasoning, phase awareness), intelligence briefing layer in pulse dashboard (8 insight generators, typed/sorted/capped), synthesis section in context bus system prompt (6 cross-source reasoning aids) | workspace/route.ts, pulse/route.ts, context-bus.ts |
| 8 | 2026-03-14 | Autonomous Intelligence | Auto-action engine (5 rules: narrative weakness, engagement gap, declining trajectory, keystone uncommitted, struggling type), pulse-triggered intelligence refresh, smart follow-up timing (day-of-week + time-of-day optimization per investor + type), auto-actions API (POST trigger + GET pending) | db.ts, pulse/route.ts, intelligence/auto-actions/route.ts |
| 9 | 2026-03-14 | Learning Intelligence | Action outcome measurement (enthusiasm delta + status progression + engagement increase), rule effectiveness aggregation (by trigger_type × action_type), self-improving auto-actions (skip ineffective rules, boost proven ones), action effectiveness in context bus + system prompt, evidence-based AI instructions, pulse-triggered measurement | db.ts, context-bus.ts, workspace/route.ts, pulse/route.ts |
| 10 | 2026-03-14 | Depth: Trajectory + Objections + Pipeline | Advanced conviction trajectory (inflection detection, acceleration/2nd derivative, plateau detection, risk classification), objection evolution (emerging/resolved/persistent temporal tracking, heat map), pipeline flow intelligence (stage dwell time, bottleneck detection, conversion rates, velocity trend), all wired to context bus + system prompt | scoring.ts, db.ts, context-bus.ts |

## Intelligence Capabilities (Existing)

### A. Scoring Engine (scoring.ts)
- [x] 9-dimension scoring: engagement, thesis fit, check size, speed match, conflict risk, warm path, meeting quality, momentum, **network effect (NEW cycle 4)**
- [x] Phase-dynamic weights: discovery/outreach/mgmt_presentations/due_diligence/negotiation
- [x] Recency-weighted enthusiasm: exponential decay half-life ~21 days
- [x] Conviction trajectory: linear regression on score snapshots, velocity/wk, predicted score in 30d
- [x] Trajectory → action integration: velocity/deceleration drives next-action recommendations
- [x] **Network Effect dimension: boosts score when connected investors are positive, reduces when they've passed (NEW cycle 4)**
- [x] **Auto-weight calibration: STATUS_WEIGHT blended 70/30 with empirical close rates from resolved predictions (NEW cycle 5)**
- [x] **Advanced trajectory analysis (NEW cycle 10)**:
  - [x] `computeAdvancedTrajectory()`: extends ConvictionTrajectory with EnhancedTrajectory interface
  - [x] Inflection detection: piecewise regression comparing last-3-point slope vs all-point slope (>1 std dev = inflection)
  - [x] Acceleration (2nd derivative): sliding window local slopes → regression of slopes → pts/week/week
  - [x] Plateau detection: score change ≤2 pts for 3+ consecutive snapshots → plateau duration in weeks
  - [x] Pattern classification: accelerating / decelerating / plateau / inflecting / insufficient_data
  - [x] Risk classification: low / medium / high / critical (based on pattern + velocity + score level)
  - [x] Backward-compatible: existing `computeConvictionTrajectory()` unchanged, new function extends it

### B. Context Bus (context-bus.ts)
- [x] Version-based cache invalidation
- [x] 16 data source aggregation (15 previous + keystone investors)
- [x] ContextSource type system (18 event types)
- [x] Recent changes tracking (last 50)
- [x] Investor snapshot with enriched meeting/task/followup data
- [x] Pipeline health metrics
- [x] Context → system prompt serialization
- [x] **Narrative weakness signals from cross-investor question convergence (NEW cycle 3)**
- [x] **Prediction calibration metrics (Brier score, bias direction) (NEW cycle 3)**
- [x] **Narrative drift by investor type (enthusiasm, conversion, objection segmented) (NEW cycle 3)**
- [x] **Proven objection responses from playbook (NEW cycle 3)**
- [x] **Keystone investor identification — "closing one unlocks others" (NEW cycle 4)**
- [x] **Timing signals type definition + system prompt serialization (NEW cycle 5)**
- [x] **Monte Carlo field in FullContext (populated by stress test, null by default) + system prompt serialization (NEW cycle 6)**
- [x] **Action effectiveness field in FullContext (populated by getAutoActionEffectiveness(), null if no data) + system prompt serialization (NEW cycle 9)**
- [x] **Objection evolution field in FullContext (emerging/persistent/resolved) + system prompt serialization (NEW cycle 10)**
- [x] **Pipeline flow field in FullContext (bottleneck stage/velocity trend/avg days) + system prompt serialization (NEW cycle 10)**
- [x] **Intelligence Synthesis section in system prompt — cross-source reasoning aids (NEW cycle 7)**:
  - [x] Narrative weakness → pending follow-up urgency linking
  - [x] Keystone investor priority surfacing
  - [x] Prediction calibration → confidence language adjustment
  - [x] Pipeline health synthesis (overdue follow-ups, thin pipeline)
  - [x] Narrative drift → affected investor identification
  - [x] Contradiction detection (high enthusiasm + no progression)

### C. Prediction Engine (stress-test/route.ts)
- [x] Status-weighted base probabilities
- [x] 4 investor-specific adjustments: showstoppers, enthusiasm decline, meeting frequency, process signals
- [x] Type-specific velocity multipliers: vc/growth/sovereign/strategic/family_office/debt
- [x] Tier × velocity predicted close dates
- [x] **Prediction logging for calibration — every forecast run logs predictions (NEW cycle 3)**
- [x] **Auto-weight calibration: fetches getCalibrationData(), computes empirical close rates per status, blends 70% hardcoded + 30% empirical when 5+ resolved predictions exist (NEW cycle 5)**
- [x] **Calibration section in response: shows enabled/disabled, resolved count, per-status adjustments (NEW cycle 5)**
- [x] **Monte Carlo confidence intervals: 1000 simulations, P10/P50/P90 percentiles, probability of reaching target (NEW cycle 6)**

### D. Momentum Analysis (momentum/route.ts)
- [x] Weekly-over-weekly deltas
- [x] Anomaly detection (deviation ≥ 20)
- [x] Cross-investor systemic signals → auto-acceleration actions
- [x] Trajectory early warning: 7-day critical, 21-day warning
- [x] Auto-creates escalation acceleration actions
- [x] **Cross-investor timing correlation: 3 signal types (NEW cycle 5)**
  - [x] Meeting clusters: 3+ different-investor meetings within 5 days = competitive tension
  - [x] Engagement gaps: investor with meetings then 21+ day silence = stall risk
  - [x] DD synchronization: 2+ investors entering DD within 14 days = leverage opportunity
- [x] **Auto-creates competitive_signal acceleration actions on competitive tension (NEW cycle 5)**
- [x] **Narrative drift consumption: anomalies/alerts enriched with narrativeContext when investor type is struggling (NEW cycle 6)**
- [x] **Narrative health in response: full narrative signals array for pulse dashboard (NEW cycle 6)**

### E. Workspace AI (workspace/route.ts)
- [x] Full context bus consumption
- [x] Context version-based cache invalidation
- [x] 10 instruction categories including conflict resolution
- [x] **Now receives narrative weakness signals, proven responses, narrative drift, calibration (NEW cycle 3)**
- [x] **Now receives keystone investor data for network-aware recommendations (NEW cycle 4)**
- [x] **Now receives timing signals in system prompt when present (NEW cycle 5)**
- [x] **17 instruction categories with 6 reasoning framework + 1 evidence-based recommendation instructions (NEW cycle 7, extended cycle 9)**:
  - [x] Pattern synthesis: cross-reference weaknesses with documents, investor types, proven responses
  - [x] Strategic prioritization: keystone-first, declining-urgent, timing-leverage weighting
  - [x] Conviction arc reasoning: accelerating/steady/decelerating/stalled → action mapping
  - [x] Contradiction detection: enthusiasm vs engagement, meetings vs progression, responses vs lift
  - [x] Predictive reasoning: trajectory extrapolation, cascade prediction, showstopper forecasting
  - [x] Fundraise phase awareness: discovery/outreach/presentations/DD/negotiation context switching
  - [x] **Evidence-based recommendations: prefer empirically effective action types, cite measurement data (NEW cycle 9)**

### F. Meeting Intelligence (db.ts + meeting-brief)
- [x] AI-extracted structured data: questions, objections, engagement signals, competitive intel
- [x] Objection learning loop: auto-close by keyword match, effectiveness measurement
- [x] Followup efficacy tracking: enthusiasm delta post-execution
- [x] **Question pattern extraction + topic classification (12 topics) (NEW cycle 3)**
- [x] **Cross-investor question convergence analysis (NEW cycle 3)**
- [x] **Fixed objection effectiveness with enthusiasm_at_objection baseline (NEW cycle 3)**
- [x] **Meeting prep pulls cross-investor question patterns by type (NEW cycle 4)**
- [x] **Meeting prep pulls proven responses for likely objections (NEW cycle 4)**
- [x] **Meeting prep aggregates competitive intel from ALL meetings (NEW cycle 4)**
- [x] **Meeting prep shows network connections to other pipeline investors (NEW cycle 4)**
- [ ] **GAP: Semantic objection matching still keyword-only**

### G. Event Cascading
- [x] Task completion → document flag resolution → data_share followup
- [x] Acceleration execution → task + followup + activity log
- [x] Objection resolution → followup auto-completion
- [x] Momentum anomaly → auto-acceleration action creation
- [x] **Meeting logged → question pattern extraction (NEW cycle 3)**
- [x] **Investor status→terminal → prediction resolution (NEW cycle 3)**
- [x] **Investor created → relationship graph rebuild (NEW cycle 5)**
- [x] **Investor warm_path updated → relationship graph rebuild (NEW cycle 5)**
- [x] **Competitive tension detected → competitive_signal acceleration action (NEW cycle 5)**
- [x] **Pulse dashboard viewed → auto-action generation (non-blocking) (NEW cycle 8)**
- [x] **Narrative weakness detected (3+ investors) → auto data_update action (NEW cycle 8)**
- [x] **Engagement gap detected (21+ days) → auto milestone_share action (NEW cycle 8)**
- [x] **Declining trajectory detected (>2 pts/wk) → auto expert_call action (NEW cycle 8)**
- [x] **Keystone investor uncommitted → auto escalation action (NEW cycle 8)**
- [x] **Pulse dashboard viewed → measureActionEffectiveness() non-blocking (NEW cycle 9)**
- [x] **Action executed → outcome measured → rule effectiveness updated → future actions adjusted (NEW cycle 9)**

### H. Narrative Intelligence (NEW cycle 3)
- [x] Per-investor-type narrative effectiveness (enthusiasm × conversion × top objection)
- [x] Cross-investor question convergence detection (2+ investors = warning, 3+ = critical)
- [x] Type-specific pitch adaptation recommendations in context
- [x] **Document auto-strengthening: POST /api/documents/strengthen creates document_flags for topics with question convergence (NEW cycle 5)**
- [ ] **GAP: No automatic document version branching per investor type**

### I. Relationship Graph Intelligence (NEW cycle 4)
- [x] `investor_relationships` table: persists discovered relationships
- [x] `buildRelationshipGraph()`: scans portfolio for co-investment, warm_path for name mentions
- [x] `getInvestorRelationships(id)`: returns enriched relationships for one investor
- [x] `getKeystoneInvestors()`: identifies investors whose commitment cascades to others
- [x] `computeNetworkEffectData(id)`: scores network signals (positive/negative) for scoring engine
- [x] `getAggregatedCompetitiveIntel()`: cross-investor competitive intel consolidation
- [x] `getQuestionPatternsForType(type)`: type-specific question patterns for meeting prep
- [x] `getProvenResponsesForTopics(topics)`: best responses per objection topic
- [x] **Auto-rebuild on investor creation and warm_path update (NEW cycle 5)**
- [x] **Market deal co-investor detection: scans market_deals for pipeline investors, discovers co-investment relationships (NEW cycle 6)**

### J. Meeting Prep API (NEW cycle 4)
- [x] Dedicated `/api/meetings/prep?investor_id=` endpoint
- [x] Cross-investor question patterns by investor type
- [x] Proven responses with effectiveness ratings
- [x] Aggregated competitive intel from all meetings
- [x] Network connection context with strategic implications
- [x] Unresolved objection tracking with suggested responses
- [x] Enhanced `/api/meeting-brief` with all cross-investor data passed to AI

### K. Document Auto-Strengthening (NEW cycle 5)
- [x] POST `/api/documents/strengthen` endpoint
- [x] Fetches question convergence patterns (2+ investors asking same topic)
- [x] Matches topics to documents via keyword search (12 topic categories)
- [x] Creates document_flags with flag_type='section_improvement' for weak sections
- [x] Emits context change events for each flag created
- [x] Returns convergence patterns and flags created

### M. Intelligence Synthesis (NEW cycle 7)
- [x] Workspace AI reasoning framework: 6 structured instructions (11-16) teaching HOW to synthesize data
- [x] Pulse dashboard intelligence briefing: programmatic insight generation from 8 sources
  - [x] Narrative weakness insights with proven-response cross-reference
  - [x] Keystone investor cascade opportunity insights
  - [x] Timing signal insights (competitive tension, engagement gaps, DD sync)
  - [x] Conviction trajectory alerts for declining investors
  - [x] Pipeline health insights (thin pipeline, overdue follow-ups)
  - [x] Prediction calibration insights (over/under-confident trends)
  - [x] Contradiction detection (high enthusiasm + no progression)
  - [x] Narrative drift insights for struggling investor types
- [x] Context bus synthesis section: 6 cross-source reasoning aids in system prompt
- [x] Typed insight model: critical/opportunity/risk/trend with title, detail, action, dataSource
- [x] Sorted by severity (critical first), capped at 7 insights for actionability

### N. Autonomous Intelligence Engine (NEW cycle 8, extended cycle 9)
- [x] `generateAutoActions()`: 5-rule engine that detects patterns and creates acceleration_actions
  - [x] Rule 1: `narrative_weakness_critical` — 3+ investors questioning same topic → data_update action
  - [x] Rule 2: `engagement_gap` — 21+ days no contact for active investors → milestone_share action
  - [x] Rule 3: `declining_trajectory` — score declining >2 pts/week → expert_call action
  - [x] Rule 4: `keystone_uncommitted` — keystone investor not at engaged+ → escalation action
  - [x] Rule 5: `narrative_struggling_type` — investor type with avg enthusiasm < 2.5 → data_update action
- [x] Duplicate prevention: checks for same investor_id + trigger_type within last 7 days before creating
- [x] All auto-actions prefixed with `[AUTO]` for identification
- [x] POST `/api/intelligence/auto-actions` — triggers engine, emits context changes
- [x] GET `/api/intelligence/auto-actions` — returns pending auto-generated actions
- [x] **Pulse-triggered refresh: every pulse dashboard view runs generateAutoActions() non-blocking (NEW cycle 8)**
- [x] **Self-improving rules: skips ineffective rules (5+ measurements, avgLift <2), boosts proven rules (5+ measurements, avgLift >8) (NEW cycle 9)**
- [x] **AutoActionResult now includes skippedIneffective[] and boostedRules[] for transparency (NEW cycle 9)**
- [x] `computeOptimalFollowupTiming(investorId)`: smart follow-up timing
  - [x] Analyzes day-of-week enthusiasm patterns for individual investor
  - [x] Falls back to type-level patterns (all investors of same type)
  - [x] Blends individual (70%) + type (30%) signals when data is sufficient
  - [x] Type-specific time-of-day heuristics (VC=10AM, growth=9:30AM, sovereign=11AM, strategic=2PM, etc.)
  - [x] Returns optimalDayOfWeek, optimalTimeOfDay, reasoning with data sources

### O. Pulse as Intelligence Heartbeat (NEW cycle 8, extended cycle 9)
- [x] Every pulse dashboard view triggers non-blocking `generateAutoActions()`
- [x] Detect→Act loop closed: patterns detected → actions created → visible in dashboard
- [x] No manual trigger needed — intelligence refreshes on CEO dashboard view
- [x] **Every pulse view also triggers `measureActionEffectiveness()` — measures outcomes of executed actions (NEW cycle 9)**

### P. Learning Intelligence (NEW cycle 9)
- [x] `measureActionEffectiveness()`: measures outcomes of executed acceleration actions
  - [x] Finds executed actions with unmeasured lift (actual_lift IS NULL)
  - [x] For each, computes enthusiasm delta (before vs after execution), status progression, and engagement increase
  - [x] Produces lift score (-10 to +20) combining all three signals
  - [x] Handles synthetic investor IDs (narrative_*) with neutral lift
  - [x] Skips actions with <14 days post-execution and no post-execution data (waits for more data)
  - [x] Returns summary with avgLift, bestActionType, worstActionType, byType breakdown
- [x] `getAutoActionEffectiveness()`: aggregates effectiveness by trigger_type × action_type
  - [x] Sample-size-based confidence (low <5, medium 5-9, high 10+)
  - [x] Recommendations per rule: HIGH PERFORMER / Effective / Marginally effective / LOW PERFORMER / INEFFECTIVE
  - [x] Overall average lift across all measured actions
- [x] Self-improving `generateAutoActions()`:
  - [x] Fetches effectiveness data before rule evaluation
  - [x] Skips rules measured 5+ times with avgLift < 2 (ineffective rules)
  - [x] Boosts expected_lift for rules measured 5+ times with avgLift > 8 (proven rules)
  - [x] Logs which rules were skipped (skippedIneffective) and boosted (boostedRules) in result
- [x] `actionEffectiveness` field in FullContext (context bus)
  - [x] Populated via `getAutoActionEffectiveness()` in Promise.all
  - [x] Fields: overallAvgLift, bestActionType, worstActionType, totalMeasured
  - [x] Serialized to system prompt as ACTION EFFECTIVENESS section
- [x] Workspace AI instruction 17: EVIDENCE-BASED RECOMMENDATIONS
  - [x] AI prefers action types with empirically measured high effectiveness
  - [x] AI avoids low-effectiveness action types unless specifically warranted
  - [x] AI cites evidence basis ("Based on X measured outcomes...")
- [x] Pulse-triggered measurement: every dashboard view runs `measureActionEffectiveness()` non-blocking

### Q. Objection Evolution Intelligence (NEW cycle 10)
- [x] `computeObjectionEvolution()`: temporal analysis of objection topics across all meetings
  - [x] Emerging objections: topics appearing in recent 3 weeks or growing — early warning system
  - [x] Resolved objections: topics that stopped appearing — identifies what worked (cross-references objection_responses for effective response)
  - [x] Persistent objections: topics spanning both old and recent meetings — signals failing responses
  - [x] Objection heat map: topic × week frequency matrix for trend visualization
  - [x] Wired to context bus: emerging/persistent/resolvedCount in FullContext
  - [x] System prompt: OBJECTION EVOLUTION section with actionable guidance per category

### R. Pipeline Flow Intelligence (NEW cycle 10)
- [x] `computePipelineFlow()`: stage-level pipeline analytics from activity_log status changes
  - [x] Average dwell time per stage: how long investors spend at each pipeline stage
  - [x] Bottleneck identification: stage with longest average dwell time
  - [x] Conversion rates per stage: % of investors that advance from each stage
  - [x] Velocity trend: accelerating/steady/decelerating — compares first-half vs second-half transition speeds
  - [x] Stage health classification: healthy/slow/blocked per stage (with stage-specific thresholds)
  - [x] Parses activity_log detail field for status transitions + investor creation dates as baseline
  - [x] Wired to context bus: bottleneckStage/velocityTrend/avgDaysToClose in FullContext
  - [x] System prompt: PIPELINE FLOW section with bottleneck identification and velocity trend

## Intelligence Gaps (Prioritized for Next Cycle)

### P1 — Semantic Objection Matching
- Move beyond keyword-only objection matching to embedding-based similarity
- Compounds with: meeting intelligence, objection playbook, proven responses

### P2 — Document Version Branching by Investor Type
- Auto-create tailored document versions per investor type based on narrative drift signals
- Compounds with: narrative intelligence, document flags, workspace AI

### P4 — Investor Communication Templates
- Auto-generate follow-up emails, meeting summaries, and pitch customizations per investor
- Compounds with: narrative drift, proven responses, meeting intelligence

### P5 — Real-Time Deal Room Analytics
- Track document views, time spent, section engagement from data room
- Compounds with: conviction trajectory, contradiction detection, timing signals

### L. Intelligence Flow Verification (NEW cycle 6)
- [x] GET `/api/intelligence/verify` endpoint
- [x] Checks context bus builds successfully
- [x] Checks data freshness (build timestamp age)
- [x] Counts records in intelligence tables (question_patterns, prediction_log, investor_relationships, narrative_signals)
- [x] Verifies context bus includes all expected fields (narrativeWeaknesses, predictionCalibration, narrativeDrift, provenResponses, keystoneInvestors)
- [x] Tests supporting functions are callable (getQuestionPatterns, getCalibrationData, computeNarrativeSignals, getKeystoneInvestors)
- [x] Returns health report: healthy/degraded/unhealthy with per-check pass/warn/fail

### CLOSED (Cycle 9):
- ~~Learning Intelligence / Action Outcome Measurement~~ — implemented in db.ts (measureActionEffectiveness, getAutoActionEffectiveness), self-improving generateAutoActions, context-bus.ts (actionEffectiveness field + system prompt), workspace/route.ts (instruction 17), pulse/route.ts (measurement trigger)

### CLOSED (Cycle 8):
- ~~Autonomous Action Engine~~ — implemented in db.ts (generateAutoActions, 5 rules) + intelligence/auto-actions/route.ts
- ~~Pulse-triggered Intelligence Refresh~~ — implemented in pulse/route.ts (non-blocking generateAutoActions call)
- ~~Smart Follow-up Timing~~ — implemented in db.ts (computeOptimalFollowupTiming)

### CLOSED (Cycle 7):
- ~~Explicit Reasoning Framework for Pattern Synthesis (P3)~~ — implemented in workspace/route.ts (instructions 11-16), pulse/route.ts (intelligenceBriefing), context-bus.ts (synthesis section)
- ~~Monte Carlo Confidence Intervals~~ — implemented in stress-test/route.ts (cycle 6)
- ~~Narrative Drift Consumption in Momentum~~ — implemented in momentum/route.ts (cycle 6)
- ~~Market Deal Co-Investor Detection~~ — implemented in db.ts + buildRelationshipGraph() (cycle 6)
