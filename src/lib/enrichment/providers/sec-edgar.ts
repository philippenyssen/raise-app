// ---------------------------------------------------------------------------
// SEC EDGAR Provider — Form D, Form ADV, 13F
// Completely free. No API key needed. Rate limit: 10 req/sec with User-Agent.
// ---------------------------------------------------------------------------

import type { EnrichmentProvider, EnrichmentProviderResult, EnrichmentField } from '../types';

const USER_AGENT = 'RaiseApp/1.0 (fundraise-enrichment; contact@raise-app.com)';
const EDGAR_BASE = 'https://efts.sec.gov/LATEST';
const EDGAR_FULL_TEXT = 'https://efts.sec.gov/LATEST/search-index?q=';
const IAPD_BASE = 'https://api.adviserinfo.sec.gov';

async function edgarFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',},
    signal: AbortSignal.timeout(15000),});
}

// ---------------------------------------------------------------------------
// Form D Provider — Regulation D filings (fund formations & investments)
// ---------------------------------------------------------------------------
export const secEdgarFormD: EnrichmentProvider = {
  id: 'sec_edgar_formd',
  name: 'SEC EDGAR Form D',
  type: 'free',
  description: 'US SEC Form D filings — fund formations, amounts raised, related persons, securities type. Filed for every Regulation D exemption.',
  fields_provided: ['identity', 'financials', 'people', 'regulatory'],
  requires_api_key: false,
  rate_limit_per_minute: 600,

  isConfigured() { return true; }, // Always available, no key needed

  async enrich(investorName: string): Promise<EnrichmentProviderResult> {
    const fields: EnrichmentField[] = [];
    const now = new Date().toISOString();

    try {
      // EDGAR full-text search for Form D filings mentioning this investor
      const searchQuery = encodeURIComponent(`"${investorName}" AND formType:"D"`);
      const searchUrl = `${EDGAR_BASE}/search-index?q=${searchQuery}&dateRange=custom&startdt=2020-01-01&forms=D&hits.hits.total=true&hits.hits._source=file_date,display_names,form_type,file_num,period_of_report`;

      // Use EDGAR EFTS (full-text search system)
      const eftsUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(investorName)}%22&forms=D&dateRange=custom&startdt=2018-01-01`;

      // Primary: EDGAR company search
      const companySearchUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(investorName)}%22&forms=D`;

      // Simpler approach: EDGAR full-text search API
      const searchRes = await edgarFetch(
        `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(investorName)}%22&forms=D&dateRange=custom&startdt=2018-01-01`
      );

      if (searchRes.ok) {
        const data = await searchRes.json();
        const hits = data?.hits?.hits || [];

        if (hits.length > 0) {
          fields.push({
            field_name: 'sec_form_d_filings_count',
            field_value: String(hits.length),
            category: 'regulatory',
            confidence: 1.0,
            source_url: `https://www.sec.gov/cgi-bin/browse-edgar?company=${encodeURIComponent(investorName)}&CIK=&type=D&dateb=&owner=include&count=40&search_text=&action=getcompany`,
          });

          // Extract filing details
          for (const hit of hits.slice(0, 10)) {
            const source = hit._source || {};
            const filingDate = source.file_date || '';
            const displayNames = (source.display_names || []).join(', ');
            const fileNum = source.file_num || '';

            if (displayNames) {
              fields.push({
                field_name: `form_d_filing_${filingDate}`,
                field_value: JSON.stringify({
                  date: filingDate,
                  entities: displayNames,
                  file_number: fileNum,
                }),
                category: 'regulatory',
                confidence: 1.0,
                source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&filenum=${fileNum}&type=D&dateb=&owner=include&count=10`,
              });
            }}
        }}

      // Also try the EDGAR company search API for CIK lookup
      const cikRes = await edgarFetch(
        `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(investorName)}%22&dateRange=custom&startdt=2018-01-01`
      );

      if (cikRes.ok) {
        const cikData = await cikRes.json();
        const cikHits = cikData?.hits?.hits || [];
        if (cikHits.length > 0) {
          const firstHit = cikHits[0]._source || {};
          if (firstHit.entity_name) {
            fields.push({
              field_name: 'sec_entity_name',
              field_value: firstHit.entity_name,
              category: 'identity',
              confidence: 0.9,});
          }}
      }

      return { source_id: 'sec_edgar_formd', success: true, fields, fetched_at: now };
    } catch (error) {
      return {
        source_id: 'sec_edgar_formd',
        success: false,
        fields,
        error: error instanceof Error ? error.message : 'Unknown error',
        fetched_at: now,};
    }
  },};

// ---------------------------------------------------------------------------
// Form ADV Provider — Investment Adviser registration
// ---------------------------------------------------------------------------
export const secEdgarFormAdv: EnrichmentProvider = {
  id: 'sec_edgar_formadv',
  name: 'SEC EDGAR Form ADV',
  type: 'free',
  description: 'Investment Adviser registration data — AUM, number of clients, fee structure, key persons, investment strategy. Via IAPD (Investment Adviser Public Disclosure).',
  fields_provided: ['identity', 'financials', 'strategy', 'people', 'regulatory'],
  requires_api_key: false,
  rate_limit_per_minute: 120,

  isConfigured() { return true; },

  async enrich(investorName: string): Promise<EnrichmentProviderResult> {
    const fields: EnrichmentField[] = [];
    const now = new Date().toISOString();

    try {
      // IAPD search API
      const searchUrl = `https://api.adviserinfo.sec.gov/IAPD/Content/Search/api/Organization/Search?SearchValue=${encodeURIComponent(investorName)}&SearchType=org`;

      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',},
        signal: AbortSignal.timeout(15000),});

      if (!res.ok) {
        return { source_id: 'sec_edgar_formadv', success: false, fields, error: `HTTP ${res.status}`, fetched_at: now };
      }

      const data = await res.json();
      const results = data?.Results || data?.Hits || [];

      if (Array.isArray(results) && results.length > 0) {
        const best = results[0];
        const crd = best.CurrentIAPDCRDNumber || best.CRDNumber || best.Crd || '';
        const orgName = best.OrgName || best.Names?.[0]?.OrgName || '';

        if (orgName) {
          fields.push({
            field_name: 'iapd_org_name',
            field_value: orgName,
            category: 'identity',
            confidence: 0.95,
            source_url: `https://adviserinfo.sec.gov/firm/summary/${crd}`,
          });
        }

        if (crd) {
          fields.push({
            field_name: 'iapd_crd_number',
            field_value: String(crd),
            category: 'regulatory',
            confidence: 1.0,
            source_url: `https://adviserinfo.sec.gov/firm/summary/${crd}`,
          });

          // Fetch detailed firm info
          const detailUrl = `https://api.adviserinfo.sec.gov/IAPD/Content/Search/api/Organization/Detail/${crd}`;
          const detailRes = await fetch(detailUrl, {
            headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000),});

          if (detailRes.ok) {
            const detail = await detailRes.json();
            const firm = detail?.Firm || detail || {};
            const adv = firm?.Adv || {};
            const brochures = firm?.Brochures || [];

            // AUM
            if (adv.RegulatoryAssetsUnderManagement || adv.TotalAum) {
              const aum = adv.RegulatoryAssetsUnderManagement || adv.TotalAum;
              fields.push({
                field_name: 'aum',
                field_value: String(aum),
                category: 'financials',
                confidence: 1.0,
                source_url: `https://adviserinfo.sec.gov/firm/summary/${crd}`,
              });
            }

            // Number of accounts/clients
            if (adv.NumberOfClients || adv.TotalNumberOfAccounts) {
              fields.push({
                field_name: 'number_of_clients',
                field_value: String(adv.NumberOfClients || adv.TotalNumberOfAccounts),
                category: 'financials',
                confidence: 1.0,});
            }

            // Main office address
            if (adv.MainOfficeAddress) {
              const addr = adv.MainOfficeAddress;
              const fullAddr = [addr.Street1, addr.Street2, addr.City, addr.State, addr.ZipCode, addr.Country]
                .filter(Boolean)
                .join(', ');
              if (fullAddr) {
                fields.push({
                  field_name: 'main_office_address',
                  field_value: fullAddr,
                  category: 'contact',
                  confidence: 1.0,});
              }}

            // Website
            if (adv.WebsiteAddress) {
              fields.push({
                field_name: 'website',
                field_value: adv.WebsiteAddress,
                category: 'contact',
                confidence: 1.0,});
            }

            // SEC registration status
            if (adv.SECRegistered !== undefined) {
              fields.push({
                field_name: 'sec_registered',
                field_value: String(adv.SECRegistered),
                category: 'regulatory',
                confidence: 1.0,});
            }

            // Key personnel from brochures
            if (brochures.length > 0) {
              for (const brochure of brochures.slice(0, 5)) {
                if (brochure.SupervisedPersons) {
                  for (const person of brochure.SupervisedPersons.slice(0, 10)) {
                    fields.push({
                      field_name: `partner_${(person.Name || '').replace(/\s+/g, '_').toLowerCase()}`,
                      field_value: JSON.stringify({
                        name: person.Name,
                        title: person.Title || '',
                        crd: person.CRDNumber || '',
                      }),
                      category: 'people',
                      confidence: 0.95,
                      source_url: `https://adviserinfo.sec.gov/firm/summary/${crd}`,
                    });
                  }}
              }}
          }}

        // Total results count
        fields.push({
          field_name: 'iapd_results_count',
          field_value: String(results.length),
          category: 'regulatory',
          confidence: 1.0,});
      }

      return { source_id: 'sec_edgar_formadv', success: true, fields, fetched_at: now };
    } catch (error) {
      return {
        source_id: 'sec_edgar_formadv',
        success: false,
        fields,
        error: error instanceof Error ? error.message : 'Unknown error',
        fetched_at: now,};
    }
  },};

// ---------------------------------------------------------------------------
// Form 13F Provider — Institutional holdings (quarterly)
// ---------------------------------------------------------------------------
export const secEdgar13F: EnrichmentProvider = {
  id: 'sec_edgar_13f',
  name: 'SEC EDGAR 13F',
  type: 'free',
  description: 'Quarterly institutional holdings reports for managers with >$100M AUM. Lists public equity positions. Most useful for crossover funds and sovereign wealth funds.',
  fields_provided: ['financials', 'portfolio', 'regulatory'],
  requires_api_key: false,
  rate_limit_per_minute: 600,

  isConfigured() { return true; },

  async enrich(investorName: string): Promise<EnrichmentProviderResult> {
    const fields: EnrichmentField[] = [];
    const now = new Date().toISOString();

    try {
      const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(investorName)}%22&forms=13F-HR&dateRange=custom&startdt=2023-01-01`;

      const res = await edgarFetch(searchUrl);
      if (!res.ok) {
        return { source_id: 'sec_edgar_13f', success: false, fields, error: `HTTP ${res.status}`, fetched_at: now };
      }

      const data = await res.json();
      const hits = data?.hits?.hits || [];

      if (hits.length > 0) {
        fields.push({
          field_name: '13f_filings_count',
          field_value: String(hits.length),
          category: 'regulatory',
          confidence: 1.0,
          source_url: `https://www.sec.gov/cgi-bin/browse-edgar?company=${encodeURIComponent(investorName)}&CIK=&type=13F-HR&dateb=&owner=include&count=40&search_text=&action=getcompany`,
        });

        // Most recent filing
        const latest = hits[0]._source || {};
        if (latest.file_date) {
          fields.push({
            field_name: '13f_latest_filing_date',
            field_value: latest.file_date,
            category: 'regulatory',
            confidence: 1.0,});
        }

        fields.push({
          field_name: '13f_institutional_manager',
          field_value: 'true',
          category: 'identity',
          confidence: 0.95,});
      }

      return { source_id: 'sec_edgar_13f', success: true, fields, fetched_at: now };
    } catch (error) {
      return {
        source_id: 'sec_edgar_13f',
        success: false,
        fields,
        error: error instanceof Error ? error.message : 'Unknown error',
        fetched_at: now,};
    }
  },};
