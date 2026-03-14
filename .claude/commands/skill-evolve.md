# Skill Evolution — Self-Improving Skills Engine

Observe, inspect, amend, and evaluate ALL skills — both Claude Code command skills (`.claude/commands/*.md`) and product AI skills (prompts in `ai.ts`, scoring in `scoring.ts`, enrichment in `enrichment/`). Skills are living system components that must evolve as the codebase, model behavior, and user needs change.

## Arguments
$ARGUMENTS — Optional: specific skill name (e.g., "audit", "design-review", "ai-meeting-analysis", "scoring-weights"). If empty, evolve ALL skills.

## The Evolution Loop

### Phase 1: OBSERVE — Read Execution History
Read `.claude/skills-state/execution-log.jsonl` for recent executions. For each skill, compute:
- **Success rate**: How often did it produce useful output?
- **Failure patterns**: What types of failures recur? (build breaks, type errors, rework needed, user corrections, tool call failures)
- **Stale indicators**: Has the codebase changed since the skill was last updated? (new files, renamed functions, shifted architecture)
- **Outcome quality**: Did the skill's outputs survive the next cycle, or were they immediately revised/reverted?

For **product AI skills**, also check:
- `src/lib/ai.ts` — Are prompts producing useful structured output? Are JSON parse failures happening?
- `src/lib/scoring.ts` — Are scoring weights producing meaningful differentiation?
- `src/lib/enrichment/` — Which providers are failing/timing out/returning stale data?

### Phase 2: INSPECT — Diagnose Root Causes
For each underperforming skill, determine the root cause:

| Symptom | Root Cause Category | Fix Type |
|---------|-------------------|----------|
| Build breaks after skill runs | Stale file references | Update target files list |
| Skill finds nothing new | Checklist fully covered | Expand scope or retire |
| Same issue re-suggested | Not reading inventory | Add inventory check instruction |
| AI output poorly structured | Prompt drift | Rewrite prompt template |
| Tool call fails | Environment changed | Update tool usage pattern |
| Expert perspective shallow | Panel too generic | Add domain-specific questions |
| User corrects output pattern | Wrong default approach | Embed correction as rule |
| Scoring undifferentiated | Weights miscalibrated | Recalibrate from outcomes |
| Enrichment provider fails | API changed/rate-limited | Add retry/fallback/remove |

### Phase 3: AMEND — Propose & Apply Changes
For each diagnosed issue:

1. **Version the current skill**: Copy current `.md` file to `.claude/skills-state/versions/{skill-name}_v{N}_{date}.md`
2. **Draft amendment**: Write the specific change needed
3. **Apply amendment**: Edit the skill file directly
4. **Log amendment**: Append to `.claude/skills-state/amendments.md` with:
   - Trigger (what execution pattern caused this)
   - Evidence (specific log entries)
   - Change (what was modified)
   - Rationale (why this should improve outcomes)
   - Evaluation status: PENDING

### Phase 4: EVALUATE — Measure Improvement
After amendment, the NEXT execution of that skill determines if the amendment worked:
- **IMPROVED**: Skill produces better output (fewer failures, higher quality, no rework)
- **NEUTRAL**: No measurable difference
- **REGRESSED**: Skill performs worse → ROLL BACK to previous version
- **ROLLED_BACK**: Previous version restored from `.claude/skills-state/versions/`

Update the amendment log entry with evaluation result.

## Skill Categories to Evolve

### A. Claude Code Command Skills (`.claude/commands/*.md`)
| Skill | Key Signals to Watch |
|-------|---------------------|
| `improve.md` | Are cycles producing real improvements? Or repeating? |
| `audit.md` | Are found issues actually bugs, or false positives? |
| `design-review.md` | Do design changes survive subsequent cycles? |
| `product-review.md` | Are product gaps correctly prioritized? |
| `strategy-review.md` | Are strategic insights actionable within a session? |
| `intel-boost.md` | Do intelligence improvements move scoring accuracy? |
| `enrich-improve.md` | Are new providers actually adding value? |
| `workflow-review.md` | Do workflow changes improve user flow completeness? |
| `copy-review.md` | Do copy changes stick or get overwritten? |
| `competitive-review.md` | Are competitive gaps real or manufactured? |
| `ops-review.md` | Are reliability fixes preventing actual failures? |
| `ship.md` | Are commits clean? Any post-commit fixups needed? |
| `page.md` | Do scaffolded pages match current patterns? |

### B. Product AI Skills (`src/lib/ai.ts`)
| Skill | What to Observe |
|-------|----------------|
| Meeting analysis prompt | JSON parse success rate, field extraction quality |
| Follow-up generation | Are generated follow-ups useful? Timing correct? |
| Investor brief generation | Completeness, accuracy, actionability |
| Objection extraction | Precision (false positives) and recall (missed objections) |
| Scoring rationale | Does the explanation match the score? |
| Context bus aggregation | Are all data sources contributing? Any dead weight? |

### C. Product Intelligence Skills (`src/lib/scoring.ts`, `src/lib/db.ts`)
| Skill | What to Observe |
|-------|----------------|
| 11-dimension scoring | Score variance — are investors meaningfully differentiated? |
| Prediction calibration | Predicted vs actual outcomes |
| FOMO detection | Do FOMO signals correlate with actual competitive pressure? |
| Optimal follow-up timing | Do timed follow-ups get better responses? |
| Network cascade detection | Do suggested cascades actually trigger referrals? |
| Engagement velocity | Does velocity predict conversion? |

### D. Enrichment Skills (`src/lib/enrichment/`)
| Skill | What to Observe |
|-------|----------------|
| Each provider | Success rate, data freshness, response time, rate limits |
| Entity resolution | Match accuracy across sources |
| Profile builder | Completeness of merged profiles |
| Confidence scoring | Calibration of confidence values |

## Evolution Rules
1. **Never amend a skill that's performing well** — "if it ain't broke, don't fix it"
2. **One amendment at a time per skill** — isolate variables to measure impact
3. **Always version before amending** — rollback must be possible
4. **Evidence-based only** — no speculative changes without execution data
5. **Product skills need code changes** — amending `ai.ts` prompts or `scoring.ts` weights is code, not just text
6. **Cross-skill dependencies matter** — if `improve.md` calls `audit.md`, amending `audit.md` affects `improve.md`
7. **Log everything** — future evolution depends on historical data

## Observation Protocol — What to Log After Every Skill Execution

After ANY skill runs (either manually via slash command or as part of `/improve`), append to `.claude/skills-state/execution-log.jsonl`:

```json
{
  "timestamp": "ISO-8601",
  "skill": "skill-name",
  "version": 1,
  "trigger": "manual | improve-cycle-N | cron",
  "outcome": "success | partial | failure",
  "build_result": "pass | fail",
  "findings_count": 5,
  "changes_made": 3,
  "changes_reverted": 0,
  "type_errors_introduced": 0,
  "rework_needed": false,
  "user_feedback": null,
  "failure_reason": null,
  "duration_estimate": "5min",
  "notes": "free-form context"
}
```

## Process
1. Read all execution logs
2. For each skill category (A/B/C/D), compute health metrics
3. Identify the 3 most underperforming skills
4. For each: inspect → diagnose → amend → log
5. For product AI skills: make the actual code changes in ai.ts/scoring.ts/enrichment/
6. Verify build passes
7. Set evaluation status to PENDING
8. Log the evolution cycle to `.planning/intelligence-inventory.md`
