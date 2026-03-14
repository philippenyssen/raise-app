# RAISE — Full-Stack Series C Execution Platform

## The Product

RAISE is not a process management tool. It is **the factory that produces every deliverable required to close a Series C** — the teaser, the deck, the memo, the model, the data room. The user talks to it, reviews live, edits inline, and ships IC-ready materials directly from the app.

Think of it as **a fundraise-specific IDE**: the AI builds and refines documents and models in real-time while the user reviews, edits, and approves — all in one workspace.

---

## Core Deliverables (What the App Produces)

| # | Deliverable | Format | Length | Purpose |
|---|------------|--------|--------|---------|
| 1 | **Teaser** | Markdown → PDF | 2-3 pages | Initial outreach, first impression |
| 2 | **Executive Summary** | Markdown → PDF | 1 page | IC gate pass, quick decision doc |
| 3 | **Investment Memo** | Markdown → PDF | ~6 pages | IC-grade memo for formal review |
| 4 | **Long-Form Deck** | Slide-format | 30-50 slides | Management presentation |
| 5 | **Confirmatory DD Memo** | Markdown → PDF | 50-100+ pages | Full diligence support document |
| 6 | **Financial Model** | Excel (in-app) | Multi-sheet | Bottom-up business plan, returns waterfall, scenarios |
| 7 | **Data Room** | Structured uploads | N/A | All source context that feeds the above |

Every deliverable is **generated from the data room context** and **continuously refined** through conversation.

---

## The Workspace UX

### Split-Pane Layout (Claude Artifacts Style)

```
┌──────────────────────────────────────────────────────────────────┐
│  RAISE                                                           │
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                       │
│ Sidebar  │  ┌─────────────────────────┬─────────────────────┐   │
│          │  │                         │                     │   │
│ ─────── │  │   DOCUMENT / MODEL      │    AI CHAT          │   │
│ Data Room│  │   (Live Preview)        │                     │   │
│ Teaser   │  │                         │  "Make the TAM      │   │
│ Exec Sum │  │   Every cell visible    │   section more      │   │
│ Memo     │  │   Every formula inspect │   specific to       │   │
│ Deck     │  │   Click-to-edit         │   defense"          │   │
│ DD Memo  │  │   Real-time updates     │                     │   │
│ Model    │  │                         │  [Voice input 🎤]   │   │
│ ─────── │  │                         │                     │   │
│ Process  │  └─────────────────────────┴─────────────────────┘   │
│ CRM      │                                                       │
│ Meetings │                                                       │
├──────────┴───────────────────────────────────────────────────────┤
│  Status bar: Last saved 2s ago │ Version 14 │ 6 sheets │ Draft  │
└──────────────────────────────────────────────────────────────────┘
```

### Key UX Principles

1. **Document is always visible.** The left pane shows the deliverable being worked on — markdown rendered, Excel cells live, deck slides previewed.
2. **AI chat is always available.** The right pane is a conversation with the AI that has full context of the data room, the current document, and all other deliverables.
3. **Voice-first.** The user can speak to improve documents instead of typing. The AI applies changes live.
4. **Formula-level Excel.** Every cell in the financial model is inspectable — click a cell, see its formula, edit it, see downstream effects immediately. Sheet tabs, row/column navigation, cell formatting — all in-browser.
5. **Everything feeds everything.** Change a number in the model → memo updates. Upload a contract to data room → teaser adjusts. Log a meeting → objection patterns update the deck.

---

## Architecture

### Tech Stack

- **Next.js 16** (App Router, React 19, Server Components)
- **Turso/libsql** (remote SQLite database)
- **@anthropic-ai/sdk** (Claude API for all AI operations)
- **Tailwind CSS 4** (dark theme, zinc-950 base)
- **lucide-react** (icons)
- **SheetJS (xlsx)** — Excel read/write/formula engine in-browser
- **Web Speech API** — voice input (browser-native, no extra deps)

### Database Tables

```
config              — key-value raise configuration
investors           — CRM records
meetings            — meeting logs with AI-extracted data
convergence         — process health snapshots
documents           — all deliverables (teaser, memo, deck, DD memo, exec summary)
document_versions   — version history for every document
data_room_files     — uploaded source files (metadata + extracted text)
model_sheets        — financial model sheets (JSON representation)
model_versions      — model version history
```

### File Organization

```
src/
  app/
    layout.tsx              # Root layout with sidebar + split-pane
    page.tsx                # Dashboard (process overview + deliverable status)

    # === DELIVERABLES (the core product) ===
    workspace/
      page.tsx              # Main workspace — split-pane with doc preview + AI chat
      [type]/page.tsx       # Workspace filtered to specific deliverable type

    data-room/
      page.tsx              # Upload + manage source documents

    model/
      page.tsx              # Financial model viewer/editor (Excel-in-browser)

    # === PROCESS (supporting features) ===
    investors/
      page.tsx              # CRM
      [id]/page.tsx         # Investor detail
    meetings/
      page.tsx              # Meeting log
      new/page.tsx          # Meeting debrief
    analysis/page.tsx       # AI pattern analysis
    health/page.tsx         # Process health
    terms/page.tsx          # Term sheet comparison
    documents/              # Legacy document pages (Phase 1, to be absorbed into workspace)

    # === API ===
    api/
      documents/            # Document CRUD + AI operations
      data-room/            # File upload + text extraction
      model/                # Model CRUD + formula operations
      investors/            # Investor CRUD
      meetings/             # Meeting CRUD
      health/               # Health metrics
      analyze/              # Pattern analysis
      seed/                 # Seed data
      workspace/            # AI chat for workspace (streaming)

  components/
    sidebar.tsx             # Navigation
    workspace/
      split-pane.tsx        # Resizable split-pane container
      document-viewer.tsx   # Markdown renderer with click-to-edit sections
      excel-viewer.tsx      # Full spreadsheet viewer (sheets, cells, formulas)
      ai-chat.tsx           # Chat interface with voice input
      voice-input.tsx       # Web Speech API wrapper
      toolbar.tsx           # Document-level actions (export, version, status)
    toast.tsx               # Notifications
    ui/                     # Shared UI components

  lib/
    ai.ts                   # All AI functions
    db.ts                   # Database layer
    types.ts                # TypeScript types
    excel.ts                # Excel read/write/formula utilities
    pdf.ts                  # PDF/markdown export
```

---

## Build Phases

### Phase 0: Foundation Fixes `[x]`

**Completed.** Sidebar icons, toast system, loading states, mobile responsive, investor detail page.

### Phase 1: Document Engine `[x]`

**Completed.** Document CRUD, templates, version history, AI operations (improve, consistency, weak arguments, Goldman polish).

### Phase 2: The Workspace `[x]`

**What it builds:** The core product experience — a split-pane workspace where the user sees their deliverable on the left and talks to the AI on the right. This is the Claude-artifacts-style UX.

**Scope:**
1. **Split-pane layout** — resizable left (document/model preview) + right (AI chat). Persistent across navigation.
2. **Document viewer** — rendered markdown with section-level editing. Click any section → it becomes editable. Changes save and create versions automatically.
3. **AI chat panel** — streaming responses, full context of current document + data room. The user types or speaks, the AI modifies the document live.
4. **Voice input** — Web Speech API integration. Push-to-talk button in chat panel. Transcription → AI processes → document updates.
5. **Deliverable switcher** — tabs or sidebar entries for each deliverable type. Switching loads the relevant document in the viewer.
6. **Toolbar** — export to PDF/DOCX, version history, status (draft/review/final), word count.

**Key files:**
- `src/app/workspace/page.tsx` — main workspace
- `src/components/workspace/split-pane.tsx`
- `src/components/workspace/document-viewer.tsx`
- `src/components/workspace/ai-chat.tsx`
- `src/components/workspace/voice-input.tsx`
- `src/components/workspace/toolbar.tsx`
- `src/app/api/workspace/route.ts` — streaming AI chat endpoint

**Database:** Uses existing `documents` + `document_versions` tables.

**AI:** Streaming chat with full document context. System prompt includes raise config, data room summary, current document content.

### Phase 3: Data Room `[x]`

**What it builds:** The context engine. Users upload documents (PDFs, DOCX, XLSX, images) that become the source material for all AI-generated deliverables.

**Scope:**
1. **File upload** — drag-and-drop, multi-file, with progress indicators
2. **Text extraction** — PDF → text, DOCX → text, XLSX → structured data, images → OCR (via AI)
3. **Categorization** — each file tagged by category (financial, legal, commercial, technical, team)
4. **Context index** — extracted text is stored and indexed. AI chat can reference specific source documents.
5. **Source attribution** — when AI generates content, it can cite which data room files informed each claim

**Key files:**
- `src/app/data-room/page.tsx`
- `src/app/api/data-room/route.ts` — upload, list, delete
- `src/app/api/data-room/[id]/route.ts` — single file operations
- `src/lib/extract.ts` — text extraction utilities

**Database additions:**
```sql
CREATE TABLE IF NOT EXISTS data_room_files (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  mime_type TEXT DEFAULT '',
  size_bytes INTEGER DEFAULT 0,
  extracted_text TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  uploaded_at TEXT DEFAULT (datetime('now'))
);
```

### Phase 4: Excel Model Engine `[ ]`

**What it builds:** A full in-browser spreadsheet viewer and editor for the financial model. The user can inspect every cell, see formulas, edit values, and see downstream effects — all within the workspace.

**Scope:**
1. **Sheet viewer** — tab navigation between sheets, cell grid with formatting, frozen headers
2. **Formula bar** — click any cell, see its formula, dependencies highlighted
3. **Cell editing** — click to edit, formula support, auto-recalculation
4. **Model structure** — pre-built sheets: Assumptions, P&L, Revenue Bridge, Cash Flow, Returns/Waterfall, Scenarios, Cap Table, SOTP, Comps
5. **Returns waterfall** — detailed investor returns with dilution, preferences, participation, conversion
6. **AI model operations** — "build a DCF", "add a sensitivity table", "model the bear case", "show me the waterfall at 5x exit"
7. **Import/Export** — upload existing .xlsx, export to .xlsx with formulas preserved

**Key files:**
- `src/app/model/page.tsx` — model viewer in workspace
- `src/components/workspace/excel-viewer.tsx` — spreadsheet component
- `src/components/workspace/formula-bar.tsx`
- `src/components/workspace/cell-editor.tsx`
- `src/lib/excel.ts` — SheetJS wrapper, formula engine
- `src/app/api/model/route.ts` — model CRUD

**Database additions:**
```sql
CREATE TABLE IF NOT EXISTS model_sheets (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL DEFAULT 'default',
  sheet_name TEXT NOT NULL,
  sheet_order INTEGER DEFAULT 0,
  data TEXT NOT NULL DEFAULT '{}',  -- JSON: {cells, merges, formatting}
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS model_versions (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL DEFAULT 'default',
  snapshot TEXT NOT NULL,  -- full model JSON
  change_summary TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Phase 5: Deliverable Generation `[ ]`

**What it builds:** AI-powered generation of all 5 deliverables from data room context. The user uploads their source material, and the AI produces draft deliverables that the user then refines in the workspace.

**Scope:**
1. **Teaser generator** — from data room context, produces a 2-3 page teaser
2. **Executive summary generator** — 1-page IC-ready summary
3. **Investment memo generator** — 6-page structured memo
4. **DD memo generator** — comprehensive 50-100+ page document
5. **Deck generator** — 30-50 slide management presentation (markdown-based slides)
6. **Model bootstrapper** — generates initial financial model from uploaded financials
7. **Cross-document consistency** — when one deliverable changes, flag inconsistencies across all others
8. **Continuous improvement** — conversation-driven refinement of any deliverable at any time

### Phase 6: Process Intelligence `[ ]`

**What it builds:** The CRM, meeting analysis, and process health features — now powered by the context from Phases 2-5.

**Scope:**
1. Meeting debrief → AI updates relevant deliverables based on objections
2. Investor-specific material customization ("prepare the deck for a16z's IC")
3. Process health informed by deliverable readiness
4. Email/comms generation with deliverable attachments
5. Timeline and milestone tracking

---

## Sidebar Evolution

```
Current (Phase 0-1):
  Dashboard
  Investors
  Meetings
  Documents       ← Phase 1
  Analysis
  Health
  Terms

Target (Phase 2+):
  ─── DELIVERABLES ───
  Workspace         ← Main product (Phase 2)
  Data Room         ← Source context (Phase 3)
  Model             ← Excel in-browser (Phase 4)
  ─── PROCESS ───
  Dashboard
  Investors
  Meetings
  Analysis
  Health
  Terms
```

---

## How It All Connects

```
DATA ROOM (uploads)
     │
     ▼
AI GENERATION ENGINE
     │
     ├──→ Teaser
     ├──→ Executive Summary
     ├──→ Investment Memo (6p)
     ├──→ Long-Form DD Memo
     ├──→ Deck (30-50 slides)
     └──→ Financial Model
              │
              ▼
         WORKSPACE
     (split-pane: preview + AI chat)
     (voice or text to refine)
     (formula-level Excel editing)
              │
              ▼
     EXPORT (PDF, DOCX, XLSX, PPTX)
```

The data room is the input. The workspace is where refinement happens. The deliverables are the output. The AI connects everything.

---

## Expert Review Framework (G-Stack)

Every improvement loop — both at the meta-layer (building the app) and within the app (reviewing deliverables) — runs through an exhaustive expert panel. The experts are not generic; they are specifically selected for each task.

### Meta-Layer Experts (App Development)

For each build phase, before implementation begins, the following experts review the plan:

| Expert | Role | What They Check |
|--------|------|-----------------|
| **Goldman Sachs ECM MD** | Deliverable quality | Are the templates IC-grade? Would this pass a real IC? |
| **Senior Product Designer** | UX/interaction | Is the workspace intuitive? Can a non-technical CFO use this? |
| **Full-Stack Architect** | Technical design | Is the data model right? Will this scale? Are there race conditions? |
| **Series C Founder** | User empathy | Does this solve the actual pain? What's missing from real experience? |
| **VC Partner (buyer side)** | Investor perspective | Would I trust materials produced by this tool? What would I flag? |
| **Financial Modeler (PE/IB)** | Model rigor | Are the formulas correct? Is the waterfall accurate? Are scenarios realistic? |
| **Security/Compliance** | Data safety | Is sensitive deal data properly handled? Auth? Encryption? |
| **QA Engineer** | Edge cases | What breaks? What happens with empty data? Concurrent edits? |

### App-Layer Experts (Deliverable Review)

When the AI reviews or generates deliverables within the app, it cycles through these expert personas:

#### For Documents (Teaser, Memo, Exec Summary, DD Memo, Deck)

| Expert | Persona | What They Check |
|--------|---------|-----------------|
| **Goldman Sachs ECM MD** | Style, structure, authority | Concise? Active voice? Numbers first? IC-ready? |
| **Skeptical IC Member** | Weak arguments | Unsourced claims? Circular reasoning? Superlatives without evidence? |
| **Corporate Lawyer** | Legal risk | Misleading statements? Forward-looking statement disclaimers? |
| **Industry Analyst** | Market accuracy | Are TAM/SAM/SOM defensible? Are comps current? |
| **Competing VC Partner** | Devil's advocate | What would make me pass? What's the bear case they're not telling me? |
| **The LP** | Returns focus | Is the return profile clear? Is downside bounded? What's the margin of safety? |
| **Copy Editor** | Consistency | Same numbers everywhere? Formatting consistent? Cross-references correct? |
| **Data Scientist** | Quantitative rigor | Are the statistics valid? Sample sizes adequate? Correlations ≠ causation? |

#### For Financial Model

| Expert | Persona | What They Check |
|--------|---------|-----------------|
| **PE Operating Partner** | Value creation | Is the bridge from entry to exit credible? What are the levers? |
| **Audit Partner (Big 4)** | Formula integrity | Circular references? Hard-coded values? Correct cell references? |
| **Credit Analyst** | Downside | Cash flow under stress? Debt service coverage? Liquidity runway? |
| **Tax Advisor** | Structure | Are the returns after-tax? Waterfall accounting for carried interest correctly? |
| **FP&A Director** | Operability | Are the assumptions bottom-up? Can management actually execute this plan? |
| **Macro Strategist** | Assumptions | Interest rate assumptions? FX? Inflation? Cycle positioning? |

#### For Data Room

| Expert | Persona | What They Check |
|--------|---------|-----------------|
| **M&A Lawyer** | Completeness | All material contracts? All litigation? All IP? |
| **Due Diligence Analyst** | Organization | Can an investor find what they need in 5 minutes? |
| **Compliance Officer** | Sensitivity | Any ITAR, export control, or classified material? |

### How Experts Are Applied

**In the build loop (meta-layer):**
1. Before each phase, define which experts are relevant
2. After building, run an expert review pass (Claude simulates each expert sequentially)
3. Each expert produces 1-3 specific findings with severity (critical/high/medium/low)
4. Critical and high findings must be addressed before the phase is marked complete

**In the app (user-facing):**
1. When the user asks for a review, the AI runs through ALL relevant experts for that deliverable type
2. Each expert's findings are presented in a structured panel with severity
3. The user can accept/reject/discuss each finding
4. The AI tracks which expert findings are consistently accepted vs. rejected → refines future reviews

---

## Self-Improvement Loop

```
PLAN ──> BUILD ──> EXPERT REVIEW ──> FIX ──> VERIFY ──> ASSESS ──> NEXT PHASE
```

After each phase:
1. Run `npm run build` — zero errors
2. Run expert review for the phase
3. Fix critical/high findings
4. Update phase status in this file
5. Commit and push
6. Move to next phase

Phase statuses: `[ ]` Not started | `[~]` In progress | `[x]` Complete | `[!]` Needs refinement
