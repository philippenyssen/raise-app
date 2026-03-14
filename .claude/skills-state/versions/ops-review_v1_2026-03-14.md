# Reliability & Operations Review

Does the product work flawlessly under real conditions? Every failed API call, every unhandled error, every timeout is a moment where the user loses trust. A fundraise tool that crashes during a critical moment is worse than no tool at all.

## Arguments
$ARGUMENTS — Optional: specific area (e.g., "api", "database", "auth", "errors"). If empty, full operational audit.

## Expert Panel (5 experts)

1. **Werner Vogels (AWS CTO)**: "Everything fails all the time." Are API failures handled gracefully? Database timeouts? AI provider outages? Network errors? What happens when Turso is slow? When Claude API is down? When enrichment providers rate-limit us?
2. **Charity Majors (Honeycomb CEO)**: Observability. Can we tell what's happening in production? Are errors logged with enough context to debug? Are there patterns we're missing? Would a P1 be silent until a user reports it?
3. **Jessie Frazelle (Security)**: Input validation on EVERY API route. Auth on EVERY protected endpoint. No SQL injection through Turso. No XSS from rendered content. No secrets in client bundles. CORS headers. CSP headers. Rate limiting on expensive operations (AI, enrichment).
4. **Kelsey Hightower (Infrastructure)**: Build reliability. Does `npx next build` always pass? Are there environment-dependent behaviors? Does the app degrade gracefully if env vars are missing? Is the Vercel deployment deterministic?
5. **Julia Evans (Debugging)**: Developer experience. When something goes wrong, can the developer (or user) tell WHAT happened? Are error messages actionable? Are console logs meaningful? Can you reproduce a bug from the error alone?

## Audit Checklist

### API Routes
For EVERY route in `src/app/api/`:
- [ ] Has try/catch with meaningful error response
- [ ] Returns consistent error format: `{ error: string }`
- [ ] Uses correct HTTP status codes (400 for bad input, 404 for not found, 500 for server error)
- [ ] Validates input before processing
- [ ] Handles missing/malformed request body
- [ ] Has timeout for external calls (AI, enrichment, database)
- [ ] Doesn't expose internal errors to client

### Database Operations
- [ ] All queries have error handling
- [ ] Connection failures are handled (Turso might be unreachable)
- [ ] Large result sets are paginated
- [ ] Write operations are atomic where needed
- [ ] Schema migrations are idempotent

### AI Operations
- [ ] Claude API failures return graceful fallbacks
- [ ] AI responses are validated/parsed with error handling
- [ ] Prompts don't leak sensitive data
- [ ] Rate limits are respected
- [ ] Timeouts prevent hung requests

### Enrichment Pipeline
- [ ] Failed providers don't block the pipeline
- [ ] Rate limits are tracked and respected per provider
- [ ] Stale data is detected and flagged
- [ ] Enrichment jobs are idempotent (re-running doesn't duplicate data)

### Client-Side
- [ ] All fetch() calls have error handling
- [ ] Loading states for all async operations
- [ ] Network errors show user-friendly messages
- [ ] Client doesn't crash on unexpected API responses
- [ ] No unhandled promise rejections

### Security
- [ ] No secrets in client-side code
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] Auth middleware on protected routes (if applicable)
- [ ] Input sanitization before database queries
- [ ] No eval() or dynamic code execution with user input

### Build & Deploy
- [ ] `npx tsc --noEmit` passes
- [ ] `npx next build` passes
- [ ] No warnings that indicate real issues
- [ ] Environment variables are documented and validated at startup

## Process
1. Run `npx tsc --noEmit` for type errors
2. List and audit every API route
3. Check all fetch() calls in client components
4. Review database operations for error handling
5. Test AI prompt/response handling
6. Check enrichment pipeline resilience
7. Fix everything found — don't just report
8. Verify build passes after fixes
9. Log execution to `.claude/skills-state/execution-log.jsonl`:
   ```json
   {"timestamp":"ISO","skill":"ops-review","version":1,"trigger":"manual|improve-cycle-N","outcome":"success|partial|failure","build_result":"pass|fail","findings_count":N,"changes_made":N,"changes_reverted":0,"type_errors_introduced":0,"rework_needed":false,"notes":"summary"}
   ```
