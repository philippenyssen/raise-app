// ---------------------------------------------------------------------------
// OpenCorporates Provider — Company registry data (200M+ entities)
// Free tier: rate-limited API, no key needed for basic searches
// ---------------------------------------------------------------------------

import type { EnrichmentProvider, EnrichmentProviderResult, EnrichmentField } from '../types';

const OC_BASE = 'https://api.opencorporates.com/v0.4';

export const opencorporatesProvider: EnrichmentProvider = {
  id: 'opencorporates',
  name: 'OpenCorporates',
  type: 'free',
  description: 'World\'s largest open database of companies (200M+ entities). Maps legal structures, directors, subsidiaries, and incorporation details.',
  fields_provided: ['identity', 'corporate', 'people'],
  requires_api_key: false,
  rate_limit_per_minute: 30,

  isConfigured() { return true; },

  async enrich(investorName: string): Promise<EnrichmentProviderResult> {
    const fields: EnrichmentField[] = [];
    const now = new Date().toISOString();

    try {
      // Search for companies matching the investor name
      const apiKey = process.env.OPENCORPORATES_API_KEY;
      const keyParam = apiKey ? `&api_token=${apiKey}` : '';
      const searchUrl = `${OC_BASE}/companies/search?q=${encodeURIComponent(investorName)}&order=score${keyParam}`;

      const res = await fetch(searchUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 429) {
        return { source_id: 'opencorporates', success: false, fields, error: 'Rate limited', fetched_at: now, rate_limited: true };
      }

      if (!res.ok) {
        return { source_id: 'opencorporates', success: false, fields, error: `HTTP ${res.status}`, fetched_at: now };
      }

      const data = await res.json();
      const companies = data?.results?.companies || [];

      if (companies.length > 0) {
        // Take the best match
        const best = companies[0].company;
        const ocUrl = `https://opencorporates.com${best.opencorporates_url || ''}`;

        if (best.name) {
          fields.push({
            field_name: 'legal_name',
            field_value: best.name,
            category: 'identity',
            confidence: 0.85,
            source_url: ocUrl,
          });
        }

        if (best.company_number) {
          fields.push({
            field_name: 'company_number',
            field_value: best.company_number,
            category: 'identity',
            confidence: 1.0,
            source_url: ocUrl,
          });
        }

        if (best.jurisdiction_code) {
          fields.push({
            field_name: 'jurisdiction',
            field_value: best.jurisdiction_code,
            category: 'identity',
            confidence: 1.0,
            source_url: ocUrl,
          });
        }

        if (best.incorporation_date) {
          fields.push({
            field_name: 'incorporation_date',
            field_value: best.incorporation_date,
            category: 'identity',
            confidence: 1.0,
            source_url: ocUrl,
          });
        }

        if (best.company_type) {
          fields.push({
            field_name: 'entity_type',
            field_value: best.company_type,
            category: 'corporate',
            confidence: 1.0,
            source_url: ocUrl,
          });
        }

        if (best.current_status) {
          fields.push({
            field_name: 'corporate_status',
            field_value: best.current_status,
            category: 'corporate',
            confidence: 1.0,
            source_url: ocUrl,
          });
        }

        if (best.registered_address) {
          const addr = best.registered_address;
          const fullAddr = typeof addr === 'string' ? addr :
            [addr.street_address, addr.locality, addr.region, addr.postal_code, addr.country]
              .filter(Boolean).join(', ');
          if (fullAddr) {
            fields.push({
              field_name: 'registered_address',
              field_value: fullAddr,
              category: 'contact',
              confidence: 1.0,
              source_url: ocUrl,
            });
          }
        }

        // Officers (if available in response)
        if (best.officers && Array.isArray(best.officers)) {
          for (const officer of best.officers.slice(0, 10)) {
            const o = officer.officer || officer;
            fields.push({
              field_name: `officer_${(o.name || '').replace(/\s+/g, '_').toLowerCase()}`,
              field_value: JSON.stringify({
                name: o.name,
                position: o.position,
                start_date: o.start_date,
                end_date: o.end_date,
              }),
              category: 'people',
              confidence: 0.9,
              source_url: ocUrl,
            });
          }
        }

        // Also store total results for context
        fields.push({
          field_name: 'opencorporates_matches',
          field_value: String(companies.length),
          category: 'identity',
          confidence: 1.0,
          source_url: ocUrl,
        });

        // Try to get detailed company data if we have the URL
        if (best.opencorporates_url) {
          try {
            const detailUrl = `${OC_BASE}${best.opencorporates_url}${keyParam ? '?' + keyParam.slice(1) : ''}`;
            const detailRes = await fetch(detailUrl, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(15000) });

            if (detailRes.ok) {
              const detailData = await detailRes.json();
              const company = detailData?.results?.company;

              if (company) {
                // Branch info
                if (company.branch && company.branch !== 'not_available') {
                  fields.push({
                    field_name: 'branch_status',
                    field_value: company.branch,
                    category: 'corporate',
                    confidence: 1.0,
                    source_url: ocUrl,
                  });
                }

                // Industry codes
                if (company.industry_codes && company.industry_codes.length > 0) {
                  fields.push({
                    field_name: 'industry_codes',
                    field_value: JSON.stringify(company.industry_codes.map((ic: { industry_code: { code: string; description: string } }) => ({
                      code: ic.industry_code.code,
                      description: ic.industry_code.description,
                    }))),
                    category: 'identity',
                    confidence: 1.0,
                    source_url: ocUrl,
                  });
                }

                // Previous names
                if (company.previous_names && company.previous_names.length > 0) {
                  fields.push({
                    field_name: 'previous_names',
                    field_value: JSON.stringify(company.previous_names.map((pn: { company_name: string }) => pn.company_name)),
                    category: 'identity',
                    confidence: 1.0,
                    source_url: ocUrl,
                  });
                }
              }
            }
          } catch { /* detail fetch failed, continue with search results */ }
        }
      }

      return { source_id: 'opencorporates', success: true, fields, fetched_at: now };
    } catch (error) {
      return {
        source_id: 'opencorporates',
        success: false,
        fields,
        error: error instanceof Error ? error.message : 'Unknown error',
        fetched_at: now,
      };
    }
  },
};
