// ---------------------------------------------------------------------------
// Enrichment Engine — Orchestrates providers, manages jobs, stores results
// ---------------------------------------------------------------------------

import type {
  EnrichmentSourceId,
  EnrichmentProvider,
  EnrichmentProviderResult,
  EnrichedInvestorProfile,
} from './types';

// Import all providers
import { secEdgarFormD, secEdgarFormAdv, secEdgar13F } from './providers/sec-edgar';
import { opencorporatesProvider } from './providers/opencorporates';
import { companiesHouseProvider } from './providers/companies-house';
import { crunchbaseProvider } from './providers/crunchbase';
import { wikidataProvider } from './providers/wikidata';
import { openvcProvider } from './providers/openvc';
import { websiteScraperProvider } from './providers/website-scraper';

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

export const ALL_PROVIDERS: EnrichmentProvider[] = [
  secEdgarFormD,
  secEdgarFormAdv,
  secEdgar13F,
  opencorporatesProvider,
  companiesHouseProvider,
  crunchbaseProvider,
  wikidataProvider,
  openvcProvider,
  websiteScraperProvider,];

export const PROVIDER_MAP: Record<EnrichmentSourceId, EnrichmentProvider> = Object.fromEntries(
  ALL_PROVIDERS.map(p => [p.id, p])
) as Record<EnrichmentSourceId, EnrichmentProvider>;

export function getAvailableProviders(): { provider: EnrichmentProvider; configured: boolean }[] {
  return ALL_PROVIDERS.map(p => ({
    provider: p,
    configured: p.isConfigured(),
  }));
}

export function getConfiguredProviders(): EnrichmentProvider[] {
  return ALL_PROVIDERS.filter(p => p.isConfigured());
}

// ---------------------------------------------------------------------------
// Enrichment Execution
// ---------------------------------------------------------------------------

export interface EnrichmentOptions {
  sources?: EnrichmentSourceId[]; // Which sources to use (defaults to all configured)
  skipStale?: boolean;            // Skip if data was fetched within last N days
  staleDays?: number;             // Days before data is considered stale (default 30)
  concurrency?: number;           // Max concurrent provider calls (default 3)
}

export interface EnrichmentResult {
  job_id: string;
  investor_name: string;
  status: 'completed' | 'partial' | 'failed';
  results: EnrichmentProviderResult[];
  total_fields: number;
  sources_succeeded: number;
  sources_failed: number;
  duration_ms: number;
}

/**
 * Run enrichment for a single investor across multiple sources.
 * Returns all fields found, organized by source.
 */
export async function enrichInvestor(
  investorName: string,
  existingData?: Record<string, string>,
  options?: EnrichmentOptions,
): Promise<EnrichmentResult> {
  const startTime = Date.now();
  const jobId = crypto.randomUUID();

  // Determine which providers to use
  let providers: EnrichmentProvider[];
  if (options?.sources) {
    providers = options.sources
      .map(id => PROVIDER_MAP[id])
      .filter((p): p is EnrichmentProvider => !!p && p.isConfigured());
  } else {
    providers = getConfiguredProviders();
  }

  if (providers.length === 0) {
    return {
      job_id: jobId,
      investor_name: investorName,
      status: 'failed',
      results: [],
      total_fields: 0,
      sources_succeeded: 0,
      sources_failed: 0,
      duration_ms: Date.now() - startTime,};
  }

  // Run providers with concurrency control
  const concurrency = options?.concurrency || 3;
  const results: EnrichmentProviderResult[] = [];

  for (let i = 0; i < providers.length; i += concurrency) {
    const batch = providers.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(provider =>
        provider.enrich(investorName, existingData)
          .catch(error => ({
            source_id: provider.id,
            success: false,
            fields: [],
            error: error instanceof Error
              ? (error.name === 'AbortError' ? `Timeout (${provider.id})` : `${provider.id}: ${error.message}`)
              : `${provider.id}: unknown error`,
            fetched_at: new Date().toISOString(),
          } as EnrichmentProviderResult))));

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          source_id: batch[batchResults.indexOf(result)]?.id ?? 'unknown',
          success: false,
          fields: [],
          error: `Unexpected rejection: ${result.reason}`,
          fetched_at: new Date().toISOString(),});
      }}
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalFields = results.reduce((sum, r) => sum + r.fields.length, 0);

  return {
    job_id: jobId,
    investor_name: investorName,
    status: failed === results.length ? 'failed' : failed > 0 ? 'partial' : 'completed',
    results,
    total_fields: totalFields,
    sources_succeeded: succeeded,
    sources_failed: failed,
    duration_ms: Date.now() - startTime,};
}

/**
 * Build a unified enriched profile from all enrichment results.
 * Deduplicates and prioritizes by confidence score.
 */
export function buildEnrichedProfile(
  investorId: string,
  investorName: string,
  results: EnrichmentProviderResult[],
): EnrichedInvestorProfile {
  const profile: EnrichedInvestorProfile = {
    investor_id: investorId,
    investor_name: investorName,
    legal_names: [],
    sec_registered: false,
    form_d_filings: [],
    partners: [],
    enriched_investments: [],
    subsidiaries: [],
    officers: [],
    target_sectors: [],
    target_stages: [],
    target_geographies: [],
    office_addresses: [],
    partner_emails: [],
    partner_linkedins: [],
    sources_used: [],
    last_enriched: new Date().toISOString(),
    overall_confidence: 0,
    fields_enriched: 0,
    fields_total: 0,};

  let totalConfidence = 0;
  let fieldCount = 0;

  for (const result of results) {
    if (!result.success) continue;
    if (result.fields.length === 0) continue;

    profile.sources_used.push(result.source_id);

    for (const field of result.fields) {
      if (!field.field_value || field.field_value.trim() === '' || field.field_value === 'null') continue;
      fieldCount++;
      totalConfidence += field.confidence;

      // Route fields to profile based on category and name
      switch (field.category) {
        case 'identity':
          if (field.field_name.includes('legal_name') || field.field_name.includes('entity_name') || field.field_name.includes('org_name')) {
            if (!profile.legal_names.includes(field.field_value)) {
              profile.legal_names.push(field.field_value);
            }}
          if (field.field_name.includes('jurisdiction')) profile.jurisdiction = field.field_value;
          if (field.field_name.includes('incorporation_date') || field.field_name === 'founded_date' || field.field_name === 'founded_year') {
            profile.incorporation_date = field.field_value;
          }
          if (field.field_name.includes('entity_type') || field.field_name.includes('company_type')) {
            profile.entity_type = field.field_value;
          }
          if (field.field_name === 'wikidata_id' || field.field_name === 'wikidata_description') {
            // Store as-is for reference
          }
          break;

        case 'financials':
          if (field.field_name === 'aum') {
            profile.aum = field.field_value;
            profile.aum_date = result.fetched_at;
          }
          if (field.field_name === 'fund_count') profile.fund_count = parseInt(field.field_value) || undefined;
          if (field.field_name === 'current_fund_size') profile.current_fund_size = field.field_value;
          break;

        case 'strategy':
          if (field.field_name.includes('thesis')) profile.investment_thesis = field.field_value;
          if (field.field_name.includes('sector') || field.field_name.includes('categories')) {
            const sectors = field.field_value.split(',').map(s => s.trim()).filter(Boolean);
            for (const s of sectors) {
              if (!profile.target_sectors.includes(s)) profile.target_sectors.push(s);
            }}
          if (field.field_name.includes('stages')) {
            const stages = field.field_value.split(',').map(s => s.trim()).filter(Boolean);
            for (const s of stages) {
              if (!profile.target_stages.includes(s)) profile.target_stages.push(s);
            }}
          break;

        case 'people':
          if (field.field_name.startsWith('partner_') || field.field_name.startsWith('uk_officer_') || field.field_name.startsWith('team_')) {
            try {
              const person = JSON.parse(field.field_value);
              profile.partners.push({
                name: person.name || field.field_value,
                title: person.title || person.role || person.position || '',
                focus: person.focus || '',
                linkedin: person.linkedin || '',
                email: person.email || '',
                notable_deals: person.notable_deals || '',
                source: result.source_id,});
            } catch {
              console.warn(`[ENRICH_PARSE] ${result.source_id} partner: ${field.field_value.slice(0, 80)}`);
              profile.partners.push({
                name: field.field_value,
                title: '',
                focus: '',
                source: result.source_id,});
            }}
          if (field.field_name === 'ceo' || field.field_name === 'founder') {
            profile.partners.push({
              name: field.field_value,
              title: field.field_name === 'ceo' ? 'CEO' : 'Founder',
              focus: '',
              source: result.source_id,});
          }
          break;

        case 'portfolio':
          if (field.field_name.startsWith('investment_') || field.field_name.startsWith('portfolio_')) {
            try {
              const inv = JSON.parse(field.field_value);
              profile.enriched_investments.push({
                company: inv.company || field.field_value,
                round: inv.round,
                amount: inv.amount,
                date: inv.date,
                sector: inv.sector,
                source: result.source_id,});
            } catch {
              profile.enriched_investments.push({
                company: field.field_value,
                source: result.source_id,});
            }}
          break;

        case 'regulatory':
          if (field.field_name === 'sec_registered') profile.sec_registered = field.field_value === 'true';
          if (field.field_name.includes('form_d_filing_')) {
            try {
              const filing = JSON.parse(field.field_value);
              profile.form_d_filings.push({
                company: filing.entities || '',
                amount: filing.amount,
                date: filing.date || '',
                form_url: field.source_url,});
            } catch { /* skip */ }
          }
          if (field.field_name === 'iapd_crd_number') profile.cik_number = field.field_value;
          if (field.field_name.includes('form_adv_url')) profile.form_adv_url = field.field_value;
          break;

        case 'corporate':
          if (field.field_name === 'subsidiary' || field.field_name.startsWith('subsidiary_')) {
            profile.subsidiaries.push(field.field_value);
          }
          if (field.field_name.includes('officer')) {
            try {
              const officer = JSON.parse(field.field_value);
              profile.officers.push({ name: officer.name, title: officer.position || officer.role || '' });
            } catch {
              profile.officers.push({ name: field.field_value, title: '' });
            }}
          break;

        case 'contact':
          if (field.field_name === 'website' || field.field_name === 'discovered_website') {
            if (!profile.website) profile.website = field.field_value;
          }
          if (field.field_name.includes('address')) {
            if (!profile.office_addresses.includes(field.field_value)) {
              profile.office_addresses.push(field.field_value);
            }}
          if (field.field_name.includes('linkedin_url')) {
            // Could be org or person LinkedIn
          }
          if (field.field_name.startsWith('email_')) {
            const email = field.field_value;
            if (!profile.partner_emails.find(e => e.email === email)) {
              profile.partner_emails.push({ name: '', email });
            }}
          break;
      }}
  }

  profile.fields_enriched = fieldCount;
  profile.fields_total = fieldCount; // Could be expanded with "expected" fields
  profile.overall_confidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;

  // Deduplicate partners
  const seenPartners = new Set<string>();
  profile.partners = profile.partners.filter(p => {
    const key = p.name.toLowerCase();
    if (seenPartners.has(key)) return false;
    seenPartners.add(key);
    return true;});

  // Deduplicate investments
  const seenInvestments = new Set<string>();
  profile.enriched_investments = profile.enriched_investments.filter(inv => {
    const key = inv.company.toLowerCase();
    if (seenInvestments.has(key)) return false;
    seenInvestments.add(key);
    return true;});

  return profile;
}

/**
 * Merge enrichment results into existing investor data fields.
 * Returns a set of field updates to apply to the investor record.
 */
export function mergeEnrichmentToInvestor(
  profile: EnrichedInvestorProfile,
  existingData: Record<string, string>,
): Record<string, string> {
  const updates: Record<string, string> = {};

  // Only fill empty fields — don't overwrite user-entered data
  if (!existingData.fund_size && profile.aum) {
    updates.fund_size = profile.aum;
  }

  if (!existingData.check_size_range && (profile.check_size_min || profile.check_size_max)) {
    updates.check_size_range = `${profile.check_size_min || '?'} - ${profile.check_size_max || '?'}`;
  }

  if (!existingData.sector_thesis && profile.target_sectors.length > 0) {
    updates.sector_thesis = profile.target_sectors.join(', ');
  }

  // Add to notes if we found useful context
  const enrichmentNotes: string[] = [];
  if (profile.jurisdiction) enrichmentNotes.push(`Jurisdiction: ${profile.jurisdiction}`);
  if (profile.incorporation_date) enrichmentNotes.push(`Founded: ${profile.incorporation_date}`);
  if (profile.sec_registered) enrichmentNotes.push('SEC registered');
  if (profile.fund_count) enrichmentNotes.push(`${profile.fund_count} funds`);
  if (profile.investment_thesis) enrichmentNotes.push(`Thesis: ${profile.investment_thesis.slice(0, 200)}`);
  if (profile.website && !existingData.notes?.includes(profile.website)) {
    enrichmentNotes.push(`Website: ${profile.website}`);
  }

  if (enrichmentNotes.length > 0) {
    const enrichmentBlock = `\n--- Enrichment (${new Date().toISOString().split('T')[0]}) ---\n${enrichmentNotes.join('\n')}`;
    if (existingData.notes) {
      // Only append if not already enriched recently
      if (!existingData.notes.includes('--- Enrichment')) {
        updates.notes = existingData.notes + enrichmentBlock;
      }
    } else {
      updates.notes = enrichmentBlock;
    }}

  return updates;
}
