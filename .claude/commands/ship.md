# Ship

Build, verify, commit, and optionally deploy the current state.

## Arguments
$ARGUMENTS — Optional: commit message. If empty, auto-generate from changes.

## Process

### Step 1: Verify
1. Run `npx tsc --noEmit` — zero TypeScript errors required
2. Run `npx next build` — must pass cleanly
3. Scan for any remaining Tailwind color classes: `find src -name "*.tsx" -exec grep -l "bg-zinc-\|bg-gray-\|text-zinc-\|text-gray-" {} \;` — must return empty

### Step 2: Summarize Changes
1. Run `git status` and `git diff --stat`
2. Analyze all staged and unstaged changes
3. Group changes by category: features, fixes, design, intelligence, enrichment, refactor

### Step 3: Commit
1. Stage relevant files (NOT .env, NOT node_modules, NOT .next)
2. Create commit with descriptive message following conventional commits:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `design:` for design system changes
   - `refactor:` for code improvements
   - `chore:` for maintenance
3. Include Co-Authored-By header

### Step 4: Deploy (if requested)
Only if user explicitly says "deploy" or "push":
1. Push to main branch
2. Vercel auto-deploys from main
3. Confirm deployment URL

### Step 5: Log
5. Log execution to `.claude/skills-state/execution-log.jsonl`:
   ```json
   {"timestamp":"ISO","skill":"ship","version":1,"trigger":"manual|improve-cycle-N","outcome":"success|partial|failure","build_result":"pass|fail","findings_count":N,"changes_made":N,"changes_reverted":0,"type_errors_introduced":0,"rework_needed":false,"notes":"summary"}
   ```

## Rules
- Never push without explicit user request
- Never commit .env files or secrets
- Always verify build before committing
- Stage specific files, not `git add -A`
