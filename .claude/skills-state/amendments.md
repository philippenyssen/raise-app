# Skill Amendments Log

Tracks every amendment to every skill with rationale, evidence, and evaluation results.
Skills are living components — they evolve based on execution outcomes.

## Amendment Format
```
### [YYYY-MM-DD] [skill-name] v[N] → v[N+1]
**Trigger**: What execution pattern triggered this amendment
**Evidence**: Specific execution log entries that support the change
**Change**: What was modified in the skill file
**Rationale**: Why this change should improve outcomes
**Evaluation**: [PENDING | IMPROVED | NEUTRAL | REGRESSED | ROLLED_BACK]
**Metrics**: Before/after comparison (if available)
```

---

### 2026-03-14 audit v1 → v2
**Trigger**: Cycle 38 — audit identified 3 CRITICAL issues but made 0 changes (outcome: partial, rework_needed: true)
**Evidence**: execution-log.jsonl entry: `{"skill":"audit","outcome":"partial","changes_made":0,"rework_needed":true,"failure_reason":"identified JSON.parse and timeout issues but did not fix them in this cycle"}`
**Change**: Strengthened "Fix everything found" to explicit mandate: "If you identify a CRITICAL issue, fix it NOW. A cycle that identifies 3 CRITICAL issues but makes 0 changes is a FAILED cycle." Added fallback for genuinely large fixes.
**Rationale**: The skill's own instruction (#6) says "Fix everything found — don't just report" but the agent still deferred. Making the language more explicit and framing non-fixes as failures should change behavior.
**Evaluation**: PENDING
**Metrics**: Before: 3 findings, 0 changes. After: TBD next cycle.

### 2026-03-14 ops-review v1 → v2
**Trigger**: Cycle 38 — ops-review identified 3 CRITICAL issues but deferred all fixes (outcome: partial, rework_needed: true)
**Evidence**: execution-log.jsonl entry: `{"skill":"ops-review","outcome":"partial","changes_made":0,"rework_needed":true,"failure_reason":"identified issues but deferred fixes to next cycle"}`
**Change**: Same amendment pattern as audit — explicit "FAILED cycle" framing for 0-change cycles. Added complexity threshold (>100 lines) for legitimate deferral.
**Rationale**: Same root cause as audit — skill says "fix" but agent defers. Stronger language + explicit failure criteria.
**Evaluation**: PENDING
**Metrics**: Before: 3 findings, 0 changes. After: TBD next cycle.

### 2026-03-14 improve v1 → v2
**Trigger**: User feedback: "demanded more comprehensive expert coverage - 5 panels not enough"
**Evidence**: execution-log.jsonl entry: `{"skill":"improve","user_feedback":"demanded more comprehensive expert coverage - 5 panels not enough"}`
**Change**: Added Phase 0 (skill evolution) and Phase 6 (observation logging). Skills now evolve before panels run and log outcomes after. Product AI skills (ai.ts, scoring.ts, enrichment) included in evolution scope.
**Rationale**: Static skills degrade as codebase changes. Self-evolution loop ensures skills stay current. Observation data feeds evidence-based amendments.
**Evaluation**: PENDING
**Metrics**: Before: 5 panels, no skill evolution, no observation. After: 10 panels, skill evolution phase, observation logging.

### 2026-03-14 [all skills] v1 → v1.1
**Trigger**: No observation data — skills had no logging step
**Evidence**: execution-log.jsonl was empty before manual seeding. No skill could be evaluated without observation data.
**Change**: Added execution logging step (step N+1) to all 11 remaining skills. Each logs to `.claude/skills-state/execution-log.jsonl` with standardized schema.
**Rationale**: Cannot evolve what you cannot observe. Every skill must produce execution telemetry for the skill-evolve loop to function.
**Evaluation**: PENDING
**Metrics**: Before: 0/13 skills had logging. After: 13/13 skills have logging.

### 2026-03-14 [product AI skills] v1 → v1.1
**Trigger**: No observation data for product AI functions (analyzeMeetingNotes, analyzePatterns, etc.)
**Evidence**: No `skill_executions` table existed. JSON parse failures were silently swallowed.
**Change**: (1) Added `skill_executions` DB table. (2) Added `safeParseJSON` helper replacing bare JSON.parse across 7 AI functions. (3) Added `logSkillExecution` calls to all 7 functions (analyzeMeetingNotes, analyzePatterns, assessProcessHealth, checkConsistency, findWeakArguments, researchInvestor, researchCompetitor, researchMarketDeals). (4) Created `/api/skills` route + `/skills` dashboard page.
**Rationale**: Product AI skills were a black box — no way to know if prompts were producing good output, if JSON parse was failing, or which skills were underperforming. Now every AI call is tracked.
**Evaluation**: PENDING
**Metrics**: Before: 0 AI skill telemetry. After: 8 functions instrumented, DB table, API, dashboard.

