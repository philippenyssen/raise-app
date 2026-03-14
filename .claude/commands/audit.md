# Code Audit

Comprehensive codebase quality audit. Finds bugs, performance issues, security vulnerabilities, and architectural debt.

## Arguments
$ARGUMENTS — Optional: specific focus (e.g., "security", "performance", "types", "api", "database"). If empty, full audit.

## Expert Panel

1. **Principal SRE (Google)**: Error handling completeness, graceful degradation, retry logic, timeout handling
2. **Security engineer (OWASP)**: SQL injection via Turso, XSS in rendered content, auth bypass, CSRF, secret exposure
3. **Performance engineer (Netflix)**: Bundle size, unnecessary re-renders, N+1 queries, lazy loading opportunities, memoization
4. **TypeScript architect**: Type safety gaps, `any` usage, missing generics, discriminated unions where appropriate
5. **API design specialist (Stripe)**: Consistent error formats, proper HTTP status codes, pagination, rate limiting

## Audit Checklist

### Security
- [ ] All user input sanitized before DB queries
- [ ] No secrets in client-side code
- [ ] Auth middleware on all protected API routes
- [ ] Content-Security-Policy headers
- [ ] Rate limiting on enrichment/AI endpoints

### Error Handling
- [ ] All fetch() calls have error handling
- [ ] API routes return consistent error format: { error: string }
- [ ] Client-side error boundaries wrap all pages
- [ ] Async operations have timeouts
- [ ] Failed enrichment providers don't block others

### Performance
- [ ] No synchronous operations blocking the event loop
- [ ] Database queries use proper indexes
- [ ] Large lists are virtualized or paginated
- [ ] Images/assets are optimized
- [ ] Unnecessary client-side state

### Type Safety
- [ ] No `as any` or `as unknown as X` without justification
- [ ] All API responses are typed
- [ ] Discriminated unions for status states
- [ ] Generic functions where patterns repeat

### Code Quality
- [ ] No dead code or unused imports
- [ ] No duplicated logic (DRY violations)
- [ ] Consistent naming conventions
- [ ] Files under 500 lines (split if larger)

## Process
1. Run `npx tsc --noEmit` for type errors
2. Scan all API routes for security issues
3. Check all fetch() calls for error handling
4. Review database query patterns
5. Check bundle size with `npx next build`
6. **FIX everything found** — don't just report. If you identify a CRITICAL issue, fix it NOW in this cycle. Use parallel agents for independent fixes. A cycle that identifies 3 CRITICAL issues but makes 0 changes is a FAILED cycle, not a "partial" success.
7. If a fix is genuinely too large (>50 lines across multiple files), implement a minimal version and log the remainder as a task for the next cycle. But default to fixing.
8. Verify build passes after fixes
8. Log execution to `.claude/skills-state/execution-log.jsonl`:
   ```json
   {"timestamp":"ISO","skill":"audit","version":1,"trigger":"manual|improve-cycle-N","outcome":"success|partial|failure","build_result":"pass|fail","findings_count":N,"changes_made":N,"changes_reverted":0,"type_errors_introduced":0,"rework_needed":false,"notes":"summary"}
   ```
