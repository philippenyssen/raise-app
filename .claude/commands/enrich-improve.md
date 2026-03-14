# Enrichment System Improvement

Deep improvement cycle for the investor data enrichment pipeline. Add providers, improve data quality, enhance the UI.

## Arguments
$ARGUMENTS — Optional: specific focus (e.g., "new-provider", "ui", "data-quality", "entity-resolution"). If empty, full system audit.

## Current Architecture
- 9 providers: SEC EDGAR (3), OpenCorporates, Companies House, Crunchbase, Wikidata, OpenVC, Website Scraper
- Engine: `src/lib/enrichment/engine.ts` — concurrent execution, profile builder, auto-merge
- Types: `src/lib/enrichment/types.ts`
- API: `src/app/api/enrichment/route.ts`
- UI: `src/app/enrichment/page.tsx`

## Expert Panel

1. **Data engineering lead (Clearbit/ZoomInfo)**: Provider reliability scoring, fallback chains, data freshness, entity resolution across sources
2. **Knowledge graph architect (Google)**: Cross-source deduplication, confidence merging, contradiction resolution, semantic matching
3. **Compliance officer (GDPR/CCPA)**: Scraping legality, data retention policies, consent requirements, right to erasure
4. **Product designer (LinkedIn Sales Navigator)**: Enrichment UX — how to surface the most valuable data first, progressive profile building
5. **Research analyst (PitchBook)**: Which additional free/cheap sources exist? Government registries, patent databases, news APIs?

## Improvement Categories

### A. New Providers to Add
Priority order (free first):
1. **News/Press Releases** — Google News RSS, PR Newswire free API, TechCrunch scraping
2. **LinkedIn (via Proxycurl)** — Company profiles, employee counts, growth signals (paid)
3. **Apollo.io** — Contact data, email verification (freemium)
4. **Diffbot** — Structured web extraction (paid)
5. **PitchBook** — Most comprehensive VC data (enterprise, if available)
6. **EU Business Registries** — National registries via API (free, varies by country)
7. **Patent databases** — USPTO, EPO for innovation signals (free)

### B. Data Quality
- Confidence score calibration: are 0.9 scores really 90% accurate?
- Staleness detection: which fields go stale fastest?
- Contradiction resolution: what if SEC says $2B AUM but Crunchbase says $500M?
- Entity resolution: matching "a16z" to "Andreessen Horowitz" to "AH Capital Management"

### C. UI Improvements
- Per-investor enrichment profile view (not just the aggregate)
- Visual confidence indicators (not just numbers)
- Data provenance: click any field to see which source provided it
- Side-by-side comparison when sources disagree
- Auto-enrichment scheduling (enrich new investors on creation)
- Enrichment quality score per investor

### D. Pipeline Integration
- Auto-trigger enrichment when investor is created
- Feed enrichment data into scoring signals
- Use enrichment to pre-fill meeting prep briefs
- Cross-reference portfolio overlap between investors

## Process
1. Read current enrichment system code
2. Read intelligence-inventory.md for prior enrichment work
3. Apply expert perspectives
4. Rank improvements by data quality impact
5. Implement top improvements
6. Verify build
7. Log changes
8. Log execution to `.claude/skills-state/execution-log.jsonl`:
   ```json
   {"timestamp":"ISO","skill":"enrich-improve","version":1,"trigger":"manual|improve-cycle-N","outcome":"success|partial|failure","build_result":"pass|fail","findings_count":N,"changes_made":N,"changes_reverted":0,"type_errors_introduced":0,"rework_needed":false,"notes":"summary"}
   ```
