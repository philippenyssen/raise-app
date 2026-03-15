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
    ? <CheckCircle className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
    : keyTest?.status === 'credits_issue'
    ? <AlertTriangle className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
    : <XCircle className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />;

  const statusStyle: React.CSSProperties = keyTest?.status === 'ok'
    ? { borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)', background: 'var(--success-muted)' }
    : keyTest?.status === 'credits_issue'
    ? { borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)', background: 'var(--warning-muted)' }
    : { borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)', background: 'var(--danger-muted)' };

  if (loading) {
    return (
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="page-title" style={{ fontSize: 'var(--font-size-xl)' }}>Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>Loading configuration...</p>
        </div>
        <div className="flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span style={{ fontSize: 'var(--font-size-sm)' }}>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl page-content">
      <div>
        <h1 className="page-title" style={{ fontSize: 'var(--font-size-xl)' }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>Raise configuration, scoring weights, follow-up cadence, and API diagnostics</p>
      </div>

      {/* ================================================================= */}
      {/* 1. RAISE PARAMETERS                                               */}
      {/* ================================================================= */}
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 400, color: 'var(--text-primary)' }}>Raise Parameters</h2>
          </div>
          <button
            onClick={saveRaiseConfig}
            disabled={savingRaise || !raiseDirty}
            className={`btn btn-md ${raiseDirty ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Save className={`w-3.5 h-3.5 ${savingRaise ? 'animate-spin' : ''}`} />
            {savingRaise ? 'Saving...' : raiseDirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Company Name */}
          <div className="md:col-span-2">
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>Company Name</label>
            <input
              type="text"
              value={raiseConfig.company_name}
              onChange={e => updateRaise('company_name', e.target.value)}
              placeholder="e.g. Aerospacelab"
              className="input"
            />
          </div>

          {/* Round Type */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>Round Type</label>
            <div className="relative">
              <select
                value={raiseConfig.round_type}
                onChange={e => updateRaise('round_type', e.target.value)}
                className="input"
                style={{ appearance: 'none', cursor: 'pointer' }}
              >
                {ROUND_TYPES.map(rt => (
                  <option key={rt} value={rt}>{rt}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>Currency</label>
            <div className="relative">
              <select
                value={raiseConfig.currency}
                onChange={e => updateRaise('currency', e.target.value)}
                className="input"
                style={{ appearance: 'none', cursor: 'pointer' }}
              >
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Target Equity Raise */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>
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
                className="input"
              />
              {raiseConfig.equity_amount > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {formatCompact(raiseConfig.equity_amount, raiseConfig.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Target Debt Raise */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>
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
                className="input"
              />
              {raiseConfig.debt_amount > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {formatCompact(raiseConfig.debt_amount, raiseConfig.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Pre-money Valuation */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>
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
                className="input"
              />
              {raiseConfig.pre_money > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {formatCompact(raiseConfig.pre_money, raiseConfig.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Post-money (computed) */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>
              Post-money Valuation
            </label>
            <div style={{
              padding: '0.5rem 0.75rem',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-tertiary)',
            }}>
              {raiseConfig.pre_money && raiseConfig.equity_amount
                ? formatCompact(raiseConfig.pre_money + raiseConfig.equity_amount, raiseConfig.currency)
                : '—'}
            </div>
          </div>

          {/* Target Close Date */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                Target Close Date
              </span>
            </label>
            <input
              type="date"
              value={raiseConfig.target_close}
              onChange={e => updateRaise('target_close', e.target.value)}
              className="input [color-scheme:dark]"
            />
          </div>

          {/* Target Investor Count */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>
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
              className="input"
            />
          </div>

          {/* Minimum Check Size */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>
              Minimum Check Size
            </label>
            <div className="relative">
              <input
                type="number"
                value={raiseConfig.minimum_check_size || ''}
                onChange={e => updateRaise('minimum_check_size', Number(e.target.value))}
                placeholder="25000000"
                className="input"
              />
              {raiseConfig.minimum_check_size > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {formatCompact(raiseConfig.minimum_check_size, raiseConfig.currency)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Summary row */}
        {raiseConfig.equity_amount > 0 && raiseConfig.pre_money > 0 && (
          <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="grid grid-cols-3 gap-4" style={{ textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.125rem' }}>Total Raise</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  {formatCompact(raiseConfig.equity_amount + raiseConfig.debt_amount, raiseConfig.currency)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.125rem' }}>Dilution</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  {((raiseConfig.equity_amount / (raiseConfig.pre_money + raiseConfig.equity_amount)) * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.125rem' }}>Post-money EV</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
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
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 400, color: 'var(--text-primary)' }}>Scoring Weights</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setScoringWeights({ ...DEFAULT_SCORING_WEIGHTS });
                setScoringDirty(true);
              }}
              className="btn btn-sm btn-ghost"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Defaults
            </button>
            <button
              onClick={saveScoringWeights}
              disabled={savingScoring || !scoringDirty}
              className={`btn btn-md ${scoringDirty ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Save className={`w-3.5 h-3.5 ${savingScoring ? 'animate-spin' : ''}`} />
              {savingScoring ? 'Saving...' : scoringDirty ? 'Save Changes' : 'Saved'}
            </button>
          </div>
        </div>

        {/* Total indicator */}
        <div className="flex items-center gap-2" style={{
          marginBottom: 'var(--space-5)',
          fontSize: 'var(--font-size-sm)',
          color: weightBalanced ? 'var(--success)' : 'var(--warning)',
        }}>
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
              <label className="w-36 shrink-0" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{WEIGHT_LABELS[key]}</label>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={scoringWeights[key]}
                onChange={e => updateWeight(key, Number(e.target.value))}
                className="flex-1 h-1.5 cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div className="w-14" style={{ textAlign: 'right' }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={scoringWeights[key]}
                  onChange={e => updateWeight(key, Number(e.target.value))}
                  className="input"
                  style={{ width: '3.5rem', padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-xs)', textAlign: 'right' }}
                />
              </div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: '1rem' }}>%</span>
            </div>
          ))}
        </div>
      </div>

      {/* ================================================================= */}
      {/* 3. FOLLOW-UP CADENCE                                              */}
      {/* ================================================================= */}
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 400, color: 'var(--text-primary)' }}>Follow-up Cadence</h2>
          </div>
          <button
            onClick={saveFollowupCadence}
            disabled={savingFollowup || !followupDirty}
            className={`btn btn-md ${followupDirty ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Save className={`w-3.5 h-3.5 ${savingFollowup ? 'animate-spin' : ''}`} />
            {savingFollowup ? 'Saving...' : followupDirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Thank You Delay */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>Thank You Email Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followupCadence.thank_you_delay_hours}
                onChange={e => updateFollowup('thank_you_delay_hours', Number(e.target.value))}
                min={0}
                max={72}
                className="input flex-1"
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: '3rem' }}>hours</span>
            </div>
          </div>

          {/* Objection Response Delay */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>Objection Response Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followupCadence.objection_response_delay_hours}
                onChange={e => updateFollowup('objection_response_delay_hours', Number(e.target.value))}
                min={0}
                max={168}
                className="input flex-1"
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: '3rem' }}>hours</span>
            </div>
          </div>

          {/* Schedule Next Meeting Delay */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>Schedule Next Meeting Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followupCadence.schedule_next_meeting_delay_hours}
                onChange={e => updateFollowup('schedule_next_meeting_delay_hours', Number(e.target.value))}
                min={0}
                max={168}
                className="input flex-1"
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: '3rem' }}>hours</span>
            </div>
          </div>

          {/* Re-engagement Delay */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>Re-engagement Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followupCadence.reengagement_delay_days}
                onChange={e => updateFollowup('reengagement_delay_days', Number(e.target.value))}
                min={1}
                max={30}
                className="input flex-1"
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: '3rem' }}>days</span>
            </div>
          </div>

          {/* Escalation Delay */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>Escalation Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followupCadence.escalation_delay_days}
                onChange={e => updateFollowup('escalation_delay_days', Number(e.target.value))}
                min={1}
                max={60}
                className="input flex-1"
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: '3rem' }}>days</span>
            </div>
          </div>

          {/* Tier 1 Speed Multiplier */}
          <div>
            <label className="block" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)', marginBottom: '0.375rem' }}>Tier 1 Speed Multiplier</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followupCadence.tier1_speed_multiplier}
                onChange={e => updateFollowup('tier1_speed_multiplier', Number(e.target.value))}
                min={25}
                max={100}
                className="input flex-1"
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: '3rem' }}>%</span>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
              {followupCadence.tier1_speed_multiplier}% means Tier 1 investors get follow-ups {100 - followupCadence.tier1_speed_multiplier}% faster
            </p>
          </div>
        </div>

        {/* Cadence summary */}
        <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Effective Tier 1 cadence:</p>
          <div className="grid grid-cols-3 gap-3" style={{ textAlign: 'center' }}>
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Thank you</div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                {Math.round(followupCadence.thank_you_delay_hours * followupCadence.tier1_speed_multiplier / 100)}h
              </div>
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Objection</div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                {Math.round(followupCadence.objection_response_delay_hours * followupCadence.tier1_speed_multiplier / 100)}h
              </div>
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Re-engage</div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                {Math.round(followupCadence.reengagement_delay_days * followupCadence.tier1_speed_multiplier / 100)}d
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 4. API CONFIGURATION                                              */}
      {/* ================================================================= */}
      <div style={{
        border: '1px solid',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        ...statusStyle,
      }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 400, color: 'var(--text-primary)' }}>Anthropic API Key</h2>
          </div>
          <button
            onClick={testKey}
            disabled={testing}
            className="btn btn-sm btn-secondary"
            style={{ opacity: testing ? 0.5 : 1 }}
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
                <div style={{ fontWeight: 400, color: 'var(--text-primary)' }}>{keyTest.message}</div>
                {keyTest.key && (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)', fontFamily: 'var(--font-mono)' }}>{keyTest.key}</div>
                )}
              </div>
            </div>

            {keyTest.error && (
              <div style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--text-primary)',
                background: 'var(--danger-muted)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                fontFamily: 'var(--font-mono)',
              }}>
                {keyTest.error}
              </div>
            )}

            {keyTest.fix && (
              <div style={{
                background: 'var(--surface-1)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
              }} className="space-y-2">
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>How to fix:</div>
                {Array.isArray(keyTest.fix) ? (
                  <ol className="space-y-1" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>
                    {keyTest.fix.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                ) : (
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>{keyTest.fix}</p>
                )}
              </div>
            )}
          </div>
        )}

        {testing && !keyTest && (
          <div className="animate-pulse" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>Testing API key...</div>
        )}
      </div>

      {/* Billing info */}
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-3)' }}>
          <Settings2 className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-tertiary)' }}>IMPORTANT: Claude.ai vs API Credits</h3>
        </div>
        <div className="space-y-2" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
          <p>Anthropic has <strong style={{ color: 'var(--text-secondary)' }}>two separate billing systems</strong>:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong style={{ color: 'var(--text-secondary)' }}>claude.ai</strong> --- subscription credits for the chatbot (Claude Pro/Team)</li>
            <li><strong style={{ color: 'var(--text-secondary)' }}>console.anthropic.com</strong> --- API credits for programmatic access (what this app uses)</li>
          </ul>
          <p>Credits on claude.ai do <strong style={{ color: 'var(--text-primary)' }}>NOT</strong> apply to API usage. You need credits specifically on <strong style={{ color: 'var(--text-secondary)' }}>console.anthropic.com/settings/billing</strong>.</p>
          <p style={{ marginTop: 'var(--space-3)' }}>If the test above shows a credits issue:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Go to <strong style={{ color: 'var(--text-secondary)' }}>console.anthropic.com/settings/billing</strong></li>
            <li>Click <strong style={{ color: 'var(--text-secondary)' }}>&ldquo;Add to credit balance&rdquo;</strong> (minimum $5)</li>
            <li>Then go to <strong style={{ color: 'var(--text-secondary)' }}>console.anthropic.com/settings/keys</strong></li>
            <li>Create a <strong style={{ color: 'var(--text-secondary)' }}>new API key</strong></li>
            <li>Update it in your <strong style={{ color: 'var(--text-secondary)' }}>Vercel environment variables</strong></li>
            <li><strong style={{ color: 'var(--text-secondary)' }}>Redeploy</strong> the app</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
