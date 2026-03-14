# CEO & Strategy Review

Zoom out to 30,000 feet. Is this the right product? Is it positioned correctly? What's the moat? What would make this a $100M company vs a side project?

## Arguments
$ARGUMENTS — Optional: specific strategic question. If empty, full strategic audit.

## Expert Panel (5 experts)

1. **Jensen Huang (NVIDIA CEO)**: Platform thinking. Is this a tool or a platform? Where's the flywheel? What creates lock-in? A tool gets replaced. A platform becomes infrastructure.
2. **Frank Slootman (Snowflake/ServiceNow CEO)**: Ruthless prioritization. What features are vanity? What's the one metric that matters? If you could only ship one thing this month, what moves the needle most?
3. **Patrick Collison (Stripe CEO)**: Developer-quality craft applied to fundraising. Is this 10x better than a spreadsheet + email? Would a founder pay $10K/month for this? Why or why not?
4. **Stewart Butterfield (Slack founder)**: What's the "magic moment" where a user realizes they can't go back? Have we built it? What creates the habit loop?
5. **Ben Thompson (Stratechery)**: Aggregation theory. Does this product aggregate demand or supply? What's the competitive moat — is it data, network effects, switching costs, or just features?

## Strategic Questions

### A. Product-Market Fit
- Who is the ideal user? (Founder raising Series C? CFO? IR team? Board member?)
- What's their current workflow without this tool?
- What's the 10x improvement? (Speed? Intelligence? Confidence? All three?)
- Would they pay for this? How much? Why?

### B. Competitive Positioning
- What exists today? (Affinity, DealCloud, Visible.vc, spreadsheets)
- What can this tool do that NOTHING else can?
- What's trivially replicable vs genuinely defensible?
- Is the AI intelligence layer the moat or just a feature?

### C. Product Completeness
- Can a founder use ONLY this tool for their entire raise?
- What forces them to leave the product? (Email? Calendar? Data room? DocuSign?)
- Which missing integration would be highest-leverage?

### D. Growth & Monetization
- What's the expansion path? (Single raise → all raises → ongoing IR → board management?)
- Is there a network effect? (More users = more data = better intelligence?)
- What's the pricing model? Per-seat? Per-raise? Success fee?

### E. Moat Assessment
- Data moat: Does usage create proprietary data that improves the product?
- Intelligence moat: Does the AI get smarter with more fundraises?
- Workflow moat: Is the product embedded in daily habits?
- Switching cost: What would a user lose by switching away?

## Process
1. Read sidebar, all page routes, database schema, key features
2. Apply each expert's strategic lens
3. Identify the 3 highest-leverage strategic gaps
4. For each: recommend a concrete product change (not just strategy advice)
5. Execute changes that are actionable within a single session
6. Log findings
7. Log execution to `.claude/skills-state/execution-log.jsonl`:
   ```json
   {"timestamp":"ISO","skill":"strategy-review","version":1,"trigger":"manual|improve-cycle-N","outcome":"success|partial|failure","build_result":"pass|fail","findings_count":N,"changes_made":N,"changes_reverted":0,"type_errors_introduced":0,"rework_needed":false,"notes":"summary"}
   ```

## Output
Ranked list of strategic insights, each with:
- Insight (what the expert sees)
- Impact (how it changes the product's trajectory)
- Action (specific code/feature change)
- Expert (who identified it)
