# Self-Improving Loop — COMPREHENSIVE (50+ Experts, 10 Panels, Self-Evolving Skills)

Run a FULL-SPECTRUM improvement cycle across EVERY dimension of the product AND the improvement system itself. Not a partial review. Not just code quality. This is a complete CEO-to-pixel audit by 50+ domain experts with self-evolving skills that get better every cycle.

## Arguments
$ARGUMENTS — Optional: specific panel name (e.g., "strategy", "product", "design", "ai", "workflow", "copy", "competitive", "ops", "skills"). If empty, run ALL 10 panels + skill evolution.

## The 10 Expert Panels

### Panel 1: CEO & Strategy — `/strategy-review`
*Are we building the right thing? What's the moat? What's the 10x insight?*

### Panel 2: Product Manager — `/product-review`
*Is every feature complete? Every flow frictionless? Every job-to-be-done served?*

### Panel 3: Design & UX — `/design-review`
*Is every pixel intentional? Every interaction delightful? Every state handled?*

### Panel 4: Engineering & Architecture — `/audit`
*Is the code correct, performant, secure, and maintainable?*

### Panel 5: AI & Intelligence Quality — `/intel-boost`
*Are AI outputs useful? Are predictions calibrated? Are scores meaningful?*

### Panel 6: Data Enrichment Pipeline — `/enrich-improve`
*Is the data reliable, fresh, comprehensive, and feeding into decisions?*

### Panel 7: Workflow & Automation — `/workflow-review`
*Does the product automate the tedious and surface the important?*

### Panel 8: Copywriting & Microcopy — `/copy-review`
*Does every word earn its place? Is the voice consistent? Are empty states helpful?*

### Panel 9: Competitive Edge & Feature Gaps — `/competitive-review`
*How does this compare to alternatives? What's our unfair advantage? What's missing?*

### Panel 10: Reliability & Operations — `/ops-review`
*Does everything work under real conditions? Are errors handled? Is data safe?*

## Process

### Phase 0: Skill Evolution (BEFORE everything else)
Run `/skill-evolve` to inspect and amend the skills themselves:
1. Read `.claude/skills-state/execution-log.jsonl` for recent execution outcomes
2. Identify underperforming skills (high failure rate, stale references, repeated findings)
3. Amend skill files based on evidence — version before changing
4. Also inspect product AI skills (`ai.ts` prompts, `scoring.ts` weights, enrichment providers)
5. Log amendments to `.claude/skills-state/amendments.md`

This ensures the improvement system itself improves BEFORE the panels run.

### Phase 1: Scan (2 min)
Read in parallel:
- `.planning/intelligence-inventory.md` — know what's done, never re-suggest
- `src/components/sidebar.tsx` — understand the product surface area
- Sample 3-5 pages to understand current quality baseline
- `npx next build` — confirm current state compiles

### Phase 2: Diagnose (parallel agents)
Launch ALL 10 panels as parallel agents. Each panel:
1. Reads relevant files
2. Applies its expert perspectives
3. Returns a ranked improvement list: CRITICAL / HIGH / MEDIUM / LOW

### Phase 3: Prioritize
Stack-rank ALL findings across ALL panels by:
**`(Impact on user's fundraise success) × (Implementation feasibility) × (Not already done)`**

Categories:
- **CRITICAL**: Broken, missing core functionality, or fundamentally wrong approach
- **HIGH**: Significant quality/UX/intelligence gap that users would notice
- **MEDIUM**: Polish, optimization, competitive parity feature
- **LOW**: Minor refinement, future-proofing

### Phase 4: Execute
Implement top 5-10 improvements. Use parallel agents for independent changes.

### Phase 5: Verify
1. `npx tsc --noEmit` — zero TypeScript errors
2. `npx next build` — passes clean
3. Scan for Tailwind color classes in .tsx files — must be zero

### Phase 6: Observe (NEW — after execution)
Log this cycle's execution to `.claude/skills-state/execution-log.jsonl`:
- For each panel that ran: skill name, outcome, findings count, changes made, build result
- For any skill that failed or produced rework: log failure reason
- For any user feedback received: log the correction
This feeds the NEXT cycle's Phase 0 skill evolution.

### Phase 7: Log
Append to `.planning/intelligence-inventory.md`:
```
## Cycle [N] — [date]
Panels: [which panels ran]
Skills evolved: [which skills were amended, if any]
- [improvement]: [what changed] ([file]) — Panel: [which panel], Expert: [which expert]
```

### Phase 8: Continue
After completing one cycle, immediately start the next. Never stop. Each cycle compounds.
The skills themselves get better, the panels get sharper, the product converges on perfection.

## Cycle Rules
- Never re-implement something already in intelligence-inventory.md
- Every change must compile — verify with build
- Always use design tokens (var(--*)) for any UI changes
- Prefer surgical, high-impact changes over broad refactors
- If a finding requires >30 min, create a task instead of blocking the cycle
- Log everything — future cycles depend on knowing what's been done
- Run agents in parallel to maximize throughput
- Skills evolve based on EVIDENCE, not speculation
- Version skills before amending — rollback must be possible
- Product AI skills (prompts, weights, providers) are skills too — evolve them
