// ---------------------------------------------------------------------------
// Wikidata Provider — Structured entity data (free, no key, powerful SPARQL)
// ---------------------------------------------------------------------------

import type { EnrichmentProvider, EnrichmentProviderResult, EnrichmentField } from '../types';

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

export const wikidataProvider: EnrichmentProvider = {
  id: 'wikidata',
  name: 'Wikidata',
  type: 'free',
  description: 'Structured knowledge base. Entity data for funds with properties: founded, headquarters, founders, investments, owned_by, website. Free SPARQL API.',
  fields_provided: ['identity', 'people', 'portfolio', 'contact'],
  requires_api_key: false,
  rate_limit_per_minute: 60,

  isConfigured() { return true; },

  async enrich(investorName: string): Promise<EnrichmentProviderResult> {
    const fields: EnrichmentField[] = [];
    const now = new Date().toISOString();

    try {
      // Search Wikidata for the entity
      const searchUrl = `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(investorName)}&language=en&format=json&limit=5&type=item`;

      const searchRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'RaiseApp/1.0 (fundraise-enrichment)' },
        signal: AbortSignal.timeout(15000),
      });

      if (!searchRes.ok) {
        return { source_id: 'wikidata', success: false, fields, error: `HTTP ${searchRes.status}`, fetched_at: now };
      }

      const searchData = await searchRes.json();
      const results = searchData?.search || [];

      if (results.length === 0) {
        return { source_id: 'wikidata', success: true, fields, fetched_at: now };
      }

      // Find the best match (look for investment/financial entity)
      const entityId = results[0].id;
      const wdUrl = `https://www.wikidata.org/wiki/${entityId}`;

      fields.push({
        field_name: 'wikidata_id',
        field_value: entityId,
        category: 'identity',
        confidence: 0.8,
        source_url: wdUrl,
      });

      if (results[0].description) {
        fields.push({
          field_name: 'wikidata_description',
          field_value: results[0].description,
          category: 'identity',
          confidence: 0.85,
          source_url: wdUrl,
        });
      }

      // Fetch entity details via SPARQL for richer data
      const sparqlQuery = `
        SELECT ?prop ?propLabel ?value ?valueLabel WHERE {
          wd:${entityId} ?propUri ?value .
          ?prop wikibase:directClaim ?propUri .
          FILTER(?propUri IN (
            wdt:P17,    # country
            wdt:P159,   # headquarters
            wdt:P571,   # inception
            wdt:P112,   # founded by
            wdt:P856,   # official website
            wdt:P1128,  # employees
            wdt:P452,   # industry
            wdt:P127,   # owned by
            wdt:P1830,  # owner of
            wdt:P1876,  # investment
            wdt:P169,   # CEO
            wdt:P3320,  # board member
            wdt:P2139,  # total revenue
            wdt:P2403   # total assets
          ))
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }
        LIMIT 50
      `;

      const sparqlUrl = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(sparqlQuery)}&format=json`;
      const sparqlRes = await fetch(sparqlUrl, {
        headers: {
          'User-Agent': 'RaiseApp/1.0 (fundraise-enrichment)',
          'Accept': 'application/sparql-results+json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (sparqlRes.ok) {
        const sparqlData = await sparqlRes.json();
        const bindings = sparqlData?.results?.bindings || [];

        const propMap: Record<string, { category: EnrichmentField['category']; field: string }> = {
          'country': { category: 'identity', field: 'country' },
          'headquarters location': { category: 'contact', field: 'headquarters' },
          'inception': { category: 'identity', field: 'founded_year' },
          'founded by': { category: 'people', field: 'founder' },
          'official website': { category: 'contact', field: 'website' },
          'number of employees': { category: 'identity', field: 'employee_count' },
          'industry': { category: 'strategy', field: 'industry' },
          'owned by': { category: 'corporate', field: 'parent_entity' },
          'owner of': { category: 'corporate', field: 'subsidiary' },
          'investment': { category: 'portfolio', field: 'investment' },
          'chief executive officer': { category: 'people', field: 'ceo' },
          'board member': { category: 'people', field: 'board_member' },
          'total revenue': { category: 'financials', field: 'total_revenue' },
          'total assets': { category: 'financials', field: 'total_assets' },
        };

        for (const binding of bindings) {
          const propLabel = binding.propLabel?.value?.toLowerCase() || '';
          const valueLabel = binding.valueLabel?.value || binding.value?.value || '';

          if (!valueLabel) continue;

          const mapping = propMap[propLabel];
          if (mapping) {
            // For repeated properties (investments, board members), append index
            const existingCount = fields.filter(f => f.field_name.startsWith(mapping.field)).length;
            const fieldName = existingCount > 0 ? `${mapping.field}_${existingCount}` : mapping.field;

            fields.push({
              field_name: fieldName,
              field_value: valueLabel,
              category: mapping.category,
              confidence: 0.85,
              source_url: wdUrl,
            });
          }
        }
      }

      return { source_id: 'wikidata', success: true, fields, fetched_at: now };
    } catch (error) {
      return {
        source_id: 'wikidata',
        success: false,
        fields,
        error: error instanceof Error ? error.message : 'Unknown error',
        fetched_at: now,
      };
    }
  },
};
