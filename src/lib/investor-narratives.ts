/**
 * Investor-Type Narrative Profiles — deterministic mapping of what matters to each investor type.
 * Used by Material Adaptation Engine for meeting briefs, document suggestions, and talking points.
 */
import type { InvestorType } from './types';

interface NarrativeProfile {
  emphasis: string[];
  keyMetrics: string[];
  openingHook: string;
  dataRoomPriority: string[];
  anticipatedQuestions: string[];
  toneGuidance: string;
  avoidTopics: string[];
}

const INVESTOR_NARRATIVES: Record<InvestorType, NarrativeProfile> = {
  vc: {
    emphasis: ['Technology moat', 'TAM expansion', 'Team velocity', 'Capital efficiency'],
    keyMetrics: ['Revenue growth %', 'Burn multiple', 'NDR/expansion', 'TAM/SAM/SOM'],
    openingHook: 'Why this is a category-defining platform play',
    dataRoomPriority: ['Financial model', 'Cap table', 'Customer contracts', 'Tech architecture'],
    anticipatedQuestions: ["What's the path to $1B revenue?", "Why can't SpaceX/Airbus do this?", 'What happens if IRIS2 is delayed?', 'What does the competitive landscape look like in 3 years?', 'How do you think about the IPO path?'],
    toneGuidance: 'Lead with vision, back with data. Use analogies to category-defining companies (TSMC, SpaceX at Series C). Emphasize optionality and platform dynamics.',
    avoidTopics: ['Excessive debt structure detail', 'Regulatory minutiae', 'Dividend discussions'],
  },
  growth: {
    emphasis: ['Unit economics', 'Revenue predictability', 'Margin expansion', 'Optionality'],
    keyMetrics: ['Revenue/FTE', 'Gross margin %', 'Contract backlog', 'Rule of 40'],
    openingHook: 'Contracted revenue de-risks the growth story',
    dataRoomPriority: ['Financial model', 'Revenue bridge', 'Unit economics', 'Backlog detail'],
    anticipatedQuestions: ["What's the EBITDA path?", 'How much of revenue is recurring?', "What's the customer concentration?", 'Walk me through the unit economics by segment.', "What's the bridge from current to target margins?"],
    toneGuidance: 'Numbers first, narrative second. Lead with contracted backlog and margin trajectory. Frame as a predictable, compounding business.',
    avoidTopics: ['Blue-sky TAM estimates', 'Unproven adjacencies', 'Pre-revenue segments'],
  },
  sovereign: {
    emphasis: ['Sovereignty', 'Geopolitical positioning', 'Long-term strategic value', 'ESG/EU alignment'],
    keyMetrics: ['Government contract %', 'Multi-country diversification', 'SAFE alignment', 'ESG metrics'],
    openingHook: 'European strategic autonomy in space and defense',
    dataRoomPriority: ['Defense contracts', 'Government relationships', 'ESG report', 'Regulatory framework'],
    anticipatedQuestions: ['How does this align with SAFE?', "What's the geopolitical risk?", 'Is this dual-use compliant?', 'What is your relationship with the European Commission?', 'How do you navigate export controls across EU member states?'],
    toneGuidance: 'Frame as a strategic national/European asset, not just a financial investment. Emphasize sovereignty, ITAR-free supply chain, multi-country government backing.',
    avoidTopics: ['Short-term trading multiples', 'VC-style exit timelines', 'Aggressive growth at all costs narrative'],
  },
  debt: {
    emphasis: ['Cash flow stability', 'Contract-backed revenue', 'Asset base', 'Covenant compliance'],
    keyMetrics: ['EBITDA', 'Interest coverage', 'Debt/equity', 'FCF generation'],
    openingHook: 'Investment-grade government receivables underpin the debt structure',
    dataRoomPriority: ['Cash flow projections', 'Debt schedule', 'Contract schedule', 'Financial statements'],
    anticipatedQuestions: ["What's the cash flow sensitivity?", 'What covenants would you accept?', "What's the collateral?", 'Walk me through the debt service coverage under the bear case.', 'What are the advance payment mechanics from IRIS2?'],
    toneGuidance: 'Conservative, credit-oriented language. Lead with downside protection, asset coverage, and government counterparty quality. Show cash flow stability under stress.',
    avoidTopics: ['Equity upside framing', 'Aggressive growth projections', 'Platform/software analogies'],
  },
  strategic: {
    emphasis: ['Platform integration', 'Technology synergies', 'Market access', 'Joint venture potential'],
    keyMetrics: ['Technology overlap', 'Customer base synergy', 'Manufacturing capacity', 'IP portfolio'],
    openingHook: 'A manufacturing platform that complements your existing operations',
    dataRoomPriority: ['Tech specs', 'Manufacturing plan', 'IP portfolio', 'Partnership structures'],
    anticipatedQuestions: ['How does this integrate with our existing business?', "What's the exclusivity arrangement?", 'Can we co-develop products?', 'Would you consider a JV structure?', 'What IP rights come with the investment?'],
    toneGuidance: 'Focus on synergies and mutual value creation. Understand their product roadmap and position ASL as an enabling platform. Avoid threatening their core business.',
    avoidTopics: ['Direct competition framing', 'Displacement of their products', 'Pure financial returns talk'],
  },
  family_office: {
    emphasis: ['Long-term value creation', 'Capital preservation', 'Tangible assets', 'Quality of management'],
    keyMetrics: ['Book value', 'Asset coverage ratio', 'Management track record', 'Downside protection'],
    openingHook: 'A real business with real assets building generational value',
    dataRoomPriority: ['Financial statements', 'Asset list', 'Management bios', 'Reference list'],
    anticipatedQuestions: ["What's the downside?", 'How are you different from prior investments?', "What's the exit timeline?", 'How aligned is the founder with long-term value creation?', 'What tangible assets secure the investment?'],
    toneGuidance: 'Emphasize the tangible: factories, satellites in orbit, government contracts, real revenue. Play down hype. Lead with management quality and capital discipline.',
    avoidTopics: ['Venture-style hype', 'Winner-take-all market narratives', 'Comparisons to software multiples'],
  },
};

/** Given an investor type, returns the narrative profile. Falls back to 'vc' if type is unknown. */
export function getNarrativeProfile(type: InvestorType): NarrativeProfile {
  return INVESTOR_NARRATIVES[type] || INVESTOR_NARRATIVES.vc;
}

/** Returns anticipated questions for a given investor type, merged with historical questions. */
export function getAnticipatedQuestions(type: InvestorType, historicalQuestions: string[] = []): string[] {
  const profile = getNarrativeProfile(type);
  return [...new Set([...historicalQuestions, ...profile.anticipatedQuestions])];
}
