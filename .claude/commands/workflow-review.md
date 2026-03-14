# Workflow & Automation Review

Audit the end-to-end user workflows. Does the product automate the tedious and surface the important? Does it make a fundraise feel managed, not chaotic?

## Arguments
$ARGUMENTS — Optional: specific workflow (e.g., "post-meeting", "follow-up", "prep", "pipeline"). If empty, audit all workflows.

## Expert Panel (5 experts)

1. **Tiago Forte (Building a Second Brain)**: Information capture & retrieval. Is every meeting note, objection, signal, and insight being captured AND resurfaced at the RIGHT time? The value isn't in storing data — it's in surfacing it when it matters.
2. **David Allen (GTD)**: Task & commitment management. Are next actions clear and current? Is anything falling through cracks? Does the system have a trusted "inbox" where nothing gets lost?
3. **Cal Newport (Deep Work)**: Focus & leverage. Does the product help the user focus on high-leverage activities (meeting prep, relationship building) or drown them in dashboards and admin? Every feature should pass the test: "Does this help close the round?"
4. **Atul Gawande (Checklist Manifesto)**: Process reliability. Are critical workflows (post-meeting, follow-up, pre-meeting prep) checklist-driven so nothing gets missed? Complexity requires checklists, not heroism.
5. **James Clear (Atomic Habits)**: Behavioral design. Does the product make good fundraising habits easy and bad ones hard? What's the cue-routine-reward loop? Does the product create a daily habit or is it something users "should use but don't"?

## Core Workflows to Audit

### 1. Daily Rhythm
- What does the user see when they open the app each morning?
- Is there a "today" view — meetings coming up, follow-ups due, actions needed?
- Does the app tell the user THE ONE THING they should do right now?
- Priority inbox: what needs attention most urgently?

### 2. Pre-Meeting Prep (T-30 min before meeting)
- Can I get a complete investor briefing in 60 seconds?
- Does it include: who they are, what they care about, past meetings, objections, competitive intel, recommended talking points?
- Is the prep ACTIONABLE or just informational?
- Does it tell me what to AVOID as well as what to SAY?

### 3. During-Meeting Capture
- Is there a fast way to capture notes during/after a meeting?
- Voice input? Quick-capture form? AI-assisted transcription?
- Does it distinguish between: facts, quotes, signals, objections, next steps?

### 4. Post-Meeting Processing
- AI extracts: objections, enthusiasm signals, next steps, competitive intel, questions asked
- Auto-generates: follow-up tasks, document flags, investor status update suggestions
- Triggers: enrichment refresh, score recalculation, relationship graph update, acceleration actions
- Timeline: is there a clear "post-meeting checklist" that ensures nothing is missed?

### 5. Follow-Up Choreography
- Are follow-ups timed correctly? (Thank-you 2hr, materials 24hr, scheduling 48-72hr)
- Does the system adapt timing based on investor type and stage?
- Can the user see all pending follow-ups in one view?
- Are follow-ups measured for effectiveness (enthusiasm delta)?

### 6. Pipeline Management
- Can I see my entire funnel at a glance?
- Do I know which investors are stalling, accelerating, or at risk?
- Does the system suggest who to focus on next?
- Can I drag-and-drop investors through stages?
- Are there automated alerts for important changes?

### 7. Document Workflow
- Can I generate investor-specific materials?
- Does the system track which documents were shared with whom?
- Are there version control and collaboration features?
- Does the system flag when documents need updating based on meeting feedback?

### 8. Closing Mechanics
- Term sheet comparison view?
- Negotiation tracker?
- Legal checklist?
- Closing timeline management?

## Automation Gaps to Find
- Manual steps that should be automated
- Data that exists but isn't surfaced at the right moment
- Intelligence that's computed but not actionable
- Patterns detected but not acted upon
- Cross-system connections that should be automatic (meeting → follow-up → score update → acceleration)

## Process
1. Read the database schema (db.ts) to understand what data exists
2. Read all page files to understand what's exposed to the user
3. Trace each of the 8 workflows end-to-end
4. Identify gaps: where the chain breaks, where manual work is needed, where intelligence is missing
5. Rank by: impact on fundraise velocity × implementation feasibility
6. Execute top improvements
7. Verify build
8. Log execution to `.claude/skills-state/execution-log.jsonl`:
   ```json
   {"timestamp":"ISO","skill":"workflow-review","version":1,"trigger":"manual|improve-cycle-N","outcome":"success|partial|failure","build_result":"pass|fail","findings_count":N,"changes_made":N,"changes_reverted":0,"type_errors_introduced":0,"rework_needed":false,"notes":"summary"}
   ```
