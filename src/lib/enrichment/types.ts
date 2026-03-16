// ---------------------------------------------------------------------------
// Enrichment System — Type Definitions
// ---------------------------------------------------------------------------

export type EnrichmentSourceId =
  | 'sec_edgar_formd'
  | 'sec_edgar_formadv'
  | 'sec_edgar_13f'
  | 'opencorporates'
  | 'companies_house'
  | 'crunchbase'
  | 'wikidata'
  | 'openvc'
  | 'website_scraper'
  | 'eu_registries'
  | 'apollo'
  | 'diffbot';

export type EnrichmentSourceType = 'free' | 'freemium' | 'paid';

export type EnrichmentJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'partial';

export type EnrichmentFieldCategory =
  | 'identity'       // Legal name, CIK, jurisdiction, incorporation date
  | 'financials'     // AUM, fund size, fee structure
  | 'strategy'       // Investment thesis, sectors, stage preferences
  | 'people'         // Partners, key decision-makers
  | 'portfolio'      // Portfolio companies, recent investments
  | 'process'        // IC process, typical timeline, check size
  | 'contact'        // Email, LinkedIn, office address
  | 'regulatory'     // SEC filings, regulatory status
  | 'corporate'      // Legal structure, subsidiaries, officers
  | 'media'          // News mentions, blog posts, podcast appearances
  | 'relationships'; // Co-investors, LP base, network connections

export interface EnrichmentField {
  field_name: string;
  field_value: string;
  category: EnrichmentFieldCategory;
  confidence: number; // 0-1
  source_url?: string;
  raw_data?: string; // JSON of original response for audit
}

export interface EnrichmentProviderResult {
  source_id: EnrichmentSourceId;
  success: boolean;
  fields: EnrichmentField[];
  error?: string;
  fetched_at: string;
  rate_limited?: boolean;
}

export interface EnrichmentProvider {
  id: EnrichmentSourceId;
  name: string;
  type: EnrichmentSourceType;
  description: string;
  fields_provided: EnrichmentFieldCategory[];
  requires_api_key: boolean;
  api_key_env?: string;
  rate_limit_per_minute?: number;
  isConfigured(): boolean;
  enrich(investorName: string, existingData?: Record<string, string>): Promise<EnrichmentProviderResult>;
}

export interface EnrichmentJob {
  id: string;
  investor_id: string;
  investor_name: string;
  sources: EnrichmentSourceId[];
  status: EnrichmentJobStatus;
  results_count: number;
  errors: string; // JSON array
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface EnrichmentRecord {
  id: string;
  investor_id: string;
  source_id: EnrichmentSourceId;
  field_name: string;
  field_value: string;
  category: EnrichmentFieldCategory;
  confidence: number;
  source_url: string;
  raw_json: string;
  fetched_at: string;
  stale_after: string; // When this data should be re-fetched
  created_at: string;
}

export interface EnrichmentSourceConfig {
  source_id: EnrichmentSourceId;
  enabled: boolean;
  api_key: string;
  last_used: string | null;
  total_calls: number;
  total_results: number;
  avg_confidence: number;
}

// Aggregated enrichment profile for an investor
export interface EnrichedInvestorProfile {
  investor_id: string;
  investor_name: string;

  // Identity
  legal_names: string[];
  cik_number?: string;
  jurisdiction?: string;
  incorporation_date?: string;
  entity_type?: string;

  // Financials
  aum?: string;
  aum_date?: string;
  fund_count?: number;
  current_fund_vintage?: string;
  current_fund_size?: string;
  fee_structure?: string;
  carry?: string;

  // Strategy
  investment_thesis?: string;
  target_sectors: string[];
  target_stages: string[];
  target_geographies: string[];
  check_size_min?: string;
  check_size_max?: string;
  sweet_spot?: string;

  // People
  partners: {
    name: string;
    title: string;
    focus: string;
    linkedin?: string;
    email?: string;
    notable_deals?: string;
    source: EnrichmentSourceId;
    confidence?: number;
  }[];

  // Portfolio (from enrichment, separate from manually-entered investor_portfolio)
  enriched_investments: {
    company: string;
    round?: string;
    amount?: string;
    date?: string;
    sector?: string;
    source: EnrichmentSourceId;
    confidence?: number;
  }[];

  // Regulatory
  sec_registered: boolean;
  form_adv_url?: string;
  form_d_filings: {
    company: string;
    amount?: string;
    date: string;
    form_url?: string;
  }[];

  // Corporate structure
  subsidiaries: string[];
  officers: { name: string; title: string }[];

  // Contacts
  website?: string;
  office_addresses: string[];
  partner_emails: { name: string; email: string }[];
  partner_linkedins: { name: string; url: string }[];

  // Metadata
  sources_used: EnrichmentSourceId[];
  last_enriched: string;
  overall_confidence: number;
  fields_enriched: number;
  fields_total: number;
}
