# Intelligence Inventory — Raise App
> Auto-updated after each improvement cycle. Consumed by expert panel to prevent re-suggestion and enable compounding.

## Cycle Log
| Cycle | Date | Focus | Intelligence Gain | Files Changed |
|-------|------|-------|-------------------|---------------|
| 1 | 2026-03-14 | Feedback loops + scoring depth | 7 cross-feature feedback loops, recency-weighted enthusiasm, phase-dynamic weights, trajectory prediction, investor-specific close probabilities | scoring.ts, db.ts, stress-test, momentum, pulse |
| 2 | 2026-03-14 | Context propagation | Unified context bus — every write invalidates cache, all 12 data sources aggregated, workspace AI gets full context | context-bus.ts, 11 API routes, workspace |

## Intelligence Capabilities (Existing)

### A. Scoring Engine (scoring.ts)
- [x] 8-dimension scoring: engagement, thesis fit, check size, speed match, conflict risk, warm path, meeting quality, momentum
- [x] Phase-dynamic weights: discovery/outreach/mgmt_presentations/due_diligence/negotiation
- [x] Recency-weighted enthusiasm: exponential decay half-life ~21 days
- [x] Conviction trajectory: linear regression on score snapshots, velocity/wk, predicted score in 30d
- [x] Trajectory → action integration: velocity/deceleration drives next-action recommendations
- [ ] **GAP: No cross-investor pattern analysis in scoring**
- [ ] **GAP: No network effects between investors**
- [ ] **GAP: Weights never calibrated against actual outcomes**

### B. Context Bus (context-bus.ts)
- [x] Version-based cache invalidation
- [x] 12 data source aggregation
- [x] ContextSource type system (18 event types)
- [x] Recent changes tracking (last 50)
- [x] Investor snapshot with enriched meeting/task/followup data
- [x] Pipeline health metrics
- [x] Context → system prompt serialization
- [ ] **GAP: No question pattern analysis across investors**
- [ ] **GAP: No narrative drift detection by investor type**
- [ ] **GAP: No prediction accuracy tracking**
- [ ] **GAP: No relationship graph intelligence**
- [ ] **GAP: No objection response effectiveness data**

### C. Prediction Engine (stress-test/route.ts)
- [x] Status-weighted base probabilities
- [x] 4 investor-specific adjustments: showstoppers, enthusiasm decline, meeting frequency, process signals
- [x] Type-specific velocity multipliers: vc/growth/sovereign/strategic/family_office/debt
- [x] Tier × velocity predicted close dates
- [ ] **GAP: Never validates predictions against reality (no calibration)**
- [ ] **GAP: No Monte Carlo confidence intervals**

### D. Momentum Analysis (momentum/route.ts)
- [x] Weekly-over-weekly deltas
- [x] Anomaly detection (deviation ≥ 20)
- [x] Cross-investor systemic signals → auto-acceleration actions
- [x] Trajectory early warning: 7-day critical, 21-day warning
- [x] Auto-creates escalation acceleration actions
- [ ] **GAP: No cross-investor timing correlation**
- [ ] **GAP: No momentum → narrative health connection**

### E. Workspace AI (workspace/route.ts)
- [x] Full context bus consumption
- [x] Context version-based cache invalidation
- [x] 10 instruction categories including conflict resolution
- [ ] **GAP: AI regurgitates data, doesn't synthesize cross-investor patterns**
- [ ] **GAP: No proven response library in context**
- [ ] **GAP: No type-specific narrative recommendations**

### F. Meeting Intelligence (db.ts)
- [x] AI-extracted structured data: questions, objections, engagement signals, competitive intel
- [x] Objection learning loop: auto-close by keyword match, effectiveness measurement
- [x] Followup efficacy tracking: enthusiasm delta post-execution
- [ ] **GAP: Keyword-only objection matching (not semantic)**
- [ ] **GAP: Questions stored per meeting, never cross-analyzed**
- [ ] **GAP: No enthusiasm_at_objection baseline for delta calculation**

### G. Event Cascading
- [x] Task completion → document flag resolution → data_share followup
- [x] Acceleration execution → task + followup + activity log
- [x] Objection resolution → followup auto-completion
- [x] Momentum anomaly → auto-acceleration action creation

## Intelligence Gaps (Prioritized for Next Cycle)

### P1 — Cross-Investor Question Pattern Analysis
- Every meeting stores questions_asked. Never cross-analyzed.
- Detection of convergence (3+ investors same topic) = strongest narrative weakness signal
- Compounds with: context bus (propagates to all consumers), workspace AI (auto-strengthens docs), meeting prep

### P2 — Prediction Calibration Loop
- Stress test makes predictions, never checks them
- STATUS_WEIGHT constants are hardcoded guesses
- Compounds with: context bus (calibrated probs in all consumers), pulse (confidence intervals), workspace AI (honest probability language)

### P3 — Objection Response Intelligence
- Effectiveness measurement is broken (hardcoded fallback of 3)
- Keyword-only matching misses semantic equivalents
- Compounds with: context bus (proven responses in context), meeting prep (empirically ranked responses), workspace AI (drafts using proven strategies)

### P4 — Relationship Graph Intelligence
- Investors scored independently, but they network in reality
- Co-investment patterns, referral networks, competitive dynamics all unmodeled
- Compounds with: scoring (9th dimension), stress test (cascade-aware forecasting), pulse (keystone investors)

### P5 — Narrative Drift Detection
- No segmented effectiveness analysis by investor type
- One-size-fits-all narrative when VC vs sovereign vs strategic need different framings
- Compounds with: context bus (type-specific context), workspace AI (proactive rewriting), documents (type-specific versions)
