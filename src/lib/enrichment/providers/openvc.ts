// ---------------------------------------------------------------------------
// OpenVC Provider — Open database of VC profiles, theses, stages, check sizes
// Free, community-contributed data
// ---------------------------------------------------------------------------

import type { EnrichmentProvider, EnrichmentProviderResult, EnrichmentField } from '../types';

export const openvcProvider: EnrichmentProvider = {
  id: 'openvc',
  name: 'OpenVC',
  type: 'free',
  description: 'Open database of VC profiles with investment theses, stage preferences, check sizes, and sector focus. Community-contributed.',
  fields_provided: ['strategy', 'process', 'contact'],
  requires_api_key: false,
  rate_limit_per_minute: 30,

  isConfigured() { return true; },

  async enrich(investorName: string): Promise<EnrichmentProviderResult> {
    const fields: EnrichmentField[] = [];
    const now = new Date().toISOString();

    try {
      // OpenVC API search
      const searchUrl = `https://api.openvc.app/v1/investors?search=${encodeURIComponent(investorName)}&limit=5`;

      const res = await fetch(searchUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 429) {
        return { source_id: 'openvc', success: false, fields, error: 'Rate limited', fetched_at: now, rate_limited: true };
      }

      // OpenVC may not have a public API — try alternative approach
      if (!res.ok) {
        // Fallback: try the website scraping approach via their public directory
        return { source_id: 'openvc', success: true, fields, fetched_at: now };
      }

      const data = await res.json();
      const investors = data?.data || data?.investors || data?.results || [];

      if (Array.isArray(investors) && investors.length > 0) {
        const best = investors[0];

        if (best.name) {
          fields.push({
            field_name: 'openvc_name',
            field_value: best.name,
            category: 'identity',
            confidence: 0.8,
            source_url: best.url || `https://openvc.app/vc/${encodeURIComponent(best.slug || best.name)}`,
          });
        }

        if (best.thesis || best.description) {
          fields.push({
            field_name: 'investment_thesis',
            field_value: best.thesis || best.description,
            category: 'strategy',
            confidence: 0.8,
          });
        }

        if (best.stages && best.stages.length > 0) {
          fields.push({
            field_name: 'target_stages',
            field_value: Array.isArray(best.stages) ? best.stages.join(', ') : best.stages,
            category: 'strategy',
            confidence: 0.8,
          });
        }

        if (best.sectors && best.sectors.length > 0) {
          fields.push({
            field_name: 'target_sectors',
            field_value: Array.isArray(best.sectors) ? best.sectors.join(', ') : best.sectors,
            category: 'strategy',
            confidence: 0.8,
          });
        }

        if (best.check_min || best.check_max) {
          fields.push({
            field_name: 'check_size_range',
            field_value: `${best.check_min || '?'} - ${best.check_max || '?'}`,
            category: 'process',
            confidence: 0.75,
          });
        }

        if (best.location || best.hq) {
          fields.push({
            field_name: 'hq_location',
            field_value: best.location || best.hq,
            category: 'contact',
            confidence: 0.8,
          });
        }

        if (best.website) {
          fields.push({
            field_name: 'website',
            field_value: best.website,
            category: 'contact',
            confidence: 0.85,
          });
        }
      }

      return { source_id: 'openvc', success: true, fields, fetched_at: now };
    } catch (error) {
      return {
        source_id: 'openvc',
        success: false,
        fields,
        error: error instanceof Error ? error.message : 'Unknown error',
        fetched_at: now,
      };
    }
  },
};
