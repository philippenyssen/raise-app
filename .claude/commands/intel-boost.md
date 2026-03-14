# Intelligence Boost

Deep improvement cycle focused exclusively on the scoring engine, prediction system, context bus, and decision intelligence.

## Arguments
$ARGUMENTS — Optional: specific focus area (e.g., "scoring", "predictions", "context-bus", "enrichment-signals", "meeting-intelligence"). If empty, audit all intelligence systems.

## Target Files
- `src/lib/scoring.ts` — 11-dimension investor scoring (53KB)
- `src/lib/db.ts` — Prediction calibration, feedback loops, signal extraction (263KB)
- `src/lib/context-bus.ts` — Cross-system context aggregation (62KB)
- `src/lib/ai.ts` — AI prompt engineering for analysis (18KB)
- `src/lib/enrichment/engine.ts` — Enrichment orchestration
- `src/app/api/intelligence/route.ts` — Intelligence API

## Expert Panel

1. **Nate Silver**: Prediction calibration. Are forecasts well-calibrated? Is there a Brier score equivalent? How to decompose prediction error into calibration vs resolution?
2. **Daniel Kahneman**: Cognitive bias audit. Where does the system amplify human biases rather than correct them? Anchoring in initial scores? Availability bias in recent meetings?
3. **Renaissance Technologies quant**: Signal decay. Are temporal weights optimal? Should momentum use exponential decay or step functions? Cross-signal correlations?
4. **Palantir data fusion engineer**: Entity resolution across enrichment sources. Confidence merging. Contradiction detection. How to handle conflicting signals from different providers?
5. **Salesforce Einstein PM**: Pipeline velocity patterns. Which signals actually predict close? Is the system measuring leading or lagging indicators?
6. **Ray Dalio**: Radical transparency in decision-making. Does the system show WHY it scored something, not just the score? Can the user challenge and recalibrate?
7. **Bayesian statistician**: Prior distributions for new investors. How much data is needed before a score is meaningful? Confidence intervals on predictions?

## Improvement Categories

### A. Scoring Signal Quality
- Are all 11 dimensions independent or correlated?
- Which dimensions have the highest predictive power for actual outcomes?
- Are weights empirically derived or arbitrary?
- Could we add: response time signal, email sentiment, calendar density, referral chain strength?

### B. Prediction Calibration
- Track predicted vs actual close rates over time
- Implement Brier score decomposition
- Add confidence intervals to all predictions
- Auto-recalibrate weights based on outcomes

### C. Cross-System Intelligence
- Context bus propagation: are all relevant signals reaching all consumers?
- Meeting notes → scoring updates: is the extraction tight enough?
- Enrichment data → scoring signals: are new data points feeding into scores?
- Contradiction detection: what happens when enrichment data conflicts with manual input?

### D. Decision Support
- What-if scenarios: "if we close Investor X, how does it affect Investor Y's FOMO score?"
- Optimal sequencing: which investor to contact next based on current state?
- Risk concentration: are we over-indexed on one investor type?
- Network effects: warm intro chains, co-investor overlap scoring

## Process
1. Read current state of target files
2. Read intelligence-inventory.md for what's already been done
3. Apply each expert's lens to identify gaps
4. Rank improvements by: (predictive power gain) x (implementation feasibility)
5. Implement top improvements
6. Verify build
7. Log to intelligence-inventory.md
8. Log execution to `.claude/skills-state/execution-log.jsonl`:
   ```json
   {"timestamp":"ISO","skill":"intel-boost","version":1,"trigger":"manual|improve-cycle-N","outcome":"success|partial|failure","build_result":"pass|fail","findings_count":N,"changes_made":N,"changes_reverted":0,"type_errors_introduced":0,"rework_needed":false,"notes":"summary"}
   ```
