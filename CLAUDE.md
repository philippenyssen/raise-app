# RAISE — Project Instructions

## What This Is
Series C fundraise execution platform. Next.js 16 + TypeScript 5 + React 19 + Turso (SQLite) + Anthropic Claude SDK.
Deployed on Vercel. GitHub: philippenyssen/raise-app.

## Design System (MANDATORY)
Every component uses CSS custom properties from globals.css. **Zero Tailwind color classes allowed.**

- Backgrounds: `var(--surface-0)` through `var(--surface-3)`
- Text: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`, `var(--text-muted)`
- Borders: `var(--border-subtle)`, `var(--border-default)`, `var(--border-strong)`
- Accent: `var(--accent)`, `var(--accent-muted)`, `var(--accent-hover)`
- Status: `var(--success)`, `var(--warning)`, `var(--danger)` + `-muted` variants
- Shadows: `var(--shadow-sm/md/lg/xl)`
- Font sizes: `var(--font-size-xs)` through `var(--font-size-3xl)`
- Spacing: `var(--space-0)` through `var(--space-12)`, `var(--radius-sm/md/lg/xl)`

Tailwind is for **layout only**: flex, grid, p-*, m-*, rounded, gap, w-*, h-*, etc.
Hover states use `onMouseEnter`/`onMouseLeave` with inline styles.
Use `.card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.input`, `.table-row`, `.badge-*` utility classes from globals.css.

## Code Conventions
- `'use client'` at top of interactive pages
- Inline styles with `style={{ }}` for all color/theming
- No `style` prop directly on lucide-react icons typed as `React.ComponentType<{ className?: string }>` — wrap in `<span style={{...}}>` instead
- All DB operations go through `src/lib/db.ts`
- All AI operations go through `src/lib/ai.ts`
- API routes in `src/app/api/*/route.ts`
- Types in `src/lib/types.ts`

## Architecture
- `src/lib/db.ts` — Database layer, scoring engine, prediction calibration (263KB)
- `src/lib/context-bus.ts` — Unified context aggregation from 12-15 data sources (62KB)
- `src/lib/scoring.ts` — 11-dimension investor scoring with phase-dynamic weights (53KB)
- `src/lib/enrichment/` — 9-provider data enrichment system
- `src/components/sidebar.tsx` — Navigation with sections: DAILY, EXECUTE, ANALYZE, TOOLS (15 items)
- `src/app/dealflow/page.tsx` — Consolidated investor health (heat + velocity + momentum)

## Self-Improving Loop (50+ Experts, 10 Panels, Self-Evolving Skills)
This project uses continuous improvement cycles with comprehensive expert coverage.
**Skills are living components** — they evolve based on execution outcomes, not static prompt files.

**Master command**: `/improve` — evolves skills first, runs all 10 panels, picks top improvements, executes them, logs observations.

**Skill evolution**: `/skill-evolve` — observe → inspect → amend → evaluate cycle for ALL skills.

**Individual panels** (each can be run standalone):
| Panel | Command | Focus |
|-------|---------|-------|
| CEO & Strategy | `/strategy-review` | Right product? Moat? 10x insight? Positioning? |
| Product Manager | `/product-review` | Feature completeness? User flows? Jobs-to-be-done? |
| Design & UX | `/design-review` | Pixels? Interactions? States? Visual hierarchy? |
| Engineering | `/audit` | Code quality? Performance? Security? Types? |
| AI & Intelligence | `/intel-boost` | Predictions? Scoring? AI output quality? |
| Data Enrichment | `/enrich-improve` | Pipeline reliability? Data freshness? Providers? |
| Workflow & Automation | `/workflow-review` | End-to-end flows? Automation gaps? Daily rhythm? |
| Copywriting | `/copy-review` | Every label, button, empty state, error message |
| Competitive Edge | `/competitive-review` | Feature gaps? Unfair advantages? Whitespace? |
| Reliability & Ops | `/ops-review` | Error handling? Security? Build reliability? |

**Other commands**: `/page` (scaffold new page), `/ship` (verify + commit + deploy)

## Self-Improving Skills Protocol
Skills exist at two levels — both evolve:

### Level 1: Claude Code Command Skills (`.claude/commands/*.md`)
- Prompt files that guide expert panel behavior
- Evolved by `/skill-evolve` based on execution history
- Versioned in `.claude/skills-state/versions/` before amendment
- Execution logged in `.claude/skills-state/execution-log.jsonl`
- Amendments logged in `.claude/skills-state/amendments.md`

### Level 2: Product AI Skills (code-level)
- AI prompts in `src/lib/ai.ts` — meeting analysis, follow-up generation, briefs
- Scoring weights in `src/lib/scoring.ts` — 11-dimension calibration
- Enrichment providers in `src/lib/enrichment/` — reliability, data quality
- Context aggregation in `src/lib/context-bus.ts` — signal routing
- These evolve through code changes, driven by outcome data

### Observation Protocol
After EVERY skill execution (manual or via `/improve`), log to `.claude/skills-state/execution-log.jsonl`:
- Skill name, version, trigger, outcome (success/partial/failure)
- Build result, findings count, changes made/reverted
- User feedback, failure reasons

### Evolution Loop
```
observe (log outcomes) → inspect (find patterns) → amend (version + change) → evaluate (measure improvement)
```
If an amendment regresses: roll back from versioned copy. If neutral: keep but flag. If improved: mark as new baseline.

Track all improvements in `.planning/intelligence-inventory.md`.
Never re-suggest something already logged there.

## Rules
- Never ask questions. Execute directly.
- Never ask for permissions. Just do it.
- Never add comments, docstrings, or type annotations to code you didn't change.
- Always verify build passes (`npx next build`) after changes.
- Run background agents in parallel whenever possible.
- Commit only when explicitly asked.
