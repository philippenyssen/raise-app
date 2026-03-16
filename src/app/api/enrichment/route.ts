import { NextRequest, NextResponse } from 'next/server';
import {
  getAvailableProviders,
  enrichInvestor,
  buildEnrichedProfile,
  mergeEnrichmentToInvestor,
} from '@/lib/enrichment';
import type { EnrichmentSourceId } from '@/lib/enrichment';
import { emitContextChange } from '@/lib/context-bus';
import {
  getInvestor,
  updateInvestor,
  createEnrichmentJob,
  updateEnrichmentJob,
  getEnrichmentJobs,
  saveEnrichmentRecords,
  getEnrichmentRecords,
  getEnrichmentStats,
  deleteEnrichmentRecords,
  getInvestorPartners,
  createInvestorPartner,
  getInvestorPortfolio,
  createPortfolioCo,
} from '@/lib/db';
import type { Investor } from '@/lib/types';

// GET — fetch enrichment data
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');
  const investorId = req.nextUrl.searchParams.get('investor_id');

  try {
    // List available providers and their status
    if (action === 'providers') {
      const providers = getAvailableProviders();
      return NextResponse.json(providers.map(p => ({
        id: p.provider.id,
        name: p.provider.name,
        type: p.provider.type,
        description: p.provider.description,
        fields_provided: p.provider.fields_provided,
        requires_api_key: p.provider.requires_api_key,
        api_key_env: p.provider.api_key_env,
        configured: p.configured,
      })));
    }

    // Get enrichment records for an investor
    if (action === 'records' && investorId) {
      const records = await getEnrichmentRecords(investorId);
      return NextResponse.json(records);
    }

    // Get enrichment jobs
    if (action === 'jobs') {
      const jobs = await getEnrichmentJobs(investorId || undefined);
      return NextResponse.json(jobs);
    }

    // Get enrichment stats
    if (action === 'stats') {
      const stats = await getEnrichmentStats();
      return NextResponse.json(stats, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
    }

    // Get enrichment status summary for an investor
    if (action === 'status' && investorId) {
      const records = await getEnrichmentRecords(investorId);
      const jobs = await getEnrichmentJobs(investorId);
      const allProviders = getAvailableProviders();

      // Determine which providers have data
      const sourceIds = new Set(records.map(r => r.source_id));
      const latestFetchBySource: Record<string, string> = {};
      for (const rec of records) {
        if (!latestFetchBySource[rec.source_id] || rec.fetched_at > latestFetchBySource[rec.source_id]) {
          latestFetchBySource[rec.source_id] = rec.fetched_at;
        }}

      // Determine last enrichment date overall
      const lastEnriched = records.length > 0
        ? records.reduce((latest, r) => r.fetched_at > latest ? r.fetched_at : latest, records[0].fetched_at)
        : null;

      // Count fields by category
      const fieldsByCategory: Record<string, number> = {};
      for (const rec of records) {
        fieldsByCategory[rec.category] = (fieldsByCategory[rec.category] || 0) + 1;
      }

      // All possible enrichable categories
      const allCategories = ['identity', 'financials', 'strategy', 'people', 'portfolio', 'process', 'contact', 'regulatory', 'corporate', 'media', 'relationships'];
      const categoriesCovered = allCategories.filter(c => fieldsByCategory[c] && fieldsByCategory[c] > 0);
      const fieldCoverage = allCategories.length > 0 ? Math.round((categoriesCovered.length / allCategories.length) * 100) : 0;

      // Stale records count
      const now = new Date().toISOString();
      const staleCount = records.filter(r => r.stale_after && r.stale_after < now).length;

      // Avg confidence (fresh records only)
      const freshRecords = records.filter(r => !r.stale_after || r.stale_after >= now);
      const avgConfidence = freshRecords.length > 0
        ? freshRecords.reduce((sum, r) => sum + r.confidence, 0) / freshRecords.length
        : 0;

      // Last job info
      const lastJob = jobs.length > 0 ? jobs[0] : null;

      // Build provider status list
      const providerStatuses = allProviders.map(p => {
        const hasData = sourceIds.has(p.provider.id);
        const fieldCount = records.filter(r => r.source_id === p.provider.id).length;
        const lastFetched = latestFetchBySource[p.provider.id] || null;

        // Check if there was a failed job for this provider
        let lastError: string | null = null;
        if (lastJob) {
          try {
            const errors = JSON.parse(lastJob.errors || '[]');
            const providerError = errors.find((e: string) => e.startsWith(p.provider.id + ':'));
            if (providerError) lastError = providerError.replace(p.provider.id + ': ', '');
          } catch (e) { console.warn('[ENRICH_ERR_PARSE]', e instanceof Error ? e.message : e); }
        }

        return {
          id: p.provider.id,
          name: p.provider.name,
          type: p.provider.type,
          configured: p.configured,
          has_data: hasData,
          field_count: fieldCount,
          last_fetched: lastFetched,
          last_error: lastError,
          status: !p.configured ? 'unconfigured' as const
            : hasData ? 'success' as const
            : lastError ? 'failed' as const
            : 'pending' as const,
        };});

      return NextResponse.json({
        investor_id: investorId,
        last_enriched: lastEnriched,
        total_fields: records.length,
        field_coverage: fieldCoverage,
        categories_covered: categoriesCovered.length,
        categories_total: allCategories.length,
        fields_by_category: fieldsByCategory,
        avg_confidence: Math.round(avgConfidence * 100),
        stale_count: staleCount,
        providers: providerStatuses,
        last_job: lastJob ? {
          id: lastJob.id,
          status: lastJob.status,
          results_count: lastJob.results_count,
          started_at: lastJob.started_at,
          completed_at: lastJob.completed_at,
        } : null,});
    }

    // Get enriched profile for an investor
    if (action === 'profile' && investorId) {
      const records = await getEnrichmentRecords(investorId);
      const investor = await getInvestor(investorId);
      if (!investor) return NextResponse.json({ error: 'Investor not found' }, { status: 404 });

      // Build mock provider results from stored records
      const bySource: Record<string, { source_id: string; fields: { field_name: string; field_value: string; category: string; confidence: number; source_url: string }[]; fetched_at: string }> = {};
      for (const rec of records) {
        if (!bySource[rec.source_id]) {
          bySource[rec.source_id] = { source_id: rec.source_id, fields: [], fetched_at: rec.fetched_at };
        }
        bySource[rec.source_id].fields.push({
          field_name: rec.field_name,
          field_value: rec.field_value,
          category: rec.category,
          confidence: rec.confidence,
          source_url: rec.source_url,});
      }

      const results = Object.values(bySource).map(s => ({
        source_id: s.source_id as EnrichmentSourceId,
        success: true,
        fields: s.fields.map(f => ({ ...f, category: f.category as import('@/lib/enrichment').EnrichmentFieldCategory })),
        fetched_at: s.fetched_at,
      }));

      const profile = buildEnrichedProfile(investorId, investor.name, results);
      return NextResponse.json(profile);
    }

    return NextResponse.json({ error: 'Invalid action. Use: providers, records, jobs, stats, status, profile' }, { status: 400 });
  } catch (error) {
    console.error('[ENRICHMENT_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch enrichment data' }, { status: 500 });
  }}

// POST — trigger enrichment
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 }); }

  try {
    const action = body.action as string | undefined;
    const investor_id = body.investor_id as string | undefined;
    const investor_ids = body.investor_ids as string[] | undefined;
    const sources = body.sources as EnrichmentSourceId[] | undefined;
    const auto_apply = body.auto_apply as boolean | undefined;

    // Enrich a single investor
    if (action === 'enrich' && investor_id) {
      const investor = await getInvestor(investor_id);
      if (!investor) return NextResponse.json({ error: 'Investor not found' }, { status: 404 });

      const jobId = crypto.randomUUID();

      // Create job record
      await createEnrichmentJob({
        id: jobId,
        investor_id: investor.id,
        investor_name: investor.name,
        sources: sources || [],
        status: 'running',});

      // Build existing data map for providers
      const existingData: Record<string, string> = {};
      for (const key of Object.keys(investor) as (keyof Investor)[]) {
        const val = investor[key];
        if (typeof val === 'string' && val) existingData[key] = val;
      }

      // Run enrichment
      const result = await enrichInvestor(investor.name, existingData, {
        sources: (sources?.length ?? 0) > 0 ? sources : undefined,});

      // Store results
      const allFields = result.results.flatMap(r =>
        r.fields.map(f => ({
          investor_id: investor.id,
          source_id: r.source_id,
          field_name: f.field_name,
          field_value: f.field_value,
          category: f.category,
          confidence: f.confidence,
          source_url: f.source_url || '',
          fetched_at: r.fetched_at,
        })));

      if (allFields.length > 0) {
        await saveEnrichmentRecords(allFields);
      }

      // Build profile
      const profile = buildEnrichedProfile(investor.id, investor.name, result.results);

      // Auto-apply: merge enrichment data into investor record
      if (auto_apply !== false) {
        const updates = mergeEnrichmentToInvestor(profile, existingData);
        if (Object.keys(updates).length > 0) {
          await updateInvestor(investor.id, updates);
        }

        // Auto-create partner records (confidence gate: ≥0.7)
        const MIN_PARTNER_CONFIDENCE = 0.7;
        if (profile.partners.length > 0) {
          const existingPartners = await getInvestorPartners(investor.id);
          const existingNames = new Set(existingPartners.map(p => p.name.toLowerCase()));

          for (const partner of profile.partners) {
            // Validate required fields before writing
            if (!partner.name || typeof partner.name !== 'string' || partner.name.trim().length < 2) {
              console.warn(`[ENRICH_SKIP] Invalid partner name "${partner.name}" for ${investor.name}`);
              continue;
            }
            const pName = partner.name.trim();
            if (!existingNames.has(pName.toLowerCase()) && (partner.confidence ?? 1) >= MIN_PARTNER_CONFIDENCE) {
              await createInvestorPartner({
                investor_id: investor.id,
                name: pName,
                title: typeof partner.title === 'string' ? partner.title.slice(0, 255) : '',
                focus_areas: typeof partner.focus === 'string' ? partner.focus.slice(0, 1000) : '',
                notable_deals: typeof partner.notable_deals === 'string' ? partner.notable_deals.slice(0, 1000) : '',
                board_seats: '',
                linkedin: typeof partner.linkedin === 'string' ? partner.linkedin.slice(0, 500) : '',
                background: '',
                relevance_to_us: '',
                source: partner.source || '',});
            } else if (!existingNames.has(pName.toLowerCase())) {
              console.warn(`[ENRICH_SKIP] Low confidence (${(partner.confidence ?? 0).toFixed(2)}) partner "${pName}" for ${investor.name}`);
            }}
        }

        // Auto-create portfolio records (confidence gate: ≥0.65, fuzzy dedup)
        const MIN_PORTFOLIO_CONFIDENCE = 0.65;
        if (profile.enriched_investments.length > 0) {
          const norm = (s: string) => s.toLowerCase().replace(/[^\w]/g, '');
          const existingPortfolio = await getInvestorPortfolio(investor.id);
          const existingCompanies = new Set(existingPortfolio.map(p => norm(p.company)));
          const created = new Set<string>();

          for (const inv of profile.enriched_investments.slice(0, 20)) {
            // Validate required fields before writing
            if (!inv.company || typeof inv.company !== 'string' || inv.company.trim().length < 2) {
              console.warn(`[ENRICH_SKIP] Invalid portfolio company name "${inv.company}" for ${investor.name}`);
              continue;
            }
            const companyName = inv.company.trim();
            const key = norm(companyName);
            if (key && !existingCompanies.has(key) && !created.has(key) && (inv.confidence ?? 1) >= MIN_PORTFOLIO_CONFIDENCE) {
              created.add(key);
              await createPortfolioCo({
                investor_id: investor.id,
                company: companyName.slice(0, 255),
                sector: typeof inv.sector === 'string' ? inv.sector.slice(0, 255) : '',
                stage_invested: typeof inv.round === 'string' ? inv.round.slice(0, 100) : '',
                amount: typeof inv.amount === 'string' ? inv.amount.slice(0, 100) : '',
                date: typeof inv.date === 'string' ? inv.date.slice(0, 20) : '',
                status: 'active',
                relevance: '',
                source: inv.source || '',});
            }}
        }}

      // Update job
      const errors = result.results.filter(r => !r.success).map(r => `${r.source_id}: ${r.error}`);
      await updateEnrichmentJob(jobId, {
        status: result.status,
        results_count: result.total_fields,
        errors,
        completed_at: new Date().toISOString(),});

      return NextResponse.json({
        job_id: jobId,
        status: result.status,
        total_fields: result.total_fields,
        sources_succeeded: result.sources_succeeded,
        sources_failed: result.sources_failed,
        duration_ms: result.duration_ms,
        profile,
        errors,});
    }

    // Bulk enrich multiple investors
    if (action === 'bulk_enrich' && investor_ids && Array.isArray(investor_ids)) {
      const results: { investor_id: string; investor_name: string; status: string; fields: number }[] = [];
      let delayMs = 500;
      let consecutiveRateLimits = 0;

      for (const id of investor_ids.slice(0, 50)) {
        // Circuit breaker: if too many consecutive rate limits, pause
        if (consecutiveRateLimits >= 3) {
          console.warn(`[ENRICH_BULK] Circuit breaker: ${consecutiveRateLimits} consecutive rate limits, pausing 30s`);
          await new Promise(resolve => setTimeout(resolve, 30_000));
          consecutiveRateLimits = 0;
          delayMs = 2000;
        }

        const investor = await getInvestor(id);
        if (!investor) continue;

        const existingData: Record<string, string> = {};
        for (const key of Object.keys(investor) as (keyof Investor)[]) {
          const val = investor[key];
          if (typeof val === 'string' && val) existingData[key] = val;
        }

        const result = await enrichInvestor(investor.name, existingData, {
          sources: (sources?.length ?? 0) > 0 ? sources : undefined,});

        // Check for rate-limited providers and apply exponential backoff
        const rateLimited = result.results.filter(r => r.rate_limited);
        if (rateLimited.length > 0) {
          consecutiveRateLimits++;
          delayMs = Math.min(delayMs * 2, 10_000);
          console.warn(`[ENRICH_BULK] Rate limited by ${rateLimited.map(r => r.source_id).join(', ')} for ${investor.name}, backoff ${delayMs}ms`);
        } else {
          consecutiveRateLimits = 0;
          delayMs = Math.max(500, delayMs * 0.75);
        }

        const allFields = result.results.flatMap(r =>
          r.fields.map(f => ({
            investor_id: investor.id,
            source_id: r.source_id,
            field_name: f.field_name,
            field_value: f.field_value,
            category: f.category,
            confidence: f.confidence,
            source_url: f.source_url || '',
            fetched_at: r.fetched_at,
          })));

        if (allFields.length > 0) {
          await saveEnrichmentRecords(allFields);
        }

        // Auto-apply
        if (auto_apply !== false) {
          const profile = buildEnrichedProfile(investor.id, investor.name, result.results);
          const updates = mergeEnrichmentToInvestor(profile, existingData);
          if (Object.keys(updates).length > 0) {
            await updateInvestor(investor.id, updates);
          }}

        results.push({
          investor_id: investor.id,
          investor_name: investor.name,
          status: result.status,
          fields: result.total_fields,});

        // Dynamic delay between investors based on rate-limit backoff
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      return NextResponse.json({ results, total: results.length });
    }

    // Refresh stale enrichment data for an investor
    if (action === 'refresh_stale' && investor_id) {
      const investor = await getInvestor(investor_id);
      if (!investor) return NextResponse.json({ error: 'Investor not found' }, { status: 404 });

      // Find which sources have stale data
      const records = await getEnrichmentRecords(investor_id);
      const now = new Date().toISOString();
      const staleRecords = records.filter(r => r.stale_after && r.stale_after < now);

      if (staleRecords.length === 0) {
        return NextResponse.json({ status: 'fresh', message: 'No stale data to refresh', stale_count: 0 });
      }

      // Find unique stale sources to re-run
      const staleSources = [...new Set(staleRecords.map(r => r.source_id))] as EnrichmentSourceId[];

      // Delete stale records first
      for (const sourceId of staleSources) {
        await deleteEnrichmentRecords(investor_id, sourceId);
      }

      // Re-enrich with only stale sources
      const existingData: Record<string, string> = {};
      for (const key of Object.keys(investor) as (keyof Investor)[]) {
        const val = investor[key];
        if (typeof val === 'string' && val) existingData[key] = val;
      }

      const result = await enrichInvestor(investor.name, existingData, { sources: staleSources });

      const allFields = result.results.flatMap(r =>
        r.fields.map(f => ({
          investor_id: investor.id,
          source_id: r.source_id,
          field_name: f.field_name,
          field_value: f.field_value,
          category: f.category,
          confidence: f.confidence,
          source_url: f.source_url || '',
          fetched_at: r.fetched_at,
        })));

      if (allFields.length > 0) {
        await saveEnrichmentRecords(allFields);
      }

      // Auto-apply refreshed data
      if (auto_apply !== false) {
        const profile = buildEnrichedProfile(investor.id, investor.name, result.results);
        const updates = mergeEnrichmentToInvestor(profile, existingData);
        if (Object.keys(updates).length > 0) {
          await updateInvestor(investor.id, updates);
        }
      }

      emitContextChange('investor_updated', `Refreshed ${staleSources.length} stale sources for ${investor.name}`);

      return NextResponse.json({
        status: 'refreshed',
        stale_sources_refreshed: staleSources,
        new_fields: result.total_fields,
        sources_succeeded: result.sources_succeeded,
        sources_failed: result.sources_failed,
        duration_ms: result.duration_ms,
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use: enrich, bulk_enrich, refresh_stale' }, { status: 400 });
  } catch (error) {
    console.error('[ENRICHMENT_POST]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Enrichment operation failed' }, { status: 500 });
  }}

// DELETE — clear enrichment data
export async function DELETE(req: NextRequest) {
  const investorId = req.nextUrl.searchParams.get('investor_id');
  const sourceId = req.nextUrl.searchParams.get('source_id');

  if (!investorId) { return NextResponse.json({ error: 'investor_id required' }, { status: 400 }); }

  try {
    await deleteEnrichmentRecords(investorId, sourceId || undefined);
    emitContextChange('investor_updated', `Cleared enrichment data for ${investorId}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ENRICHMENT_DELETE]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete enrichment data' }, { status: 500 });
  }}
