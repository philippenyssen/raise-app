import { NextResponse } from 'next/server';
import { createInvestor, setRaiseConfig } from '@/lib/db';

export async function POST() {
  // Set ASL raise config
  setRaiseConfig({
    company_name: 'Aerospacelab',
    equity_amount: '250M',
    debt_amount: '250M',
    pre_money: '2.0Bn',
    post_money: '2.5Bn',
    target_close: '2026-09-30',
    three_beliefs: [
      'IRIS2 executes on time (signed, 4.1Bn) => 1.8x standalone',
      'Competitive vacuum persists 3+ years => 4.3x base case',
      'European defense sector reprices to US multiples => 10.2x bull',
    ],
    one_paragraph_pitch: 'Aerospacelab is Europe\'s only vertically integrated satellite manufacturer with 4.1Bn in contracted revenue (IRIS2, signed). At 2.0Bn pre-money, you buy a 500-sat/yr factory, a defense-grade SAR constellation, and the Mynaric optical terminal platform at 39x trailing — cheaper than Sierra Space (8Bn, zero sats in orbit) and K2 Space (3Bn, pre-revenue). Returns: Bear 1.3x / Base 4.3x / Bull 10.2x over 4 years.',
  });

  // Seed Tier 1 investors
  const tier1 = [
    { name: 'a16z (American Dynamism)', type: 'vc' as const, tier: 1 as const, partner: 'Katherine Boyle', fund_size: '$35Bn+', check_size_range: '$100-300M', sector_thesis: 'American/Western Dynamism — defense, space, industrial', speed: 'medium' as const, warm_path: 'Board connection', ic_process: '3-4 meetings over 4-6 weeks' },
    { name: 'Founders Fund', type: 'vc' as const, tier: 1 as const, partner: 'Trae Stephens', fund_size: '$11Bn+', check_size_range: '$50-200M', sector_thesis: 'Defense-tech, contrarian, Anduril investor', speed: 'medium' as const, warm_path: 'Anduril connection', ic_process: 'Partner consensus, 3-5 weeks' },
    { name: 'Lux Capital', type: 'vc' as const, tier: 1 as const, partner: 'Josh Wolfe', fund_size: '$5Bn+', check_size_range: '$50-150M', sector_thesis: 'Deep-tech, defense, space — "back the future"', speed: 'medium' as const, warm_path: 'Conference connection', ic_process: '2-3 meetings, 3-4 weeks' },
    { name: 'General Catalyst', type: 'vc' as const, tier: 1 as const, partner: 'Hemant Taneja', fund_size: '$25Bn+', check_size_range: '$100-250M', sector_thesis: 'Responsible innovation, climate, defense', speed: 'medium' as const, warm_path: 'Advisor network', ic_process: '4-6 weeks, structured' },
    { name: 'Sequoia Capital', type: 'vc' as const, tier: 1 as const, partner: 'TBD', fund_size: '$28Bn+', check_size_range: '$100-500M', sector_thesis: 'Category-defining companies, multi-decade compounders', speed: 'medium' as const, warm_path: 'Banker introduction', ic_process: 'Partner vote, 4-6 weeks' },
    { name: 'Mubadala', type: 'sovereign' as const, tier: 1 as const, partner: 'Technology team', fund_size: '$300Bn+', check_size_range: '$100-500M', sector_thesis: 'Technology, aerospace, defense diversification', speed: 'slow' as const, warm_path: 'Direct relationship', ic_process: '8-12 weeks, committee approval' },
    { name: 'SoftBank Vision Fund', type: 'vc' as const, tier: 1 as const, partner: 'TBD', fund_size: '$100Bn+', check_size_range: '$100-1Bn', sector_thesis: 'Category #1 companies, AI, space', speed: 'fast' as const, warm_path: 'Banker introduction', ic_process: 'Masa Son decision, can be 1-2 weeks' },
    { name: 'Tiger Global', type: 'growth' as const, tier: 1 as const, partner: 'TBD', fund_size: '$40Bn+', check_size_range: '$100-300M', sector_thesis: 'Growth at any stage, spreadsheet-driven', speed: 'fast' as const, warm_path: 'Banker introduction', ic_process: '48hrs-2 weeks if interested' },
  ];

  const tier2 = [
    { name: 'Bessemer Venture Partners', type: 'vc' as const, tier: 2 as const, partner: 'TBD', fund_size: '$20Bn+', check_size_range: '$50-150M', sector_thesis: 'Space economy roadmap published', speed: 'medium' as const },
    { name: 'Shield Capital', type: 'vc' as const, tier: 2 as const, partner: 'TBD', fund_size: '$1Bn', check_size_range: '$20-50M', sector_thesis: 'Defense-tech specialist', speed: 'medium' as const },
    { name: 'DCVC', type: 'vc' as const, tier: 2 as const, partner: 'TBD', fund_size: '$3Bn+', check_size_range: '$30-100M', sector_thesis: 'Deep-tech, computational approaches', speed: 'medium' as const },
    { name: 'Coatue Management', type: 'growth' as const, tier: 2 as const, partner: 'TBD', fund_size: '$48Bn', check_size_range: '$100-300M', sector_thesis: 'Cross-over fund, public comp driven', speed: 'fast' as const },
    { name: 'GIC Singapore', type: 'sovereign' as const, tier: 2 as const, partner: 'TBD', fund_size: '$800Bn+', check_size_range: '$100-500M', sector_thesis: 'Conservative growth, 20-year hold', speed: 'slow' as const },
    { name: 'Temasek', type: 'sovereign' as const, tier: 2 as const, partner: 'TBD', fund_size: '$300Bn+', check_size_range: '$100-300M', sector_thesis: 'Asian deep-tech, space interest', speed: 'slow' as const },
    { name: 'KKR Growth', type: 'growth' as const, tier: 2 as const, partner: 'TBD', fund_size: '$15Bn+', check_size_range: '$100-300M', sector_thesis: 'Growth equity, industrials-tech convergence', speed: 'medium' as const },
    { name: 'Atomico', type: 'vc' as const, tier: 2 as const, partner: 'TBD', fund_size: '$5Bn+', check_size_range: '$50-100M', sector_thesis: 'European deep-tech, Skype heritage', speed: 'medium' as const },
  ];

  const tier3 = [
    { name: 'EIB (European Investment Bank)', type: 'debt' as const, tier: 3 as const, partner: 'TBD', fund_size: 'N/A', check_size_range: '100-250M debt', sector_thesis: 'European strategic industry', speed: 'slow' as const },
    { name: 'Bpifrance', type: 'debt' as const, tier: 3 as const, partner: 'TBD', fund_size: 'N/A', check_size_range: '50-150M', sector_thesis: 'French/European deep-tech, blended', speed: 'slow' as const },
    { name: 'SFPI-FPIM', type: 'sovereign' as const, tier: 3 as const, partner: 'TBD', fund_size: '2Bn+', check_size_range: '20-50M', sector_thesis: 'Belgian strategic assets', speed: 'slow' as const },
    { name: 'In-Q-Tel', type: 'strategic' as const, tier: 3 as const, partner: 'TBD', fund_size: 'N/A', check_size_range: '5-20M', sector_thesis: 'US intelligence community needs', speed: 'medium' as const },
    { name: 'Airbus Ventures', type: 'strategic' as const, tier: 3 as const, partner: 'TBD', fund_size: '$500M', check_size_range: '10-30M', sector_thesis: 'Aerospace supply chain', speed: 'medium' as const },
    { name: 'CDPQ', type: 'sovereign' as const, tier: 3 as const, partner: 'TBD', fund_size: '$400Bn+', check_size_range: '100-300M', sector_thesis: 'Canadian pension, infrastructure, tech', speed: 'slow' as const },
  ];

  for (const inv of [...tier1, ...tier2, ...tier3]) {
    createInvestor(inv);
  }

  return NextResponse.json({ ok: true, seeded: tier1.length + tier2.length + tier3.length });
}
