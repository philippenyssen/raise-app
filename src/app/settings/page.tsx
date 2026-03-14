'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle, XCircle, RefreshCw, Key,
  Settings2, Sliders, Clock, Save, RotateCcw, Building2,
  DollarSign, Target, Calendar, Users, ChevronDown,
} from 'lucide-react';
import { useToast } from '@/components/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KeyTest {
  status: string;
  message: string;
  key?: string;
  fix?: string | string[];
  error?: string;
}

interface RaiseConfigForm {
  company_name: string;
  round_type: string;
  equity_amount: number;
  debt_amount: number;
  pre_money: number;
  target_close: string;
  currency: string;
  target_investor_count: number;
  minimum_check_size: number;
}

interface ScoringWeightsForm {
  engagement: number;
  thesis_fit: number;
  check_size: number;
  speed: number;
  conflict: number;
  warm_path: number;
  meeting_quality: number;
  momentum: number;
}

interface FollowupCadenceForm {
  thank_you_delay_hours: number;
  objection_response_delay_hours: number;
  schedule_next_meeting_delay_hours: number;
  reengagement_delay_days: number;
  escalation_delay_days: number;
  tier1_speed_multiplier: number;
}

const DEFAULT_SCORING_WEIGHTS: ScoringWeightsForm = {
  engagement: 20,
  thesis_fit: 15,
  check_size: 10,
  speed: 10,
  conflict: 10,
  warm_path: 10,
  meeting_quality: 15,
  momentum: 10,
};

const DEFAULT_FOLLOWUP_CADENCE: FollowupCadenceForm = {
  thank_you_delay_hours: 2,
  objection_response_delay_hours: 24,
  schedule_next_meeting_delay_hours: 48,
  reengagement_delay_days: 5,
  escalation_delay_days: 10,
  tier1_speed_multiplier: 75,
};

const DEFAULT_RAISE_CONFIG: RaiseConfigForm = {
  company_name: '',
  round_type: 'Series C',
  equity_amount: 0,
  debt_amount: 0,
  pre_money: 0,
  target_close: '',
  currency: 'EUR',
  target_investor_count: 0,
  minimum_check_size: 0,
};

const ROUND_TYPES = ['Series A', 'Series B', 'Series C', 'Series D', 'Pre-IPO', 'Bridge'];
const CURRENCIES = ['EUR', 'USD', 'GBP'];

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '\u20ac', USD: '$', GBP: '\u00a3' };

const WEIGHT_LABELS: Record<keyof ScoringWeightsForm, string> = {
  engagement: 'Engagement',
  thesis_fit: 'Thesis Fit',
  check_size: 'Check Size Fit',
  speed: 'Speed Match',
  conflict: 'Conflict Risk',
  warm_path: 'Warm Path',
  meeting_quality: 'Meeting Quality',
  momentum: 'Momentum',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCompact(value: number, currency: string): string {
  if (!value) return `${CURRENCY_SYMBOLS[currency] || currency}0`;
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  if (value >= 1_000_000_000) return `${sym}${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `${sym}${(value / 1_000).toFixed(0)}K`;
  return `${sym}${value}`;
}

function parseExistingRaiseConfig(raw: Record<string, unknown> | null): RaiseConfigForm {
  if (!raw) return { ...DEFAULT_RAISE_CONFIG };
  return {
    company_name: (raw.company_name as string) || '',
    round_type: (raw.round_type as string) || 'Series C',
    equity_amount: Number(raw.equity_amount) || parseMoneyString(raw.equity_amount as string),
    debt_amount: Number(raw.debt_amount) || parseMoneyString(raw.debt_amount as string),
    pre_money: Number(raw.pre_money) || parseMoneyString(raw.pre_money as string),
    target_close: (raw.target_close as string) || '',
    currency: (raw.currency as string) || 'EUR',
    target_investor_count: Number(raw.target_investor_count) || 0,
    minimum_check_size: Number(raw.minimum_check_size) || 0,
  };
}

function parseMoneyString(s: unknown): number {
  if (typeof s !== 'string') return 0;
  const cleaned = s.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (s.toLowerCase().includes('b')) return num * 1_000_000_000;
  if (s.toLowerCase().includes('m')) return num * 1_000_000;
  if (s.toLowerCase().includes('k')) return num * 1_000;
  return num;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { toast } = useToast();

  // API key test
  const [keyTest, setKeyTest] = useState<KeyTest | null>(null);
  const [testing, setTesting] = useState(false);

  // Config state
  const [loading, setLoading] = useState(true);
  const [raiseConfig, setRaiseConfig] = useState<RaiseConfigForm>({ ...DEFAULT_RAISE_CONFIG });
  const [scoringWeights, setScoringWeights] = useState<ScoringWeightsForm>({ ...DEFAULT_SCORING_WEIGHTS });
  const [followupCadence, setFollowupCadence] = useState<FollowupCadenceForm>({ ...DEFAULT_FOLLOWUP_CADENCE });

  // Dirty tracking
  const [raiseDirty, setRaiseDirty] = useState(false);
  const [scoringDirty, setScoringDirty] = useState(false);
  const [followupDirty, setFollowupDirty] = useState(false);

  // Saving state
  const [savingRaise, setSavingRaise] = useState(false);
  const [savingScoring, setSavingScoring] = useState(false);
  const [savingFollowup, setSavingFollowup] = useState(false);

  // -------------------------------------------------------------------------
  // Load settings
  // -------------------------------------------------------------------------

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();

      if (data.raise_config) {
        setRaiseConfig(parseExistingRaiseConfig(data.raise_config));
      }
      if (data.scoring_weights) {
        setScoringWeights({ ...DEFAULT_SCORING_WEIGHTS, ...(data.scoring_weights as ScoringWeightsForm) });
      }
      if (data.followup_cadence) {
        setFollowupCadence({ ...DEFAULT_FOLLOWUP_CADENCE, ...(data.followup_cadence as FollowupCadenceForm) });
      }
    } catch {
      toast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
    testKey();
  }, [loadSettings]);

  // -------------------------------------------------------------------------
  // Save helpers
  // -------------------------------------------------------------------------

  async function saveConfig(key: string, value: unknown) {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Save failed');
    }
    return res.json();
  }

  async function saveRaiseConfig() {
    setSavingRaise(true);
    try {
      await saveConfig('raise_config', raiseConfig);
      toast('Raise parameters saved', 'success');
      setRaiseDirty(false);
    } catch (e: unknown) {
      toast((e as Error).message || 'Failed to save raise config', 'error');
    } finally {
      setSavingRaise(false);
    }
  }

  async function saveScoringWeights() {
    const total = Object.values(scoringWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 1) {
      toast(`Weights must sum to 100% (currently ${total}%)`, 'warning');
      return;
    }
    setSavingScoring(true);
    try {
      await saveConfig('scoring_weights', scoringWeights);
      toast('Scoring weights saved', 'success');
      setScoringDirty(false);
    } catch (e: unknown) {
      toast((e as Error).message || 'Failed to save scoring weights', 'error');
    } finally {
      setSavingScoring(false);
    }
  }

  async function saveFollowupCadence() {
    setSavingFollowup(true);
    try {
      await saveConfig('followup_cadence', followupCadence);
      toast('Follow-up cadence saved', 'success');
      setFollowupDirty(false);
    } catch (e: unknown) {
      toast((e as Error).message || 'Failed to save follow-up cadence', 'error');
    } finally {
      setSavingFollowup(false);
    }
  }

  // -------------------------------------------------------------------------
  // API key test
  // -------------------------------------------------------------------------

  async function testKey() {
    setTesting(true);
    try {
      const res = await fetch('/api/test-key');
      setKeyTest(await res.json());
    } catch {
      setKeyTest({ status: 'error', message: 'Could not reach test endpoint' });
    } finally {
      setTesting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers for form fields
  // -------------------------------------------------------------------------

  function updateRaise<K extends keyof RaiseConfigForm>(field: K, value: RaiseConfigForm[K]) {
    setRaiseConfig(prev => ({ ...prev, [field]: value }));
    setRaiseDirty(true);
  }

  function updateWeight(field: keyof ScoringWeightsForm, value: number) {
    setScoringWeights(prev => ({ ...prev, [field]: value }));
    setScoringDirty(true);
  }

  function updateFollowup<K extends keyof FollowupCadenceForm>(field: K, value: FollowupCadenceForm[K]) {
    setFollowupCadence(prev => ({ ...prev, [field]: value }));
    setFollowupDirty(true);
  }

  const weightTotal = Object.values(scoringWeights).reduce((a, b) => a + b, 0);
  const weightBalanced = Math.abs(weightTotal - 100) <= 1;

  const statusIcon = keyTest?.status === 'ok'
    ? <CheckCircle className="w-5 h-5 text-green-400" />
    : keyTest?.status === 'credits_issue'
    ? <AlertTriangle className="w-5 h-5 text-yellow-400" />
    : <XCircle className="w-5 h-5 text-red-400" />;

  const statusColor = keyTest?.status === 'ok'
    ? 'border-green-800 bg-green-900/20'
    : keyTest?.status === 'credits_issue'
    ? 'border-yellow-800 bg-yellow-900/20'
    : 'border-red-800 bg-red-900/20';

  if (loading) {
    return (
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-zinc-500 text-sm mt-1">Loading configuration...</p>
        </div>
        <div className="flex items-center gap-3 text-zinc-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-zinc-500 text-sm mt-1">Raise configuration, scoring weights, follow-up cadence, and API diagnostics</p>
      </div>

      {/* ================================================================= */}
      {/* 1. RAISE PARAMETERS                                               */}
      {/* ================================================================= */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-semibold">Raise Parameters</h2>
          </div>
          <button
            onClick={saveRaiseConfig}
            disabled={savingRaise || !raiseDirty}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
          >
            <Save className={`w-3.5 h-3.5 ${savingRaise ? 'animate-spin' : ''}`} />
            {savingRaise ? 'Saving...' : raiseDirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Company Name */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Company Name</label>
            <input
              type="text"
              value={raiseConfig.company_name}
              onChange={e => updateRaise('company_name', e.target.value)}
              placeholder="e.g. Aerospacelab"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 placeholder-zinc-600"
            />
          </div>

          {/* Round Type */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Round Type</label>
            <div className="relative">
              <select
                value={raiseConfig.round_type}
                onChange={e => updateRaise('round_type', e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
              >
                {ROUND_TYPES.map(rt => (
                  <option key={rt} value={rt}>{rt}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Currency</label>
            <div className="relative">
              <select
                value={raiseConfig.currency}
                onChange={e => updateRaise('currency', e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
              >
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Target Equity Raise */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3 h-3" />
                Target Equity Raise
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={raiseConfig.equity_amount || ''}
                onChange={e => updateRaise('equity_amount', Number(e.target.value))}
                placeholder="250000000"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 placeholder-zinc-600"
              />
              {raiseConfig.equity_amount > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                  {formatCompact(raiseConfig.equity_amount, raiseConfig.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Target Debt Raise */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3 h-3" />
                Target Debt Raise
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={raiseConfig.debt_amount || ''}
                onChange={e => updateRaise('debt_amount', Number(e.target.value))}
                placeholder="250000000"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 placeholder-zinc-600"
              />
              {raiseConfig.debt_amount > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                  {formatCompact(raiseConfig.debt_amount, raiseConfig.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Pre-money Valuation */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Target className="w-3 h-3" />
                Pre-money Valuation
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={raiseConfig.pre_money || ''}
                onChange={e => updateRaise('pre_money', Number(e.target.value))}
                placeholder="2000000000"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 placeholder-zinc-600"
              />
              {raiseConfig.pre_money > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                  {formatCompact(raiseConfig.pre_money, raiseConfig.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Post-money (computed) */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Post-money Valuation
            </label>
            <div className="px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-400">
              {raiseConfig.pre_money && raiseConfig.equity_amount
                ? formatCompact(raiseConfig.pre_money + raiseConfig.equity_amount, raiseConfig.currency)
                : '---'}
            </div>
          </div>

          {/* Target Close Date */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                Target Close Date
              </span>
            </label>
            <input
              type="date"
              value={raiseConfig.target_close}
              onChange={e => updateRaise('target_close', e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 [color-scheme:dark]"
            />
          </div>

          {/* Target Investor Count */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                Target Investor Count
              </span>
            </label>
            <input
              type="number"
              value={raiseConfig.target_investor_count || ''}
              onChange={e => updateRaise('target_investor_count', Number(e.target.value))}
              placeholder="5"
              min={0}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 placeholder-zinc-600"
            />
          </div>

          {/* Minimum Check Size */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Minimum Check Size
            </label>
            <div className="relative">
              <input
                type="number"
                value={raiseConfig.minimum_check_size || ''}
                onChange={e => updateRaise('minimum_check_size', Number(e.target.value))}
                placeholder="25000000"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 placeholder-zinc-600"
              />
              {raiseConfig.minimum_check_size > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                  {formatCompact(raiseConfig.minimum_check_size, raiseConfig.currency)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Summary row */}
        {raiseConfig.equity_amount > 0 && raiseConfig.pre_money > 0 && (
          <div className="mt-5 pt-4 border-t border-zinc-800">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">Total Raise</div>
                <div className="text-sm font-medium text-zinc-200">
                  {formatCompact(raiseConfig.equity_amount + raiseConfig.debt_amount, raiseConfig.currency)}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">Dilution</div>
                <div className="text-sm font-medium text-zinc-200">
                  {((raiseConfig.equity_amount / (raiseConfig.pre_money + raiseConfig.equity_amount)) * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">Post-money EV</div>
                <div className="text-sm font-medium text-zinc-200">
                  {formatCompact(raiseConfig.pre_money + raiseConfig.equity_amount, raiseConfig.currency)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* 2. SCORING WEIGHTS                                                */}
      {/* ================================================================= */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-semibold">Scoring Weights</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setScoringWeights({ ...DEFAULT_SCORING_WEIGHTS });
                setScoringDirty(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Defaults
            </button>
            <button
              onClick={saveScoringWeights}
              disabled={savingScoring || !scoringDirty}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
            >
              <Save className={`w-3.5 h-3.5 ${savingScoring ? 'animate-spin' : ''}`} />
              {savingScoring ? 'Saving...' : scoringDirty ? 'Save Changes' : 'Saved'}
            </button>
          </div>
        </div>

        {/* Total indicator */}
        <div className={`mb-5 flex items-center gap-2 text-sm ${weightBalanced ? 'text-green-400' : 'text-yellow-400'}`}>
          {weightBalanced ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <span>
            Total: {weightTotal}%
            {!weightBalanced && ` (must equal 100%)`}
          </span>
        </div>

        <div className="space-y-4">
          {(Object.keys(WEIGHT_LABELS) as Array<keyof ScoringWeightsForm>).map(key => (
            <div key={key} className="flex items-center gap-4">
              <label className="w-36 text-sm text-zinc-300 shrink-0">{WEIGHT_LABELS[key]}</label>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={scoringWeights[key]}
                onChange={e => updateWeight(key, Number(e.target.value))}
                className="flex-1 h-1.5 accent-blue-500 bg-zinc-700 rounded-full cursor-pointer"
              />
              <div className="w-14 text-right">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={scoringWeights[key]}
                  onChange={e => updateWeight(key, Number(e.target.value))}
                  className="w-14 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-right focus:outline-none focus:border-blue-500"
                />
              </div>
              <span className="text-xs text-zinc-500 w-4">%</span>
            </div>
          ))}
        </div>
      </div>

      {/* ================================================================= */}
      {/* 3. FOLLOW-UP CADENCE                                              */}
      {/* ================================================================= */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-semibold">Follow-up Cadence</h2>
          </div>
          <button
            onClick={saveFollowupCadence}
            disabled={savingFollowup || !followupDirty}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
          >
            <Save className={`w-3.5 h-3.5 ${savingFollowup ? 'animate-spin' : ''}`} />
            {savingFollowup ? 'Saving...' : followupDirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Thank You Delay */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Thank You Email Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followupCadence.thank_you_delay_hours}
                onChange={e => updateFollowup('thank_you_delay_hours', Number(e.target.value))}
                min={0}
                max={72}
                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              />
              <span className="text-xs text-zinc-500 w-12">hours</span>
            </div>
          </div>

          {/* Objection Response Delay */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Objection Response Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followupCadence.objection_response_delay_hours}
                onChange={e => updateFollowup('objection_response_delay_hours', Number(e.target.value))}
                min={0}
                max={168}
                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              />
              <span className="text-xs text-zinc-500 w-12">hours</span>
            </div>
          </div>

          {/* Schedule Next Meeting Delay */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Schedule Next Meeting Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followupCadence.schedule_next_meeting_delay_hours}
                onChange={e => updateFollowup('schedule_next_meeting_delay_hours', Number(e.target.value))}
                min={0}
                max={168}
                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              />
              <span className="text-xs text-zinc-500 w-12">hours</span>
            </div>
          </div>

          {/* Re-engagement Delay */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Re-engagement Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followupCadence.reengagement_delay_days}
                onChange={e => updateFollowup('reengagement_delay_days', Number(e.target.value))}
                min={1}
                max={30}
                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              />
              <span className="text-xs text-zinc-500 w-12">days</span>
            </div>
          </div>

          {/* Escalation Delay */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Escalation Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followupCadence.escalation_delay_days}
                onChange={e => updateFollowup('escalation_delay_days', Number(e.target.value))}
                min={1}
                max={60}
                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              />
              <span className="text-xs text-zinc-500 w-12">days</span>
            </div>
          </div>

          {/* Tier 1 Speed Multiplier */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Tier 1 Speed Multiplier</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followupCadence.tier1_speed_multiplier}
                onChange={e => updateFollowup('tier1_speed_multiplier', Number(e.target.value))}
                min={25}
                max={100}
                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              />
              <span className="text-xs text-zinc-500 w-12">%</span>
            </div>
            <p className="text-xs text-zinc-600 mt-1">
              {followupCadence.tier1_speed_multiplier}% means Tier 1 investors get follow-ups {100 - followupCadence.tier1_speed_multiplier}% faster
            </p>
          </div>
        </div>

        {/* Cadence summary */}
        <div className="mt-5 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 mb-2">Effective Tier 1 cadence:</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-zinc-900/50 rounded-lg py-2 px-3">
              <div className="text-xs text-zinc-500">Thank you</div>
              <div className="text-sm font-medium text-zinc-300">
                {Math.round(followupCadence.thank_you_delay_hours * followupCadence.tier1_speed_multiplier / 100)}h
              </div>
            </div>
            <div className="bg-zinc-900/50 rounded-lg py-2 px-3">
              <div className="text-xs text-zinc-500">Objection</div>
              <div className="text-sm font-medium text-zinc-300">
                {Math.round(followupCadence.objection_response_delay_hours * followupCadence.tier1_speed_multiplier / 100)}h
              </div>
            </div>
            <div className="bg-zinc-900/50 rounded-lg py-2 px-3">
              <div className="text-xs text-zinc-500">Re-engage</div>
              <div className="text-sm font-medium text-zinc-300">
                {Math.round(followupCadence.reengagement_delay_days * followupCadence.tier1_speed_multiplier / 100)}d
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 4. API CONFIGURATION                                              */}
      {/* ================================================================= */}
      <div className={`border rounded-xl p-6 ${statusColor}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-semibold">Anthropic API Key</h2>
          </div>
          <button
            onClick={testKey}
            disabled={testing}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            Test Key
          </button>
        </div>

        {keyTest && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              {statusIcon}
              <div>
                <div className="font-medium">{keyTest.message}</div>
                {keyTest.key && (
                  <div className="text-xs text-zinc-500 mt-1 font-mono">{keyTest.key}</div>
                )}
              </div>
            </div>

            {keyTest.error && (
              <div className="text-sm text-red-400 bg-red-900/20 rounded-lg p-3 font-mono text-xs">
                {keyTest.error}
              </div>
            )}

            {keyTest.fix && (
              <div className="bg-zinc-900 rounded-lg p-4 space-y-2">
                <div className="text-sm font-medium text-zinc-300">How to fix:</div>
                {Array.isArray(keyTest.fix) ? (
                  <ol className="text-sm text-zinc-400 space-y-1">
                    {keyTest.fix.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-zinc-400">{keyTest.fix}</p>
                )}
              </div>
            )}
          </div>
        )}

        {testing && !keyTest && (
          <div className="text-sm text-zinc-400 animate-pulse">Testing API key...</div>
        )}
      </div>

      {/* Billing info */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <Settings2 className="w-5 h-5 text-zinc-400" />
          <h3 className="text-sm font-medium text-zinc-400">IMPORTANT: Claude.ai vs API Credits</h3>
        </div>
        <div className="text-sm text-zinc-500 space-y-2">
          <p>Anthropic has <strong className="text-zinc-300">two separate billing systems</strong>:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-zinc-300">claude.ai</strong> --- subscription credits for the chatbot (Claude Pro/Team)</li>
            <li><strong className="text-zinc-300">console.anthropic.com</strong> --- API credits for programmatic access (what this app uses)</li>
          </ul>
          <p>Credits on claude.ai do <strong className="text-red-400">NOT</strong> apply to API usage. You need credits specifically on <strong className="text-zinc-300">console.anthropic.com/settings/billing</strong>.</p>
          <p className="mt-3">If the test above shows a credits issue:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Go to <strong className="text-zinc-300">console.anthropic.com/settings/billing</strong></li>
            <li>Click <strong className="text-zinc-300">&ldquo;Add to credit balance&rdquo;</strong> (minimum $5)</li>
            <li>Then go to <strong className="text-zinc-300">console.anthropic.com/settings/keys</strong></li>
            <li>Create a <strong className="text-zinc-300">new API key</strong></li>
            <li>Update it in your <strong className="text-zinc-300">Vercel environment variables</strong></li>
            <li><strong className="text-zinc-300">Redeploy</strong> the app</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
