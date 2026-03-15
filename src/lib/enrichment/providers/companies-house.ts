// ---------------------------------------------------------------------------
// UK Companies House Provider — Free API, no rate limit issues
// All UK-registered funds, officers, PSC (persons with significant control)
// ---------------------------------------------------------------------------

import type { EnrichmentProvider, EnrichmentProviderResult, EnrichmentField } from '../types';

const CH_BASE = 'https://api.company-information.service.gov.uk';

export const companiesHouseProvider: EnrichmentProvider = {
  id: 'companies_house',
  name: 'UK Companies House',
  type: 'free',
  description: 'UK company registry. Officers, PSC, filing history, accounts for UK-registered funds. Free API with generous rate limits.',
  fields_provided: ['identity', 'corporate', 'people', 'regulatory'],
  requires_api_key: true,
  api_key_env: 'COMPANIES_HOUSE_API_KEY',
  rate_limit_per_minute: 600,

  isConfigured() {
    return !!process.env.COMPANIES_HOUSE_API_KEY;
  },

  async enrich(investorName: string): Promise<EnrichmentProviderResult> {
    const fields: EnrichmentField[] = [];
    const now = new Date().toISOString();
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;

    if (!apiKey) {
      return { source_id: 'companies_house', success: false, fields, error: 'API key not configured (COMPANIES_HOUSE_API_KEY)', fetched_at: now };
    }

    const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');

    try {
      // Search for companies
      const searchUrl = `${CH_BASE}/search/companies?q=${encodeURIComponent(investorName)}&items_per_page=5`;
      const res = await fetch(searchUrl, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),});

      if (res.status === 429) {
        return { source_id: 'companies_house', success: false, fields, error: 'Rate limited', fetched_at: now, rate_limited: true };
      }

      if (!res.ok) {
        return { source_id: 'companies_house', success: false, fields, error: `HTTP ${res.status}`, fetched_at: now };
      }

      const data = await res.json();
      const items = data?.items || [];

      if (items.length > 0) {
        const best = items[0];
        const companyNumber = best.company_number;
        const chUrl = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`;

        fields.push({
          field_name: 'uk_company_name',
          field_value: best.title || '',
          category: 'identity',
          confidence: 0.85,
          source_url: chUrl,});

        fields.push({
          field_name: 'uk_company_number',
          field_value: companyNumber,
          category: 'identity',
          confidence: 1.0,
          source_url: chUrl,});

        if (best.company_status) {
          fields.push({
            field_name: 'uk_company_status',
            field_value: best.company_status,
            category: 'corporate',
            confidence: 1.0,
            source_url: chUrl,});
        }

        if (best.company_type) {
          fields.push({
            field_name: 'uk_company_type',
            field_value: best.company_type,
            category: 'corporate',
            confidence: 1.0,
            source_url: chUrl,});
        }

        if (best.date_of_creation) {
          fields.push({
            field_name: 'uk_incorporation_date',
            field_value: best.date_of_creation,
            category: 'identity',
            confidence: 1.0,
            source_url: chUrl,});
        }

        if (best.registered_office_address) {
          const addr = best.registered_office_address;
          const fullAddr = [addr.address_line_1, addr.address_line_2, addr.locality, addr.region, addr.postal_code, addr.country]
            .filter(Boolean).join(', ');
          fields.push({
            field_name: 'uk_registered_address',
            field_value: fullAddr,
            category: 'contact',
            confidence: 1.0,
            source_url: chUrl,});
        }

        // Fetch officers
        try {
          const officersRes = await fetch(`${CH_BASE}/company/${companyNumber}/officers`, {
            headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000),});

          if (officersRes.ok) {
            const officersData = await officersRes.json();
            const officers = officersData?.items || [];

            for (const officer of officers.filter((o: { resigned_on?: string }) => !o.resigned_on).slice(0, 10)) {
              fields.push({
                field_name: `uk_officer_${(officer.name || '').replace(/\s+/g, '_').toLowerCase()}`,
                field_value: JSON.stringify({
                  name: officer.name,
                  role: officer.officer_role,
                  appointed: officer.appointed_on,
                  nationality: officer.nationality,
                  occupation: officer.occupation,
                }),
                category: 'people',
                confidence: 1.0,
                source_url: chUrl,});
            }}
        } catch { /* officers fetch failed */ }

        // Fetch persons with significant control (PSC)
        try {
          const pscRes = await fetch(`${CH_BASE}/company/${companyNumber}/persons-with-significant-control`, {
            headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000),});

          if (pscRes.ok) {
            const pscData = await pscRes.json();
            const pscs = pscData?.items || [];

            for (const psc of pscs.slice(0, 5)) {
              fields.push({
                field_name: `uk_psc_${(psc.name || '').replace(/\s+/g, '_').toLowerCase()}`,
                field_value: JSON.stringify({
                  name: psc.name,
                  natures_of_control: psc.natures_of_control,
                  notified_on: psc.notified_on,
                  country_of_residence: psc.country_of_residence,
                }),
                category: 'people',
                confidence: 1.0,
                source_url: chUrl,});
            }}
        } catch { /* PSC fetch failed */ }
      }

      return { source_id: 'companies_house', success: true, fields, fetched_at: now };
    } catch (error) {
      return {
        source_id: 'companies_house',
        success: false,
        fields,
        error: error instanceof Error ? error.message : 'Unknown error',
        fetched_at: now,};
    }
  },};
