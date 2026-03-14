# Design Review

Deep design/UX/UI audit of a specific page or the entire app. Produces actionable improvements, not just critique.

## Arguments
$ARGUMENTS — Optional: specific page path (e.g., "enrichment", "investors/[id]", "dashboard"). If empty, audit the full app.

## Expert Panel (10 specialists)

Embody these experts simultaneously when reviewing:

1. **Tobias van Schneider** (ex-Spotify design lead): Brand cohesion, emotional design, micro-interactions that create delight
2. **Linear design team**: Information density done right — lots of data, zero clutter. Keyboard shortcuts, command palette patterns
3. **Stripe Dashboard team**: Data table design, progressive disclosure, metric cards that tell a story at a glance
4. **Mercury design team**: Financial tool aesthetics — trust, precision, calm confidence in every pixel
5. **Dieter Rams**: Is it honest? Is anything unnecessary? Does every element earn its place?
6. **Edward Tufte**: Data-ink ratio. Chart junk elimination. Small multiples. Sparklines over pie charts.
7. **Steve Krug**: Don't make me think. Is the navigation self-evident? Can a first-time user find what they need in 10 seconds?
8. **Accessibility expert (WCAG 2.1 AA)**: Color contrast (4.5:1 minimum), focus indicators, semantic HTML, aria labels
9. **Animation/motion designer**: Meaningful transitions, loading states, skeleton screens, micro-feedback
10. **Enterprise SaaS buyer**: Does this look like it costs $50K/yr or $0? What signals "production-ready" vs "side project"?

## Review Checklist

### Visual Hierarchy
- [ ] Most important info visible without scrolling
- [ ] Clear primary/secondary/tertiary text hierarchy
- [ ] Consistent spacing rhythm (8px grid)
- [ ] No orphaned elements or awkward gaps

### Typography
- [ ] Font sizes from design system (--font-size-xs through --font-size-3xl)
- [ ] Line heights appropriate for content type (1.2 headings, 1.5 body, 1.6 long text)
- [ ] Font weights create clear hierarchy (400 body, 500 labels, 600 section titles, 700 page titles)
- [ ] Tabular nums for data columns

### Color & Contrast
- [ ] All text meets 4.5:1 contrast ratio against its background
- [ ] Status colors (success/warning/danger) used consistently and sparingly
- [ ] Accent color used for exactly one thing per view: the primary action
- [ ] Muted variants for backgrounds, full variants for text/icons

### Interaction Design
- [ ] Every clickable element has a hover state
- [ ] Active/selected states clearly distinguished from hover
- [ ] Loading states for all async operations (skeleton or spinner)
- [ ] Empty states with helpful guidance (not just "No data")
- [ ] Error states with recovery actions

### Information Architecture
- [ ] Page purpose obvious within 2 seconds
- [ ] Related controls grouped logically
- [ ] Progressive disclosure: summary first, detail on demand
- [ ] Consistent patterns across similar page types

## Execution
1. Read the target page(s)
2. Apply each expert's lens
3. Produce a ranked list of improvements (impact x effort)
4. Execute the top improvements directly (don't just list them)
5. Verify build passes
6. For each change, note which expert's perspective drove it
7. Log execution to `.claude/skills-state/execution-log.jsonl`:
   ```json
   {"timestamp":"ISO","skill":"design-review","version":1,"trigger":"manual|improve-cycle-N","outcome":"success|partial|failure","build_result":"pass|fail","findings_count":N,"changes_made":N,"changes_reverted":0,"type_errors_introduced":0,"rework_needed":false,"notes":"summary"}
   ```

## Output
After execution, summarize: what was changed, which expert perspective drove each change, before/after description.
