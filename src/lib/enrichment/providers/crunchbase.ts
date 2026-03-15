// ---------------------------------------------------------------------------
// Crunchbase Provider — Funding rounds, organizations, people
// Basic API ($29/mo) or free tier with 200 calls/minute
// ---------------------------------------------------------------------------

import type { EnrichmentProvider, EnrichmentProviderResult, EnrichmentField } from '../types';

const CB_BASE = 'https://api.crunchbase.com/api/v4';

export const crunchbaseProvider: EnrichmentProvider = {
  id: 'crunchbase',
  name: 'Crunchbase',
  type: 'freemium',
  description: 'Funding rounds, organization profiles, key people, recent investments. Best structured database of startup/VC data. Basic plan $29/mo.',
  fields_provided: ['identity', 'financials', 'strategy', 'people', 'portfolio'],
  requires_api_key: true,
  api_key_env: 'CRUNCHBASE_API_KEY',
  rate_limit_per_minute: 200,

  isConfigured() {
    return !!process.env.CRUNCHBASE_API_KEY;
  },

  async enrich(investorName: string): Promise<EnrichmentProviderResult> {
    const fields: EnrichmentField[] = [];
    const now = new Date().toISOString();
    const apiKey = process.env.CRUNCHBASE_API_KEY;

    if (!apiKey) {
      return { source_id: 'crunchbase', success: false, fields, error: 'API key not configured (CRUNCHBASE_API_KEY)', fetched_at: now };
    }

    try {
      // Search for the organization
      const searchUrl = `${CB_BASE}/autocompletes?query=${encodeURIComponent(investorName)}&collection_ids=organizations&limit=5&user_key=${apiKey}`;
      const res = await fetch(searchUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),});

      if (res.status === 401 || res.status === 403) {
        return { source_id: 'crunchbase', success: false, fields, error: 'Invalid API key', fetched_at: now };
      }

      if (res.status === 429) {
        return { source_id: 'crunchbase', success: false, fields, error: 'Rate limited', fetched_at: now, rate_limited: true };
      }

      if (!res.ok) { return { source_id: 'crunchbase', success: false, fields, error: `HTTP ${res.status}`, fetched_at: now }; }

      const data = await res.json();
      const entities = data?.entities || [];

      if (entities.length === 0) { return { source_id: 'crunchbase', success: true, fields, fetched_at: now }; }

      const bestMatch = entities[0];
      const permalink = bestMatch.identifier?.permalink;
      const cbUrl = `https://www.crunchbase.com/organization/${permalink}`;

      // Fetch organization details
      const orgUrl = `${CB_BASE}/entities/organizations/${permalink}?card_ids=fields,investors,raised_funding_rounds&field_ids=short_description,categories,location_identifiers,founded_on,num_employees_enum,website_url,linkedin,investor_type,num_investments_total,num_exits,num_funds,last_funding_type,last_funding_at&user_key=${apiKey}`;

      const orgRes = await fetch(orgUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),});

      if (orgRes.ok) {
        const orgData = await orgRes.json();
        const props = orgData?.properties || {};
        const cards = orgData?.cards || {};

        // Basic info
        if (props.short_description) {
          fields.push({
            field_name: 'description',
            field_value: props.short_description,
            category: 'identity',
            confidence: 0.95,
            source_url: cbUrl,});
        }

        if (props.founded_on) {
          fields.push({
            field_name: 'founded_date',
            field_value: props.founded_on,
            category: 'identity',
            confidence: 0.95,
            source_url: cbUrl,});
        }

        if (props.website_url) {
          fields.push({
            field_name: 'website',
            field_value: props.website_url,
            category: 'contact',
            confidence: 0.95,
            source_url: cbUrl,});
        }

        if (props.linkedin) {
          fields.push({
            field_name: 'linkedin_url',
            field_value: typeof props.linkedin === 'string' ? props.linkedin : props.linkedin.value || '',
            category: 'contact',
            confidence: 0.95,
            source_url: cbUrl,});
        }

        // Investor type
        if (props.investor_type) {
          const types = Array.isArray(props.investor_type) ? props.investor_type : [props.investor_type];
          fields.push({
            field_name: 'investor_type',
            field_value: types.join(', '),
            category: 'strategy',
            confidence: 0.9,
            source_url: cbUrl,});
        }

        // Investment stats
        if (props.num_investments_total) {
          fields.push({
            field_name: 'total_investments',
            field_value: String(props.num_investments_total),
            category: 'portfolio',
            confidence: 0.95,
            source_url: cbUrl,});
        }

        if (props.num_exits) {
          fields.push({
            field_name: 'total_exits',
            field_value: String(props.num_exits),
            category: 'portfolio',
            confidence: 0.95,
            source_url: cbUrl,});
        }

        if (props.num_funds) {
          fields.push({
            field_name: 'fund_count',
            field_value: String(props.num_funds),
            category: 'financials',
            confidence: 0.95,
            source_url: cbUrl,});
        }

        // Categories / sectors
        if (props.categories) {
          const cats = Array.isArray(props.categories) ?
            props.categories.map((c: { value?: string; name?: string }) => c.value || c.name || c) :
            [props.categories];
          fields.push({
            field_name: 'investment_categories',
            field_value: cats.filter(Boolean).join(', '),
            category: 'strategy',
            confidence: 0.85,
            source_url: cbUrl,});
        }

        // Location
        if (props.location_identifiers) {
          const locs = Array.isArray(props.location_identifiers) ?
            props.location_identifiers.map((l: { value?: string }) => l.value || l) :
            [props.location_identifiers];
          fields.push({
            field_name: 'location',
            field_value: locs.filter(Boolean).join(', '),
            category: 'contact',
            confidence: 0.9,
            source_url: cbUrl,});
        }

        // Employee count
        if (props.num_employees_enum) {
          fields.push({
            field_name: 'employee_count_range',
            field_value: props.num_employees_enum,
            category: 'identity',
            confidence: 0.9,
            source_url: cbUrl,});
        }

        // Recent investments from cards
        if (cards.investors) {
          const investments = Array.isArray(cards.investors) ? cards.investors : [];
          for (const inv of investments.slice(0, 20)) {
            const invProps = inv.properties || inv;
            fields.push({
              field_name: `investment_${(invProps.name || invProps.identifier?.value || '').replace(/\s+/g, '_').toLowerCase()}`,
              field_value: JSON.stringify({
                company: invProps.name || invProps.identifier?.value,
                round: invProps.funding_round_identifier?.value || '',
                date: invProps.announced_on || '',
                amount: invProps.money_raised?.value_usd ? `$${(invProps.money_raised.value_usd / 1e6).toFixed(1)}M` : '',
              }),
              category: 'portfolio',
              confidence: 0.9,
              source_url: cbUrl,});
          }}
      }

      return { source_id: 'crunchbase', success: true, fields, fetched_at: now };
    } catch (error) {
      return {
        source_id: 'crunchbase',
        success: false,
        fields,
        error: error instanceof Error ? error.message : 'Unknown error',
        fetched_at: now,};
    }
  },};
