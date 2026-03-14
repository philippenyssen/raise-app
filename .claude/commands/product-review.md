# Product Manager Review

Feature-by-feature audit of every page, every flow, every interaction. A ruthless PM who won't ship anything that's 80% done.

## Arguments
$ARGUMENTS — Optional: specific page or flow (e.g., "meetings", "investor detail", "onboarding"). If empty, audit everything.

## Expert Panel (5 experts)

1. **Shreyas Doshi (ex-Stripe/Twitter PM)**: High-leverage vs low-leverage. Which features are "work about work" vs actual value creation? What's the LNO framework say — is this a Leverage, Neutral, or Overhead task?
2. **Lenny Rachitsky (Lenny's Newsletter)**: Activation & retention. What's the onboarding? Time to value? Where do users drop off? What's the "aha moment"?
3. **Julie Zhuo (ex-Facebook VP Design)**: Feature completeness. For each page: can the user accomplish their FULL goal without leaving? What's half-built?
4. **Marty Cagan (SVPG)**: Outcome-driven. Are we building features or solving problems? What outcome does each page drive?
5. **Teresa Torres (Continuous Discovery)**: Opportunity mapping. What's the user's desired outcome? What are the opportunities to serve it? Are we missing the biggest one?

## Page-by-Page Audit Framework

For EVERY page in the app, answer:

### The 5 Questions
1. **Job-to-be-done**: What is the user trying to accomplish on this page?
2. **Completeness**: Can they fully accomplish it? What forces them to leave?
3. **Friction**: How many clicks/steps to complete the core task? Can we reduce it?
4. **Intelligence**: Is the page SMART or just a display? Does it surface insights the user wouldn't find alone?
5. **Delight**: Is there anything that makes the user think "wow, this is good"? Or is it purely functional?

### Feature Completeness Checklist
For each page:
- [ ] Primary action is obvious and accessible
- [ ] Data is sortable, filterable, and searchable where appropriate
- [ ] Bulk actions exist where users would need them
- [ ] Export/share functionality if the data is used elsewhere
- [ ] Keyboard shortcuts for power users
- [ ] Empty state guides the user toward value
- [ ] Error states offer recovery paths
- [ ] Loading states are informative (skeleton, not spinner)
- [ ] The page tells you what to DO, not just what IS

### User Flows to Trace
1. **New fundraise setup**: First launch → configure → first investor → first meeting → first insight
2. **Pre-meeting prep**: Select investor → get briefing → know what to say → walk in confident
3. **Post-meeting capture**: Meeting ends → capture notes → AI extracts insights → follow-ups generated → nothing falls through cracks
4. **Pipeline management**: See all investors → understand where each stands → know who to focus on → take action
5. **Investor deep-dive**: Select investor → see everything known → enrichment data → meeting history → scoring → strategic assessment
6. **Document preparation**: Create document → iterate → get AI feedback → finalize → share
7. **Analytics & reporting**: See fundraise health → identify bottlenecks → take corrective action
8. **Decision support**: Which investor to prioritize? When to follow up? What to say? → AI recommends

## Process
1. Read every page file in `src/app/`
2. Read the sidebar to understand navigation structure
3. Apply the 5 Questions to each page
4. Trace all 8 user flows — identify broken links, dead ends, missing steps
5. Rank findings by impact on fundraise success
6. Execute top improvements
7. Verify build
8. Log execution to `.claude/skills-state/execution-log.jsonl`:
   ```json
   {"timestamp":"ISO","skill":"product-review","version":1,"trigger":"manual|improve-cycle-N","outcome":"success|partial|failure","build_result":"pass|fail","findings_count":N,"changes_made":N,"changes_reverted":0,"type_errors_introduced":0,"rework_needed":false,"notes":"summary"}
   ```

## Improvement Categories
- **Missing features**: Things users need that don't exist
- **Incomplete features**: Things that exist but are half-built
- **Unintelligent features**: Things that display data but don't add insight
- **Friction points**: Things that take too many steps
- **Dead ends**: Places where the user gets stuck with no next action
