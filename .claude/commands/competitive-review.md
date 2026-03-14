# Competitive Edge & Feature Gap Analysis

How does this product compare to every alternative? What's the unfair advantage? What features are table-stakes that we're missing? What would make someone say "nothing else comes close"?

## Arguments
$ARGUMENTS — Optional: specific competitor or category. If empty, full competitive landscape analysis.

## Expert Panel (5 experts)

1. **Peter Thiel (Zero to One)**: What can this product do that NO other tool can? What's the secret? If you're competing on features, you've already lost. What's the 10x insight that makes this a monopoly?
2. **Andy Grove (Only the Paranoid Survive)**: What technology shift makes this product possible NOW that wasn't before? (AI, LLMs, real-time data enrichment.) Are we exploiting the inflection point or just adding AI as a feature?
3. **Clayton Christensen (Innovator's Dilemma)**: Are we competing on the SAME axes as incumbents (more features, better UI) or creating NEW dimensions of value (intelligence, prediction, automation)?
4. **Marc Andreessen (Software Eating the World)**: What parts of the fundraise process are STILL manual that should be software? What would a founder do if they had a full-time AI chief of staff for their raise?
5. **Keith Rabois (Founders Fund/Khosla)**: What would the 10x version look like? If we had unlimited engineering, what would blow people away? What's the feature that makes VCs WANT to use this too?

## Competitive Landscape

### Direct Competitors
1. **Affinity CRM** — Relationship intelligence, email/calendar sync, deal flow management
   - Their strength: automatic data capture from email/calendar
   - Our advantage: AI-powered scoring, prediction, and decision support
   - Gap to close: ?

2. **DealCloud (Intapp)** — Enterprise deal management for PE/VC
   - Their strength: institutional-grade reporting, compliance
   - Our advantage: founder-first UX, AI intelligence layer
   - Gap to close: ?

3. **Visible.vc** — Investor updates and fundraise management
   - Their strength: investor update templates, KPI tracking
   - Our advantage: full CRM + intelligence + enrichment
   - Gap to close: ?

4. **Carta** — Cap table, 409A, fundraising tools
   - Their strength: cap table source of truth, investor network
   - Our advantage: fundraise execution focus, meeting intelligence
   - Gap to close: ?

5. **DocSend** — Document analytics
   - Their strength: view tracking, virtual data room
   - Our advantage: integrated with full fundraise workflow
   - Gap to close: ?

6. **Spreadsheet + Email** — The real competitor
   - Their strength: flexibility, familiarity, zero learning curve
   - Our advantage: intelligence, automation, nothing falls through cracks
   - Gap to close: Must be EASIER than a spreadsheet for basic tasks

### Adjacent Competitors
7. **PitchBook/Crunchbase** — Investor data
8. **LinkedIn Sales Navigator** — Relationship management
9. **Notion/Airtable** — Generic project management
10. **ChatGPT/Claude** — Ad-hoc AI analysis

## Feature Gap Analysis Framework

For each competitor, ask:
1. What do they do that we DON'T? (Table-stakes gaps)
2. What do they do that we do BETTER? (Competitive advantages)
3. What do they do that we SHOULDN'T copy? (Different positioning)
4. What do NEITHER of us do that we SHOULD? (Whitespace opportunities)

## Whitespace Opportunities (AI-native features no one has)
- Predictive pipeline scoring with calibrated confidence intervals
- Auto-generated investor briefs before every meeting
- Real-time competitive intelligence across the fundraise
- AI objection coach that learns from every meeting
- Network graph showing warm intro paths
- Automated follow-up choreography with measured effectiveness
- Convergence scoring (how close is the fundraise to closing?)
- Document improvement flags from meeting feedback
- Acceleration actions triggered by behavioral signals

## Process
1. Read every page and feature in the app
2. Map features against competitors
3. Identify: table-stakes gaps, advantages, whitespace
4. For each gap: is it worth closing? How hard? How impactful?
5. For each whitespace: is it built? Is it visible? Is it good enough?
6. Implement the highest-impact improvements
7. Verify build
8. Log execution to `.claude/skills-state/execution-log.jsonl`:
   ```json
   {"timestamp":"ISO","skill":"competitive-review","version":1,"trigger":"manual|improve-cycle-N","outcome":"success|partial|failure","build_result":"pass|fail","findings_count":N,"changes_made":N,"changes_reverted":0,"type_errors_introduced":0,"rework_needed":false,"notes":"summary"}
   ```
