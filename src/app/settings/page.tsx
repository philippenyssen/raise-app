'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle, XCircle, RefreshCw, Key,
  Settings2, Sliders, Clock, Save, RotateCcw, Building2,
  DollarSign, Target, Calendar, Users, ChevronDown,
} from 'lucide-react';
import { useToast } from '@/components/toast';
import { stFontSm, stFontXs, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';

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
// Form section hook — consolidates data/dirty/saving state + save logic
// ---------------------------------------------------------------------------

function useFormSection<T extends object>(
  settingsKey: string,
  defaultValue: T,
  toastFn: (msg: string, type: 'success' | 'error' | 'warning') => void,
  successMsg: string,
  errorMsg: string,
) {
  const [data, setData] = useState<T>({ ...defaultValue });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setData(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  }, []);

  const reset = useCallback((newData: T) => {
    setData(newData);
    setDirty(false);
  }, []);

  const save = useCallback(async (validate?: () => boolean) => {
    if (validate && !validate()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: settingsKey, value: data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }
      await res.json();
      toastFn(successMsg, 'success');
      setDirty(false);
    } catch (e: unknown) {
      toastFn((e as Error).message || errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  }, [settingsKey, data, toastFn, successMsg, errorMsg]);

  const replace = useCallback((newData: T) => {
    setData(newData);
    setDirty(true);
  }, []);

  return { data, dirty, saving, update, save, reset, replace };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { toast } = useToast();

  const [keyTest, setKeyTest] = useState<KeyTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);

  const raise = useFormSection<RaiseConfigForm>(
    'raise_config', DEFAULT_RAISE_CONFIG, toast, 'Raise parameters saved', 'Failed to save raise config',
  );
  const scoring = useFormSection<ScoringWeightsForm>(
    'scoring_weights', DEFAULT_SCORING_WEIGHTS, toast, 'Scoring weights saved', 'Failed to save scoring weights',
  );
  const followup = useFormSection<FollowupCadenceForm>(
    'followup_cadence', DEFAULT_FOLLOWUP_CADENCE, toast, 'Follow-up cadence saved', 'Failed to save follow-up cadence',
  );

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();

      if (data.raise_config) {
        raise.reset(parseExistingRaiseConfig(data.raise_config));
      }
      if (data.scoring_weights) {
        scoring.reset({ ...DEFAULT_SCORING_WEIGHTS, ...(data.scoring_weights as ScoringWeightsForm) });
      }
      if (data.followup_cadence) {
        followup.reset({ ...DEFAULT_FOLLOWUP_CADENCE, ...(data.followup_cadence as FollowupCadenceForm) });
      }
    } catch {
      toast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  useEffect(() => {
    loadSettings();
    testKey();
  }, [loadSettings]);

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

  const weightTotal = Object.values(scoring.data).reduce((a, b) => a + b, 0);
  const weightBalanced = Math.abs(weightTotal - 100) <= 1;

  const statusIcon = keyTest?.status === 'ok'
    ? <CheckCircle className="w-5 h-5" style={stTextSecondary} />
    : keyTest?.status === 'credits_issue'
    ? <AlertTriangle className="w-5 h-5" style={stTextTertiary} />
    : <XCircle className="w-5 h-5" style={stTextPrimary} />;

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
          <p style={{ ...stTextMuted, ...stFontSm, marginTop: 'var(--space-1)' }}>Loading configuration...</p>
        </div>
        <div className="flex items-center gap-3" style={stTextMuted}>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span style={stFontSm}>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl page-content">
      <div>
        <h1 className="page-title" style={{ fontSize: 'var(--font-size-xl)' }}>Settings</h1>
        <p style={{ ...stTextMuted, ...stFontSm, marginTop: 'var(--space-1)' }}>Raise configuration, scoring weights, follow-up cadence, and API diagnostics</p>
      </div>

      {/* ================================================================= */}
      {/* 1. RAISE PARAMETERS                                               */}
      {/* ================================================================= */}
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5" style={stTextTertiary} />
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 400, color: 'var(--text-primary)' }}>Raise Parameters</h2>
          </div>
          <div className="flex items-center gap-2">
            {raise.dirty && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)', fontWeight: 400 }}>Unsaved changes</span>
            )}
            <button
              onClick={() => raise.save()}
              disabled={raise.saving || !raise.dirty}
              className={`btn btn-md ${raise.dirty ? 'btn-primary' : 'btn-secondary'}`}>
              <Save className={`w-3.5 h-3.5 ${raise.saving ? 'animate-spin' : ''}`} />
              {raise.saving ? 'Saving...' : raise.dirty ? 'Save Changes' : 'Saved'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Company Name */}
          <div className="md:col-span-2">
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>Company Name</label>
            <input
              type="text"
              value={raise.data.company_name}
              onChange={e => raise.update('company_name', e.target.value)}
              placeholder="e.g. Aerospacelab"
              className="input" />
          </div>

          {/* Round Type */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>Round Type</label>
            <div className="relative">
              <select
                value={raise.data.round_type}
                onChange={e => raise.update('round_type', e.target.value)}
                className="input"
                style={{ appearance: 'none', cursor: 'pointer' }}>
                {ROUND_TYPES.map(rt => (
                  <option key={rt} value={rt}>{rt}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={stTextMuted}
                />
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>Currency</label>
            <div className="relative">
              <select
                value={raise.data.currency}
                onChange={e => raise.update('currency', e.target.value)}
                className="input"
                style={{ appearance: 'none', cursor: 'pointer' }}>
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={stTextMuted}
                />
            </div>
          </div>

          {/* Target Equity Raise */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3 h-3" />
                Target Equity Raise
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={raise.data.equity_amount || ''}
                onChange={e => raise.update('equity_amount', Number(e.target.value))}
                placeholder="250000000"
                className="input" />
              {raise.data.equity_amount > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ ...stFontXs, ...stTextMuted }}>
                  {formatCompact(raise.data.equity_amount, raise.data.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Target Debt Raise */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3 h-3" />
                Target Debt Raise
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={raise.data.debt_amount || ''}
                onChange={e => raise.update('debt_amount', Number(e.target.value))}
                placeholder="250000000"
                className="input" />
              {raise.data.debt_amount > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ ...stFontXs, ...stTextMuted }}>
                  {formatCompact(raise.data.debt_amount, raise.data.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Pre-money Valuation */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>
              <span className="flex items-center gap-1.5">
                <Target className="w-3 h-3" />
                Pre-money Valuation
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={raise.data.pre_money || ''}
                onChange={e => raise.update('pre_money', Number(e.target.value))}
                placeholder="2000000000"
                className="input" />
              {raise.data.pre_money > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ ...stFontXs, ...stTextMuted }}>
                  {formatCompact(raise.data.pre_money, raise.data.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Post-money (computed) */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>
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
              {raise.data.pre_money && raise.data.equity_amount
                ? formatCompact(raise.data.pre_money + raise.data.equity_amount, raise.data.currency)
                : '—'}
            </div>
          </div>

          {/* Target Close Date */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                Target Close Date
              </span>
            </label>
            <input
              type="date"
              value={raise.data.target_close}
              onChange={e => raise.update('target_close', e.target.value)}
              className="input [color-scheme:dark]" />
          </div>

          {/* Target Investor Count */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>
              <span className="flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                Target Investor Count
              </span>
            </label>
            <input
              type="number"
              value={raise.data.target_investor_count || ''}
              onChange={e => raise.update('target_investor_count', Number(e.target.value))}
              placeholder="5"
              min={0}
              className="input" />
          </div>

          {/* Minimum Check Size */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>
              Minimum Check Size
            </label>
            <div className="relative">
              <input
                type="number"
                value={raise.data.minimum_check_size || ''}
                onChange={e => raise.update('minimum_check_size', Number(e.target.value))}
                placeholder="25000000"
                className="input" />
              {raise.data.minimum_check_size > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ ...stFontXs, ...stTextMuted }}>
                  {formatCompact(raise.data.minimum_check_size, raise.data.currency)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Summary row */}
        {raise.data.equity_amount > 0 && raise.data.pre_money > 0 && (
          <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="grid grid-cols-3 gap-4" style={{ textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.125rem' }}>Total Raise</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  {formatCompact(raise.data.equity_amount + raise.data.debt_amount, raise.data.currency)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.125rem' }}>Dilution</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  {((raise.data.equity_amount / (raise.data.pre_money + raise.data.equity_amount)) * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.125rem' }}>Post-money EV</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  {formatCompact(raise.data.pre_money + raise.data.equity_amount, raise.data.currency)}
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
            <Sliders className="w-5 h-5" style={stTextTertiary} />
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 400, color: 'var(--text-primary)' }}>Scoring Weights</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                scoring.replace({ ...DEFAULT_SCORING_WEIGHTS }); }}
              className="btn btn-sm btn-ghost">
              <RotateCcw className="w-3 h-3" />
              Reset to Defaults
            </button>
            <div className="flex items-center gap-2">
              {scoring.dirty && (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)', fontWeight: 400 }}>Unsaved changes</span>
              )}
              <button
                onClick={() => scoring.save(() => {
                  const total = Object.values(scoring.data).reduce((a, b) => a + b, 0);
                  if (Math.abs(total - 100) > 1) {
                    toast(`Weights must sum to 100% (currently ${total}%)`, 'warning');
                    return false;
                  }
                  return true;
                })}
                disabled={scoring.saving || !scoring.dirty}
                className={`btn btn-md ${scoring.dirty ? 'btn-primary' : 'btn-secondary'}`}>
                <Save className={`w-3.5 h-3.5 ${scoring.saving ? 'animate-spin' : ''}`} />
                {scoring.saving ? 'Saving...' : scoring.dirty ? 'Save Changes' : 'Saved'}
              </button>
            </div>
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
                value={scoring.data[key]}
                onChange={e => scoring.update(key, Number(e.target.value))}
                className="flex-1 h-1.5 cursor-pointer"
                style={{ accentColor: 'var(--accent)' }} />
              <div className="w-14" style={{ textAlign: 'right' }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={scoring.data[key]}
                  onChange={e => scoring.update(key, Number(e.target.value))}
                  className="input"
                  style={{ width: '3.5rem', padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-xs)', textAlign: 'right' }} />
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
            <Clock className="w-5 h-5" style={stTextTertiary} />
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 400, color: 'var(--text-primary)' }}>Follow-up Cadence</h2>
          </div>
          <div className="flex items-center gap-2">
            {followup.dirty && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)', fontWeight: 400 }}>Unsaved changes</span>
            )}
            <button
              onClick={() => followup.save()}
              disabled={followup.saving || !followup.dirty}
              className={`btn btn-md ${followup.dirty ? 'btn-primary' : 'btn-secondary'}`}>
              <Save className={`w-3.5 h-3.5 ${followup.saving ? 'animate-spin' : ''}`} />
              {followup.saving ? 'Saving...' : followup.dirty ? 'Save Changes' : 'Saved'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Thank You Delay */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>Thank You Email Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followup.data.thank_you_delay_hours}
                onChange={e => followup.update('thank_you_delay_hours', Number(e.target.value))}
                min={0}
                max={72}
                className="input flex-1" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: '3rem' }}>hours</span>
            </div>
          </div>

          {/* Objection Response Delay */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>Objection Response Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followup.data.objection_response_delay_hours}
                onChange={e => followup.update('objection_response_delay_hours', Number(e.target.value))}
                min={0}
                max={168}
                className="input flex-1" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: '3rem' }}>hours</span>
            </div>
          </div>

          {/* Schedule Next Meeting Delay */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>Schedule Next Meeting Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followup.data.schedule_next_meeting_delay_hours}
                onChange={e => followup.update('schedule_next_meeting_delay_hours', Number(e.target.value))}
                min={0}
                max={168}
                className="input flex-1" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: '3rem' }}>hours</span>
            </div>
          </div>

          {/* Re-engagement Delay */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>Re-engagement Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followup.data.reengagement_delay_days}
                onChange={e => followup.update('reengagement_delay_days', Number(e.target.value))}
                min={1}
                max={30}
                className="input flex-1" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: '3rem' }}>days</span>
            </div>
          </div>

          {/* Escalation Delay */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>Escalation Delay</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followup.data.escalation_delay_days}
                onChange={e => followup.update('escalation_delay_days', Number(e.target.value))}
                min={1}
                max={60}
                className="input flex-1" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: '3rem' }}>days</span>
            </div>
          </div>

          {/* Tier 1 Speed Multiplier */}
          <div>
            <label className="block" style={{ ...stFontXs, fontWeight: 400, ...stTextTertiary, marginBottom: '0.375rem' }}>Tier 1 Speed Multiplier</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={followup.data.tier1_speed_multiplier}
                onChange={e => followup.update('tier1_speed_multiplier', Number(e.target.value))}
                min={25}
                max={100}
                className="input flex-1" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: '3rem' }}>%</span>
            </div>
            <p style={{ ...stFontXs, ...stTextMuted, marginTop: 'var(--space-1)' }}>
              {followup.data.tier1_speed_multiplier}% means Tier 1 investors get follow-ups {100 - followup.data.tier1_speed_multiplier}% faster
            </p>
          </div>
        </div>

        {/* Cadence summary */}
        <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Effective Tier 1 cadence:</p>
          <div className="grid grid-cols-3 gap-3" style={{ textAlign: 'center' }}>
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
              <div style={{ ...stFontXs, ...stTextMuted }}>Thank you</div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                {Math.round(followup.data.thank_you_delay_hours * followup.data.tier1_speed_multiplier / 100)}h
              </div>
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
              <div style={{ ...stFontXs, ...stTextMuted }}>Objection</div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                {Math.round(followup.data.objection_response_delay_hours * followup.data.tier1_speed_multiplier / 100)}h
              </div>
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
              <div style={{ ...stFontXs, ...stTextMuted }}>Re-engage</div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                {Math.round(followup.data.reengagement_delay_days * followup.data.tier1_speed_multiplier / 100)}d
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
            <Key className="w-5 h-5" style={stTextTertiary} />
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 400, color: 'var(--text-primary)' }}>Anthropic API Key</h2>
          </div>
          <button
            onClick={testKey}
            disabled={testing}
            className="btn btn-sm btn-secondary"
            style={{ opacity: testing ? 0.5 : 1 }}>
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
              <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }} className="space-y-2">
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
          <Settings2 className="w-5 h-5" style={stTextTertiary} />
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-tertiary)' }}>IMPORTANT: Claude.ai vs API Credits</h3>
        </div>
        <div className="space-y-2" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
          <p>Anthropic has <strong style={stTextSecondary}>two separate billing systems</strong>:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong style={stTextSecondary}>claude.ai</strong> --- subscription credits for the chatbot (Claude Pro/Team)</li>
            <li><strong style={stTextSecondary}>console.anthropic.com</strong> --- API credits for programmatic access (what this app uses)</li>
          </ul>
          <p>Credits on claude.ai do <strong style={stTextPrimary}>NOT</strong> apply to API usage. You need credits specifically on <strong style={stTextSecondary}>console.anthropic.com/settings/billing</strong>.</p>
          <p style={{ marginTop: 'var(--space-3)' }}>If the test above shows a credits issue:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Go to <strong style={stTextSecondary}>console.anthropic.com/settings/billing</strong></li>
            <li>Click <strong style={stTextSecondary}>&ldquo;Add to credit balance&rdquo;</strong> (minimum $5)</li>
            <li>Then go to <strong style={stTextSecondary}>console.anthropic.com/settings/keys</strong></li>
            <li>Create a <strong style={stTextSecondary}>new API key</strong></li>
            <li>Update it in your <strong style={stTextSecondary}>Vercel environment variables</strong></li>
            <li><strong style={stTextSecondary}>Redeploy</strong> the app</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
