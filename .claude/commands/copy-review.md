# Copywriting & Microcopy Review

Every word on every screen must earn its place. Generic, vague, or verbose copy makes a $50K product feel like a template.

## Arguments
$ARGUMENTS — Optional: specific page or component. If empty, audit all user-facing text.

## Expert Panel (5 experts)

1. **Steve Jobs**: Simplicity is the ultimate sophistication. Every label, button, and tooltip should be the simplest possible expression of its meaning. If you can say it in 2 words, don't use 5.
2. **John McPhee (master of nonfiction)**: Precision of language. No jargon unless the user expects it. No filler words. Every sentence should be load-bearing — cut anything that doesn't change the reader's understanding.
3. **Basecamp (37signals)**: Opinionated voice. The product should have a point of view. "Add investor" is generic. "Track a new investor" has intent. The copy should imply a methodology, not just a tool.
4. **Stripe Docs team**: Technical writing excellence. Clear, scannable, progressive disclosure. Headings that answer questions. Labels that describe outcomes, not fields.
5. **Hemingway**: Short sentences. Active voice. Concrete nouns. Strong verbs. Cut the adjectives. "Analyze your pipeline" → "See what's working."

## Audit Targets

### Page Titles & Subtitles
- Does the title tell you what you can DO on this page, not just what it IS?
- "Dashboard" → "Your Fundraise at a Glance"
- "Analytics" → "What's Working (And What Isn't)"
- Is the subtitle useful or just filler?

### Button Labels
- Do buttons describe the OUTCOME, not the action?
- "Submit" → "Send Follow-Up"
- "Add" → "Track New Investor"
- "Delete" → "Remove from Pipeline"
- Are destructive actions clearly labeled?

### Empty States
- Do empty states guide the user to value?
- Bad: "No meetings found"
- Good: "No meetings yet — schedule your first investor meeting to start building momentum"
- Does every empty state have a primary action button?

### Error Messages
- Do errors explain WHAT went wrong AND what to do about it?
- Bad: "Something went wrong"
- Good: "Couldn't save meeting notes — check your connection and try again"
- Are errors recoverable?

### Tooltips & Help Text
- Are they actually helpful or just restating the label?
- Bad: tooltip on "Score" that says "The investor's score"
- Good: tooltip on "Score" that says "Composite score from engagement, momentum, and fit — updated after each interaction"
- Are they present where users might be confused?

### Section Headers
- Do they create scannable structure?
- Are they consistent in tone and format?
- Do they use questions where appropriate? ("How's your funnel?" vs "Funnel Status")

### Metric Labels
- Are units clear? (€, %, days, count)
- Are comparisons meaningful? ("Up 12% this week" vs just "12%")
- Are positive/negative directions obvious?

### Toast Notifications
- Do they confirm the right thing happened?
- Are they specific? ("Investor saved" vs "Meeting with Sequoia saved")
- Do error toasts suggest recovery?

### Navigation Labels
- Does the sidebar tell a story? (Core → CRM → Intel → Docs → Sys)
- Are section names intuitive to a first-time user?
- Do they match the page titles?

## Copy Voice Guidelines
- **Confident, not corporate**: "We found 3 issues" not "There appear to be some potential concerns"
- **Direct, not bossy**: "Consider following up today" not "You should follow up today"
- **Specific, not vague**: "Sequoia's enthusiasm dropped after last meeting" not "Some metrics have changed"
- **Concise, not terse**: Enough words to be clear, no more

## Process
1. Read every page file in `src/app/`
2. Read key components (sidebar, toasts, modals, forms)
3. Extract all user-facing strings
4. Apply each expert's lens
5. Rewrite the worst offenders directly in the code
6. Verify build
7. Log execution to `.claude/skills-state/execution-log.jsonl`:
   ```json
   {"timestamp":"ISO","skill":"copy-review","version":1,"trigger":"manual|improve-cycle-N","outcome":"success|partial|failure","build_result":"pass|fail","findings_count":N,"changes_made":N,"changes_reverted":0,"type_errors_introduced":0,"rework_needed":false,"notes":"summary"}
   ```
