// ---------------------------------------------------------------------------
// Enrichment System — Public API
// ---------------------------------------------------------------------------

export type {
  EnrichmentSourceId,
  EnrichmentSourceType,
  EnrichmentJobStatus,
  EnrichmentFieldCategory,
  EnrichmentField,
  EnrichmentProviderResult,
  EnrichmentProvider,
  EnrichmentJob,
  EnrichmentRecord,
  EnrichmentSourceConfig,
  EnrichedInvestorProfile,
} from './types';

export {
  ALL_PROVIDERS,
  PROVIDER_MAP,
  getAvailableProviders,
  getConfiguredProviders,
  enrichInvestor,
  buildEnrichedProfile,
  mergeEnrichmentToInvestor,
} from './engine';

export type { EnrichmentOptions, EnrichmentResult } from './engine';
