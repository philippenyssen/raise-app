# RAISE — Two-Layer Architecture for Series C Execution

## Overview

RAISE is a two-layer self-improving system for managing a Series C fundraise. Layer 1 is the **meta-layer** — the process by which Claude Code continuously builds and improves the app itself. Layer 2 is the **app layer** — the production application that the fundraising team uses daily to execute the raise.

The fundamental insight: a fundraise is a convergence problem. You start with a scattered set of materials, a list of potential investors, and an untested narrative. Over 12-16 weeks, everything must converge — story, pricing, terms, funnel, timeline — toward signed term sheets. This app is the control system for that convergence.

---

## Layer 1: Meta-Layer (App Self-Improvement via Claude Code)

### The GSD Loop

Every improvement to RAISE follows a strict cycle:

```
PLAN ──> BUILD ──> VERIFY ──> ASSESS ──> NEXT PHASE
  |                                          |
  └──────────────────────────────────────────┘
```

**PLAN**: Read ARCHITECTURE.md, identify the next phase and its requirements. Review current codebase state. Identify dependencies and blockers.

**BUILD**: Implement the phase — new pages, components, API routes, database migrations, AI prompts. Each phase is a self-contained deliverable.

**VERIFY**: Run `npm run build` to confirm zero TypeScript/build errors. Manual verification of key flows. Check that existing features still work (no regressions). Verify new database tables are created correctly.

**ASSESS**: After each phase, update this document with:
- What was built
- What works / what needs refinement
- What the next phase should prioritize
- Any architectural decisions made during implementation

**NEXT PHASE**: Move to the next numbered phase. Repeat.

### Phase Tracking

Each phase has a status marker:

- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Complete
- `[!]` — Complete but needs refinement

### Principles for the Meta-Layer

1. **No breaking changes.** Every phase must preserve existing functionality. New features are additive.
2. **Database migrations are append-only.** New tables and columns are added in `initializeDb()`. Existing tables are never dropped or altered destructively.
3. **One phase at a time.** Do not combine phases. Each phase is verified independently before starting the next.
4. **AI prompts are the product.** The quality of Claude API prompts determines the quality of the app's intelligence. Prompts should be iterated and refined with the same rigor as code.
5. **The sidebar is the map.** Every major feature gets a sidebar entry. If it is not in the sidebar, it does not exist for the user.

---

## Layer 2: App Layer — Current State

### What Exists Today

**Tech Stack:**
- Next.js 16 (App Router, React 19, Server Components)
- better-sqlite3 (local SQLite database at `raise.db`)
- @anthropic-ai/sdk (Claude API for AI analysis)
- Tailwind CSS 4 (dark theme, zinc-950 base)
- lucide-react (icon library, available but unused so far)
- date-fns (date utilities)

**Pages (6):**

| Route | File | Purpose |
|-------|------|---------|
| `/` | `src/app/page.tsx` | Dashboard — funnel visualization, key metrics, health status, quick actions |
| `/investors` | `src/app/investors/page.tsx` | CRM — full CRUD, status dropdown, tier/type/status filters, enthusiasm dots |
| `/meetings` | `src/app/meetings/page.tsx` | Meeting log — chronological list with AI analysis summaries, objection tags |
| `/meetings/new` | `src/app/meetings/new/page.tsx` | Meeting debrief — paste raw notes, AI extracts questions/objections/signals/next steps |
| `/analysis` | `src/app/analysis/page.tsx` | AI pattern analysis — cross-meeting objection patterns, story effectiveness, material change recommendations |
| `/health` | `src/app/health/page.tsx` | Process health — 10-dimension convergence checklist, funnel conversion rates, status breakdown |
| `/terms` | `src/app/terms/page.tsx` | Term sheet comparison — side-by-side table, automated scoring, red flag detection |

**API Routes (5):**

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/investors` | GET, POST, PUT, DELETE | Full investor CRUD |
| `/api/meetings` | GET, POST, PUT | Meeting CRUD with optional AI analysis on create |
| `/api/health` | GET | Aggregated funnel metrics, tier/status breakdowns, health determination |
| `/api/analyze` | GET | AI pattern analysis across all meetings (calls `analyzePatterns` + `assessProcessHealth`) |
| `/api/seed` | POST | Seeds database with ASL-specific raise config + 22 target investors (8 T1, 8 T2, 6 T3) |

**Database Tables (3):**

| Table | Purpose |
|-------|---------|
| `config` | Key-value store for raise configuration (company name, valuation, pitch, three beliefs) |
| `investors` | Investor records with type, tier, status, partner, fund details, enthusiasm |
| `meetings` | Meeting records with raw notes + AI-extracted structured data (questions, objections, signals) |
| `convergence` | Convergence score snapshots over time |

**AI Functions (3, in `src/lib/ai.ts`):**

| Function | Input | Output |
|----------|-------|--------|
| `analyzeMeetingNotes()` | Raw notes + investor name + meeting type | Structured JSON: questions, objections, engagement signals, enthusiasm score, suggested status |
| `analyzePatterns()` | Array of meeting records | Top objections with recommendations, story effectiveness, pricing trend, material changes |
| `assessProcessHealth()` | Funnel data + objections + recent meetings | Health status (green/yellow/red), diagnosis, recommendations, risk factors |

**Components:**
- `src/components/sidebar.tsx` — Navigation sidebar with 6 entries
- `src/components/ui/` — Empty directory (reserved for shared UI components)

**What works well:**
- Clean dark UI with consistent design language
- AI meeting debrief is the core value prop — paste notes, get structured intelligence
- Funnel visualization gives immediate process visibility
- Term sheet scoring catches common red flags automatically
- Seed data provides realistic starting point for ASL Series C

**What is missing (organized into phases below):**
- No document management (memo, deck, one-pager — the actual deliverables of a fundraise)
- No AI advisor capabilities beyond meeting analysis
- No email/communication tools
- No market intelligence
- No collaboration features
- No process analytics beyond basic funnel
- No investor detail pages (clicking an investor shows nothing)
- No timeline/calendar view
- No action item tracking from meetings

---

## Layer 2: Build Phases

### Phase 0: Foundation Fixes `[ ]`

**What it adds:** Quality-of-life improvements that make the existing app more usable before adding major features.

**Scope:**
1. **Investor detail page** (`/investors/[id]/page.tsx`) — clicking an investor name shows full profile + meeting history + objection summary + timeline of interactions
2. **Sidebar icons** — replace letter placeholders with lucide-react icons
3. **Shared UI components** — extract reusable components to `src/components/ui/` (Button, Input, Select, Card, Badge, Modal, Textarea)
4. **Toast notifications** — success/error feedback on CRUD operations
5. **Loading states** — skeleton UI for all pages during data fetch
6. **Mobile responsiveness** — sidebar collapse on small screens

**Key files to create/modify:**
- `src/app/investors/[id]/page.tsx` — new page
- `src/components/ui/button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`, `modal.tsx` — new components
- `src/components/sidebar.tsx` — add lucide icons
- `src/components/toast.tsx` — notification system

**AI usage:** None in this phase. Pure UI/UX.

**Self-improvement:** After this phase, assess which UI patterns recur most. Extract those into the component library first in future phases.

**Verification:**
- `npm run build` passes
- All existing pages still render
- Investor detail page loads meeting history
- Sidebar icons render correctly
- Toast appears on investor create/update/delete

---

### Phase 1: Document Engine `[ ]`

**What it adds:** The ability to create, edit, version, and AI-refine fundraising documents inside the app. This is critical because the memo, deck, one-pager, and executive brief are the primary deliverables of a fundraise — currently they live outside the app entirely.

**Scope:**
1. **Document model** — new `documents` table with fields: id, title, type (memo/deck/one_pager/exec_brief/custom), content (markdown), version, parent_version_id, status (draft/review/final), created_at, updated_at
2. **Document list page** (`/documents`) — shows all documents grouped by type, with version count and last edited
3. **Document editor page** (`/documents/[id]`) — rich markdown editor with live preview, split-pane layout
4. **Version history** — every save creates a new version. Diff view between any two versions
5. **AI document operations:**
   - "Improve this section" — rewrites a selected section for clarity, concision, or IC-readiness
   - "Check consistency" — cross-references numbers in the document against the raise config and other documents
   - "Find weak arguments" — identifies claims that lack evidence or sourcing
   - "Goldman-style polish" — rewrites in investment banking memo style
6. **Templates** — pre-loaded document templates (Series C memo structure, management presentation outline, one-pager format, executive brief format)
7. **Import from markdown** — paste or upload existing .md files to bootstrap documents

**Key files to create:**
- `src/app/documents/page.tsx` — document list
- `src/app/documents/[id]/page.tsx` — editor + preview + AI panel
- `src/app/documents/new/page.tsx` — create from template or blank
- `src/app/api/documents/route.ts` — CRUD
- `src/app/api/documents/[id]/route.ts` — single document operations
- `src/app/api/documents/[id]/ai/route.ts` — AI operations on document content
- `src/app/api/documents/[id]/versions/route.ts` — version history
- `src/lib/db.ts` — add `documents` and `document_versions` tables
- `src/lib/ai.ts` — add `improveSection()`, `checkConsistency()`, `findWeakArguments()`, `polishGoldmanStyle()`
- `src/lib/types.ts` — add Document, DocumentVersion types
- `src/components/editor.tsx` — markdown editor component
- `src/components/diff-viewer.tsx` — version diff component
- `src/components/sidebar.tsx` — add "Documents" nav entry

**Database additions:**
```sql
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom',
  content TEXT DEFAULT '',
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  content TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  change_summary TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES documents(id)
);
```

**AI usage:**
- `improveSection(section: string, instruction: string, context: string)` — takes a section of text, an instruction (e.g., "make more concise", "add quantitative evidence"), and surrounding context. Returns improved text.
- `checkConsistency(documents: {title: string, content: string}[], raiseConfig: RaiseConfig)` — scans all documents for numerical inconsistencies (e.g., valuation cited as 2.0Bn in one place and 2.5Bn in another). Returns list of discrepancies with locations.
- `findWeakArguments(content: string)` — identifies unsourced claims, circular reasoning, and unsubstantiated superlatives. Returns annotated list.
- `polishGoldmanStyle(content: string)` — rewrites content in concise, authoritative investment banking memo style.

**Self-improvement:** Track which AI operations are used most. Track accept/reject rate on AI suggestions. Use this data to refine prompts in future iterations. If "check consistency" finds real bugs frequently, consider making it run automatically on every save.

**Verification:**
- Create a document from template
- Edit content, save, verify version is created
- Run "check consistency" on two documents with intentional inconsistency — verify it catches it
- View diff between two versions
- `npm run build` passes

---

### Phase 2: AI War Room `[ ]`

**What it adds:** An AI-powered command center where the user can get expert-level advice on fundraising strategy, prepare for specific investor meetings, and track action items.

**Scope:**
1. **War Room page** (`/war-room`) — single page with AI chat interface, contextualized with all raise data
2. **Advisor modes** — AI can be prompted to respond as different expert personas:
   - **VC Partner** — "How would a16z's IC evaluate this?"
   - **Investment Banker** — "Is our process running correctly? What would Goldman do?"
   - **Corporate Lawyer** — "What are the red flags in this term sheet clause?"
   - **Skeptic** — "Play devil's advocate on our valuation"
   - **The Founder** — "Help me practice my pitch for this objection"
3. **Meeting prep generator** — given an investor (from CRM), generates:
   - Investor-specific talking points (based on their thesis, prior objections, fund size)
   - Anticipated questions (based on investor type and what similar investors have asked)
   - Key materials to emphasize (based on which slides landed with similar investors)
   - Red lines and negotiation boundaries
4. **Action tracker** — next steps from meetings become actionable items with owners, due dates, and completion status
5. **AI conversation history** — war room conversations are saved and searchable

**Key files to create:**
- `src/app/war-room/page.tsx` — main war room interface
- `src/app/api/war-room/route.ts` — AI chat endpoint
- `src/app/api/war-room/prep/route.ts` — meeting prep generator
- `src/app/api/actions/route.ts` — action item CRUD
- `src/lib/db.ts` — add `war_room_threads`, `war_room_messages`, `actions` tables
- `src/lib/ai.ts` — add `warRoomChat()`, `generateMeetingPrep()`, `generateActionItems()`
- `src/lib/types.ts` — add WarRoomThread, WarRoomMessage, Action types
- `src/components/chat.tsx` — chat interface component
- `src/components/action-item.tsx` — action item display/edit component
- `src/components/sidebar.tsx` — add "War Room" and "Actions" nav entries

**Database additions:**
```sql
CREATE TABLE IF NOT EXISTS war_room_threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  advisor_mode TEXT DEFAULT 'general',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS war_room_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  advisor_mode TEXT DEFAULT 'general',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (thread_id) REFERENCES war_room_threads(id)
);

CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  source TEXT DEFAULT '', -- 'meeting:uuid' or 'war_room:uuid' or 'manual'
  source_context TEXT DEFAULT '', -- e.g., investor name, meeting date
  owner TEXT DEFAULT '',
  due_date TEXT,
  status TEXT DEFAULT 'open', -- open, in_progress, done, cancelled
  priority TEXT DEFAULT 'medium', -- critical, high, medium, low
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**AI usage:**
- `warRoomChat(messages: Message[], advisorMode: string, context: RaiseContext)` — full raise context (config, funnel stats, recent meetings, top objections) is injected into the system prompt. The advisor mode changes the persona and analytical framework. Streaming response.
- `generateMeetingPrep(investor: Investor, meetings: Meeting[], allObjections: Objection[], raiseConfig: RaiseConfig)` — generates comprehensive prep document tailored to the specific investor. Uses cross-investor pattern data to predict likely questions.
- `generateActionItems(meetingNotes: string, existingActions: Action[])` — extracts action items from meeting notes, de-duplicates against existing actions.

**Self-improvement:** After each meeting, compare the prep predictions vs. what actually happened. Track prediction accuracy. Use this to refine the meeting prep prompt over time. If certain advisor modes are never used, consider removing or merging them.

**Verification:**
- Open War Room, select "VC Partner" mode, ask a question about valuation — verify response is contextual (references ASL data)
- Generate meeting prep for a Tier 1 investor — verify it references their specific thesis and fund details
- Create action items from a meeting — verify they appear in the action tracker
- Verify conversation history persists across page reloads

---

### Phase 3: Process Automation `[ ]`

**What it adds:** Reduces manual work in the fundraise process — email drafting, data room management, and automated reporting.

**Scope:**
1. **Email templates** (`/comms`) — AI-generated emails for each stage:
   - Initial outreach (warm intro request, cold outreach)
   - NDA transmittal
   - Management presentation scheduling
   - Follow-up after meeting (within 24hrs, references specific discussion points)
   - Materials transmittal (memo, deck, model)
   - Data room access invitation
   - Process update (timeline, next steps)
   - Term sheet response / counter
   - Thank you / pass acknowledgment
2. **Data room checklist** (`/data-room`) — tracks what documents are ready for due diligence:
   - Financial (audited financials, model, cap table, projections)
   - Legal (articles, SHA, key contracts, IP schedule, litigation)
   - Commercial (customer contracts, pipeline, backlog)
   - Technical (architecture docs, product roadmap, patents)
   - Team (org chart, key bios, employment agreements)
   - ESG / Compliance
   Each item has status: not started / in progress / ready / uploaded
3. **Weekly digest** — auto-generated summary of the week:
   - Meetings held, enthusiasm trends
   - Funnel movement (who advanced, who dropped)
   - Outstanding action items
   - Upcoming meetings
   - Process health change
4. **Timeline view** (`/timeline`) — Gantt-style view of the raise process:
   - Key milestones (NDA period, management presentations, DD, term sheets, signing, closing)
   - Investor-specific timelines overlaid
   - Critical path identification

**Key files to create:**
- `src/app/comms/page.tsx` — email template generator
- `src/app/data-room/page.tsx` — data room checklist
- `src/app/timeline/page.tsx` — timeline/Gantt view
- `src/app/api/comms/route.ts` — email generation
- `src/app/api/data-room/route.ts` — checklist CRUD
- `src/app/api/digest/route.ts` — weekly digest generation
- `src/lib/db.ts` — add `data_room_items`, `emails`, `digests` tables
- `src/lib/ai.ts` — add `generateEmail()`, `generateDigest()`
- `src/lib/types.ts` — add DataRoomItem, Email, Digest types
- `src/components/timeline.tsx` — Gantt chart component
- `src/components/email-preview.tsx` — email preview with copy-to-clipboard
- `src/components/sidebar.tsx` — add "Comms", "Data Room", "Timeline" nav entries

**Database additions:**
```sql
CREATE TABLE IF NOT EXISTS data_room_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'not_started',
  assignee TEXT DEFAULT '',
  due_date TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  investor_id TEXT,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, sent, replied
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS digests (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**AI usage:**
- `generateEmail(type: string, investor: Investor, meetingHistory: Meeting[], raiseConfig: RaiseConfig, customInstructions?: string)` — generates contextual email. Follow-up emails reference specific discussion points from the most recent meeting. Outreach emails match the investor's thesis language.
- `generateDigest(weekData: {meetings: Meeting[], funnelChanges: object, actions: Action[], upcoming: object[]})` — produces a concise weekly summary with recommendations.

**Self-improvement:** Track which email templates are used most and which are edited heavily before sending. High-edit-rate templates need better prompts. Track data room completion velocity — if items stall, surface them in the weekly digest.

**Verification:**
- Generate a follow-up email for an investor with meeting history — verify it references specific discussion points
- Create a data room checklist — verify items can be updated
- Generate a weekly digest — verify it includes real data from the database
- Timeline renders with investor-specific milestones

---

### Phase 4: Intelligence Layer `[ ]`

**What it adds:** External data feeds and competitive intelligence to inform fundraise strategy in real time.

**Scope:**
1. **Comparable company tracker** (`/intel/comps`) — manually entered comparable valuations (the app does not have access to live market feeds, so this is a structured data entry + AI analysis layer):
   - Company name, valuation, date, multiple (EV/Revenue, EV/EBITDA), source
   - AI analysis: "Based on these comps, your pricing at 39x trailing is [above/below/in-line with] the peer set"
   - Trend charts over time
2. **Investor intelligence** (`/intel/investors`) — enrichment layer on top of CRM:
   - Recent investments (manually logged or noted from meetings)
   - Fund lifecycle stage (early / mid / late deployment)
   - Known preferences and red lines
   - Competitive dynamics (which investors are talking to competitors)
   - AI-generated investor profile synthesis
3. **News tracker** (`/intel/news`) — manually logged market events that affect the raise:
   - Comparable company events (IPO, funding round, acquisition)
   - Sector developments (policy changes, contract wins, competitor failures)
   - Each entry tagged with impact assessment (positive / neutral / negative for ASL raise)
4. **Sentiment tracker** — aggregated view across all interactions:
   - Per-investor sentiment trend over time (from meeting enthusiasm scores)
   - Overall market sentiment (from news events + comparable movements)
   - AI-generated narrative: "Market sentiment has shifted positively over the last 2 weeks because..."

**Key files to create:**
- `src/app/intel/page.tsx` — intelligence dashboard
- `src/app/intel/comps/page.tsx` — comparable company tracker
- `src/app/intel/investors/page.tsx` — investor intelligence
- `src/app/intel/news/page.tsx` — news tracker
- `src/app/api/intel/comps/route.ts` — comp CRUD + AI analysis
- `src/app/api/intel/news/route.ts` — news CRUD
- `src/app/api/intel/sentiment/route.ts` — sentiment analysis
- `src/lib/db.ts` — add `comps`, `news_events`, `investor_intel` tables
- `src/lib/ai.ts` — add `analyzeComps()`, `synthesizeInvestorProfile()`, `analyzeSentiment()`
- `src/lib/types.ts` — add Comp, NewsEvent, InvestorIntel types
- `src/components/chart.tsx` — simple charting component (valuation trends, sentiment over time)
- `src/components/sidebar.tsx` — add "Intel" nav entry with sub-items

**Database additions:**
```sql
CREATE TABLE IF NOT EXISTS comps (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  valuation TEXT NOT NULL,
  date TEXT NOT NULL,
  multiple_type TEXT DEFAULT 'ev_revenue',
  multiple_value REAL,
  source TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS news_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  date TEXT NOT NULL,
  category TEXT DEFAULT 'sector', -- sector, competitor, policy, macro
  impact TEXT DEFAULT 'neutral', -- positive, neutral, negative
  relevance TEXT DEFAULT '', -- how it affects the raise
  source TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS investor_intel (
  id TEXT PRIMARY KEY,
  investor_id TEXT NOT NULL,
  category TEXT NOT NULL, -- recent_deal, preference, red_line, competitive_dynamic
  content TEXT NOT NULL,
  source TEXT DEFAULT '',
  date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (investor_id) REFERENCES investors(id)
);
```

**AI usage:**
- `analyzeComps(comps: Comp[], raiseConfig: RaiseConfig)` — "Given these comparable valuations and our pricing at 2.0Bn pre-money, provide analysis of where we sit vs. the market."
- `synthesizeInvestorProfile(investor: Investor, meetings: Meeting[], intel: InvestorIntel[])` — produces a comprehensive profile combining CRM data, meeting observations, and external intelligence.
- `analyzeSentiment(meetings: Meeting[], newsEvents: NewsEvent[], comps: Comp[])` — produces overall sentiment narrative with trend direction.

**Self-improvement:** Track which intelligence inputs change the user's behavior (e.g., a comp update leading to a pricing adjustment). If certain data types are never entered, consider removing them to reduce noise.

**Verification:**
- Add 3 comparable companies — verify AI analysis references all three
- Add investor intel entries — verify they appear on investor detail page
- Add news events — verify sentiment analysis incorporates them
- Comparable trend chart renders correctly

---

### Phase 5: Collaboration & Workflow `[ ]`

**What it adds:** Multi-user support and structured workflows for the fundraising team.

**Scope:**
1. **User accounts** — simple authentication (email + password, or invite-only tokens):
   - Roles: admin (CEO), operator (CFO, deal lead), advisor (banker, lawyer), viewer
   - Role-based page access (advisors cannot edit investor data, viewers are read-only)
2. **Comment threads** — on any entity (document, investor, meeting, action item):
   - Threaded comments with @mentions
   - Resolution tracking (open / resolved)
3. **Approval workflows** — for critical actions:
   - Term sheet response requires CFO + CEO approval
   - Outreach to Tier 1 investor requires CEO approval
   - Document status change (draft -> review -> final) requires designated reviewer
4. **Activity feed** — chronological log of all system activity:
   - "[User] moved [Investor] from Engaged to In DD"
   - "[User] approved term sheet response to [Investor]"
   - "[AI] detected pricing objection pattern across 5 meetings"
5. **Notifications** — in-app notifications for:
   - New comments mentioning you
   - Approval requests pending
   - Action items due today
   - Weekly digest available

**Key files to create:**
- `src/app/login/page.tsx` — login page
- `src/app/activity/page.tsx` — activity feed
- `src/app/api/auth/route.ts` — authentication
- `src/app/api/comments/route.ts` — comment CRUD
- `src/app/api/approvals/route.ts` — approval workflow
- `src/app/api/activity/route.ts` — activity feed
- `src/lib/db.ts` — add `users`, `comments`, `approvals`, `activity_log`, `notifications` tables
- `src/lib/auth.ts` — authentication utilities
- `src/lib/types.ts` — add User, Comment, Approval, Activity types
- `src/components/comments.tsx` — comment thread component
- `src/components/approval-badge.tsx` — approval status indicator
- `src/components/activity-feed.tsx` — activity feed component
- `src/components/notifications.tsx` — notification bell/dropdown

**Database additions:**
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'viewer',
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'document', 'investor', 'meeting', 'action'
  entity_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id TEXT, -- for threading
  resolved INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  approver_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT,
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (approver_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  read INTEGER DEFAULT 0,
  link TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**AI usage:** Minimal in this phase. AI is used to:
- Auto-generate activity feed summaries ("3 investors advanced this week, 2 meetings logged")
- Suggest comment recipients based on entity ownership

**Self-improvement:** Track which approval workflows create bottlenecks (long pending times). Track which comments lead to actions vs. are ignored. Surface these patterns in the weekly digest.

**Verification:**
- Create two user accounts with different roles — verify access control works
- Add comments on an investor — verify threading and resolution
- Trigger an approval workflow — verify it blocks the action until approved
- Activity feed shows real events in chronological order

---

### Phase 6: Analytics & Optimization `[ ]`

**What it adds:** Deep analytics on the fundraise process, predictive modeling, and optimization recommendations.

**Scope:**
1. **Process analytics** (`/analytics`) — comprehensive dashboard:
   - Time in each funnel stage (average, by investor type, by tier)
   - Bottleneck detection (which stage has the longest dwell time)
   - Velocity metrics (how fast investors move through the funnel)
   - Conversion rate trends over time (weekly/monthly)
   - Materials effectiveness (which documents are shared most, correlation with advancement)
2. **Predictive modeling:**
   - Likelihood to close per investor (based on meeting count, enthusiasm trend, time in stage, investor type)
   - Expected close timeline per investor
   - Probability-weighted commitment amount (sum of all investors * probability)
   - Monte Carlo simulation: "Given current pipeline, what is the probability of closing 250M by target date?"
3. **Pattern matching:**
   - Compare current process metrics against historical fundraise benchmarks
   - Identify investors whose behavior matches known "will close" or "will pass" patterns
   - Surface investors who are "going dark" (no activity for N days)
4. **Optimization recommendations:**
   - "You should follow up with [Investor] — they match the pattern of investors who close after 3 meetings"
   - "Your contact-to-meeting conversion is below benchmark — consider adjusting outreach approach"
   - "3 investors are in DD for more than 4 weeks — this is above average, consider deadline pressure"

**Key files to create:**
- `src/app/analytics/page.tsx` — analytics dashboard
- `src/app/api/analytics/route.ts` — compute analytics
- `src/app/api/analytics/predict/route.ts` — predictive modeling
- `src/lib/analytics.ts` — analytics computation functions
- `src/lib/ai.ts` — add `generateOptimizationRecs()`, `predictCloseProb()`
- `src/lib/types.ts` — add ProcessAnalytics, Prediction types
- `src/components/charts/` — chart components (bar, line, funnel, heatmap)
- `src/components/prediction-card.tsx` — probability display
- `src/components/sidebar.tsx` — add "Analytics" nav entry

**Database additions:**
```sql
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  metrics TEXT NOT NULL, -- JSON blob of all computed metrics
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  investor_id TEXT NOT NULL,
  close_probability REAL,
  expected_close_date TEXT,
  confidence TEXT DEFAULT 'low', -- low, medium, high
  rationale TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (investor_id) REFERENCES investors(id)
);
```

**AI usage:**
- `generateOptimizationRecs(analytics: ProcessAnalytics, investors: Investor[], meetings: Meeting[])` — analyzes current process state and generates specific, actionable recommendations ranked by expected impact.
- `predictCloseProb(investor: Investor, meetings: Meeting[], funnelMetrics: object)` — estimates probability of this investor closing, with rationale. Uses pattern matching against investor type, meeting count, enthusiasm trajectory, and time in current stage.

**Self-improvement:** This phase creates the data needed to optimize itself. Track which recommendations are acted on and whether they lead to positive outcomes. Use this to train better recommendation prompts. Track prediction accuracy over time and recalibrate.

**Verification:**
- Analytics dashboard renders with real data
- Predictions generate for each investor with rationale
- Recommendations are specific and actionable (not generic)
- Going-dark detection flags investors with no activity for 14+ days
- Probability-weighted pipeline total calculates correctly

---

## Cross-Phase Architecture Decisions

### Database Strategy
SQLite (via better-sqlite3) remains the database for all phases. It is single-file, zero-config, and fast enough for a single-fundraise application. If Phase 5 (collaboration) requires concurrent write access from multiple users, consider migrating to PostgreSQL at that point — but not before.

### AI Prompt Strategy
All AI prompts follow a consistent structure:
1. **Role** — who the AI is (fundraising advisor, investment banker, etc.)
2. **Context** — all relevant data from the database (raise config, funnel, meetings, etc.)
3. **Task** — specific instruction
4. **Format** — exact JSON output schema
5. **Constraints** — what NOT to do (do not invent numbers, do not hallucinate investor names, etc.)

Prompts are versioned in `src/lib/ai.ts`. When a prompt is refined, the old version is preserved as a comment for reference.

### State Management
Client-side state uses React `useState` + `useEffect` for data fetching. No global state library is needed until Phase 5 (collaboration). At that point, consider React Context for auth state and SWR or React Query for data fetching with cache invalidation.

### File Organization
```
src/
  app/
    page.tsx              # Dashboard
    layout.tsx            # Root layout with sidebar
    investors/
      page.tsx            # CRM list
      [id]/page.tsx       # Investor detail (Phase 0)
    meetings/
      page.tsx            # Meeting list
      new/page.tsx        # Meeting debrief
    analysis/page.tsx     # AI pattern analysis
    health/page.tsx       # Process health
    terms/page.tsx        # Term sheet comparison
    documents/            # Phase 1
      page.tsx
      [id]/page.tsx
      new/page.tsx
    war-room/page.tsx     # Phase 2
    comms/page.tsx        # Phase 3
    data-room/page.tsx    # Phase 3
    timeline/page.tsx     # Phase 3
    intel/                # Phase 4
      page.tsx
      comps/page.tsx
      investors/page.tsx
      news/page.tsx
    activity/page.tsx     # Phase 5
    login/page.tsx        # Phase 5
    analytics/page.tsx    # Phase 6
    api/
      investors/route.ts
      meetings/route.ts
      health/route.ts
      analyze/route.ts
      seed/route.ts
      documents/          # Phase 1
      war-room/           # Phase 2
      comms/              # Phase 3
      data-room/          # Phase 3
      digest/             # Phase 3
      intel/              # Phase 4
      auth/               # Phase 5
      comments/           # Phase 5
      approvals/          # Phase 5
      activity/           # Phase 5
      analytics/          # Phase 6
  components/
    sidebar.tsx
    ui/                   # Phase 0: shared components
    editor.tsx            # Phase 1
    diff-viewer.tsx       # Phase 1
    chat.tsx              # Phase 2
    action-item.tsx       # Phase 2
    timeline.tsx          # Phase 3
    email-preview.tsx     # Phase 3
    chart.tsx             # Phase 4
    comments.tsx          # Phase 5
    charts/               # Phase 6
  lib/
    ai.ts                 # AI functions (grows each phase)
    db.ts                 # Database (grows each phase)
    types.ts              # TypeScript types (grows each phase)
    auth.ts               # Phase 5
    analytics.ts          # Phase 6
```

### Sidebar Evolution

The sidebar grows with each phase:

```
Phase 0 (current + fixes):
  Dashboard
  Investors
  Meetings
  Analysis
  Health
  Terms

Phase 1 (+Documents):
  Dashboard
  Investors
  Meetings
  Documents       <-- NEW
  Analysis
  Health
  Terms

Phase 2 (+War Room, Actions):
  Dashboard
  Investors
  Meetings
  Documents
  War Room        <-- NEW
  Actions         <-- NEW
  Analysis
  Health
  Terms

Phase 3 (+Comms, Data Room, Timeline):
  Dashboard
  Investors
  Meetings
  Documents
  War Room
  Actions
  Comms           <-- NEW
  Data Room       <-- NEW
  Timeline        <-- NEW
  Analysis
  Health
  Terms

Phase 4 (+Intel):
  Dashboard
  Investors
  Meetings
  Documents
  War Room
  Actions
  Comms
  Data Room
  Timeline
  Intel           <-- NEW (with sub-items: Comps, Investors, News)
  Analysis
  Health
  Terms

Phase 5 (+Activity, user avatar):
  [User avatar + role in sidebar footer]
  Dashboard
  Investors
  Meetings
  Documents
  War Room
  Actions
  Comms
  Data Room
  Timeline
  Intel
  Activity        <-- NEW
  Analysis
  Health
  Terms

Phase 6 (+Analytics):
  Dashboard
  Investors
  Meetings
  Documents
  War Room
  Actions
  Comms
  Data Room
  Timeline
  Intel
  Activity
  Analytics       <-- NEW (replaces or absorbs Analysis + Health)
  Terms
```

---

## How the Two Layers Interact

The meta-layer (Claude Code building the app) and the app layer (the running application) form a feedback loop:

```
                    ┌─────────────────────────────────────┐
                    │         META-LAYER                   │
                    │    (Claude Code + GSD Framework)      │
                    │                                       │
                    │  1. Read ARCHITECTURE.md               │
                    │  2. Identify next phase                │
                    │  3. Build it                           │
                    │  4. Verify (npm run build + test)      │
                    │  5. Update ARCHITECTURE.md             │
                    │  6. Loop                               │
                    └───────────┬───────────────────────────┘
                                │ deploys improvements to
                                ▼
                    ┌─────────────────────────────────────┐
                    │         APP LAYER                     │
                    │    (RAISE — Series C War Room)        │
                    │                                       │
                    │  - User interacts with app daily       │
                    │  - AI analyzes meetings, generates     │
                    │    documents, provides advice           │
                    │  - App tracks which features are       │
                    │    used and which AI outputs are        │
                    │    accepted/rejected                    │
                    │  - Usage patterns inform next phase     │
                    └───────────┬───────────────────────────┘
                                │ usage data informs
                                ▼
                    ┌─────────────────────────────────────┐
                    │       IMPROVEMENT SIGNALS             │
                    │                                       │
                    │  - Which pages are visited most?       │
                    │  - Which AI suggestions are accepted?  │
                    │  - Which prompts produce poor output?  │
                    │  - What features does user request?    │
                    │  - Where does the user spend time?     │
                    └───────────┬───────────────────────────┘
                                │ feeds back into
                                ▼
                         META-LAYER (next cycle)
```

The app is never "done." Each phase makes it more useful, and usage of the new features reveals what to build next. The architecture document is the living contract between the two layers.

---

## Getting Started

To begin the improvement loop:

1. Read this document
2. Start with **Phase 0** (Foundation Fixes)
3. After completing Phase 0, update the phase status from `[ ]` to `[x]` and note any learnings
4. Move to Phase 1, and so on

The estimated timeline per phase:
- Phase 0: 1-2 sessions
- Phase 1: 2-3 sessions
- Phase 2: 2-3 sessions
- Phase 3: 2-3 sessions
- Phase 4: 1-2 sessions
- Phase 5: 3-4 sessions
- Phase 6: 2-3 sessions

Total: ~14-20 sessions to reach full capability.

Each session = one Claude Code conversation focused on one phase or sub-phase.
