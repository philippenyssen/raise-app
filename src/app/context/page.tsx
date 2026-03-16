'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import { cachedFetch } from '@/lib/cache';
import {
  BookOpen, CheckCircle2, AlertCircle, ChevronDown, ChevronRight,
  Wand2, Loader2, Upload, FileText, Sparkles, Search, Download,
  Users, ArrowRight, Zap, AlertTriangle, MessageSquare,
} from 'lucide-react';
import { labelMuted, stTextMuted, stTextPrimary } from '@/lib/styles';

const InterviewChat = dynamic(() => import('@/components/context/interview-chat').then(m => ({ default: m.InterviewChat })), { ssr: false });

interface ContextField {
  key: string;
  label: string;
  multiline?: boolean;
}

interface ContextCategory {
  id: string;
  label: string;
  fields: ContextField[];
}

interface CompletenessCategory {
  id: string;
  label: string;
  filled: number;
  total: number;
  hasFiles: boolean;
}

interface ContextData {
  context: Record<string, string>;
  completeness: {
    categories: CompletenessCategory[];
    overall: number;
    totalFields: number;
    filledFields: number;
  };
  categories: ContextCategory[];
  dataRoomFileCount: number;
}

interface InvestorOption {
  id: string;
  name: string;
  type: string;
  tier: number;
}

interface GapAnalysis {
  readiness_score: number;
  readiness_label: string;
  summary: string;
  critical_gaps: { field: string; label: string; priority: string; question: string; why: string }[];
  suggestions: string[];
  data_room_gaps: string[];
}

const cardPad = { padding: 'var(--space-4)' } as const;
const sectionTitle = { fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-muted)', letterSpacing: '0.02em', marginBottom: 'var(--space-2)' } as const;
const inputBase: React.CSSProperties = { width: '100%', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-1)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', fontFamily: 'inherit', fontWeight: 300 };
const textareaBase: React.CSSProperties = { ...inputBase, resize: 'vertical', minHeight: '80px', fontFamily: 'var(--font-mono), monospace', fontSize: 'var(--font-size-xs)', lineHeight: 1.6 };
const progressBarBg: React.CSSProperties = { height: '6px', borderRadius: '3px', background: 'var(--surface-2)', overflow: 'hidden' };
const genBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 400 };
const selectBase: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-1)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', fontWeight: 300 };

export default function ContextPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [investors, setInvestors] = useState<InvestorOption[]>([]);
  const [selectedInvestor, setSelectedInvestor] = useState<string>('');
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [analyzingGaps, setAnalyzingGaps] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await cachedFetch('/api/context');
      if (!res.ok) throw new Error('Failed');
      const d: ContextData = await res.json();
      setData(d);
      setEditedFields(d.context);
    } catch (e) {
      console.warn('[CONTEXT_FETCH]', e instanceof Error ? e.message : e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { document.title = 'Raise | Context'; }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch investors for adaptive generation
  useEffect(() => {
    cachedFetch('/api/investors').then(async res => {
      if (res.ok) {
        const all = await res.json();
        setInvestors(all.map((inv: InvestorOption) => ({ id: inv.id, name: inv.name, type: inv.type, tier: inv.tier })));
      }
    }).catch(() => {});
  }, []);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setEditedFields(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/context', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: editedFields }),
      });
      if (!res.ok) throw new Error('Save failed');
      const result = await res.json();
      if (data) {
        setData({ ...data, completeness: result.completeness, context: { ...editedFields } });
      }
      setDirty(false);
      toast('Context saved');
    } catch (e) {
      console.warn('[CONTEXT_SAVE]', e instanceof Error ? e.message : e);
      toast('Failed to save context', 'error');
    } finally {
      setSaving(false);
    }
  }, [editedFields, data, toast]);

  const handleGenerate = useCallback(async (type: string) => {
    if (dirty) await handleSave();
    setGenerating(type);
    try {
      const body: Record<string, string> = { type };
      if (selectedInvestor) body.investor_id = selectedInvestor;
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.error) {
        toast(result.error, 'error');
      } else {
        const investorName = selectedInvestor ? investors.find(i => i.id === selectedInvestor)?.name : null;
        toast(`Generated ${type.replace(/_/g, ' ')}${investorName ? ` (adapted for ${investorName})` : ''} — open Workspace to review`);
      }
    } catch (e) {
      console.warn('[CONTEXT_GENERATE]', e instanceof Error ? e.message : e);
      toast('Generation failed', 'error');
    } finally {
      setGenerating(null);
    }
  }, [dirty, handleSave, toast, selectedInvestor, investors]);

  const handleGenerateAll = useCallback(async () => {
    if (dirty) await handleSave();
    const types = ['teaser', 'exec_summary', 'memo', 'deck'];
    for (const type of types) {
      setGenerating(type);
      try {
        const body: Record<string, string> = { type };
        if (selectedInvestor) body.investor_id = selectedInvestor;
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const result = await res.json();
        if (result.error) {
          toast(`${type}: ${result.error}`, 'error');
          break;
        }
        toast(`Generated ${type.replace(/_/g, ' ')}`);
      } catch {
        toast(`Failed to generate ${type}`, 'error');
        break;
      }
    }
    setGenerating(null);
    toast('All deliverables generated — open Workspace to review');
  }, [dirty, handleSave, toast, selectedInvestor]);

  const handleInterviewFields = useCallback((fields: Record<string, string>) => {
    setEditedFields(prev => {
      const merged = { ...prev };
      for (const [key, value] of Object.entries(fields)) {
        if (typeof value === 'string' && value.trim()) {
          merged[key] = value;
        }
      }
      return merged;
    });
    setDirty(true);
  }, []);

  const handleAnalyzeGaps = useCallback(async () => {
    if (dirty) await handleSave();
    setAnalyzingGaps(true);
    try {
      const res = await fetch('/api/context/analyze', { method: 'POST' });
      if (!res.ok) throw new Error('Analysis failed');
      const result = await res.json();
      if (result.error) {
        toast(result.error, 'error');
      } else {
        setGapAnalysis(result);
      }
    } catch (e) {
      console.warn('[CONTEXT_ANALYZE]', e instanceof Error ? e.message : e);
      toast('Gap analysis failed', 'error');
    } finally {
      setAnalyzingGaps(false);
    }
  }, [dirty, handleSave, toast]);

  const handleExtractFromDataRoom = useCallback(async () => {
    if (dirty) await handleSave();
    setExtracting(true);
    try {
      const res = await fetch('/api/context/extract', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error || 'Extraction failed', 'error');
        return;
      }
      const result = await res.json();
      if (result.totalExtracted === 0) {
        toast('No new information found in data room files', 'warning');
        return;
      }
      // Merge extracted fields into current context
      setEditedFields(prev => {
        const merged = { ...prev };
        for (const [key, value] of Object.entries(result.extracted)) {
          if (typeof value === 'string') {
            merged[key] = value;
          }
        }
        return merged;
      });
      setDirty(true);
      toast(`Extracted ${result.newFields} new fields and updated ${result.updatedFields} from ${result.sourceFiles} files — review and save`);
    } catch (e) {
      console.warn('[CONTEXT_EXTRACT]', e instanceof Error ? e.message : e);
      toast('Extraction failed', 'error');
    } finally {
      setExtracting(false);
    }
  }, [dirty, handleSave, toast]);

  // Auto-save on Cmd+S
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handleSave]);

  if (loading || !data) {
    return (
      <div className="space-y-4 page-content">
        <div className="skeleton" style={{ height: '28px', width: '200px' }} />
        <div className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: '60px', borderRadius: 'var(--radius-md)' }} />
        ))}
      </div>
    );
  }

  const { completeness, categories, dataRoomFileCount } = data;
  const pctColor = completeness.overall >= 75 ? 'var(--success)' : completeness.overall >= 40 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="max-w-4xl space-y-6 page-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title" style={{ fontSize: 'var(--font-size-xl)' }}>Company Context</h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
            Everything the AI needs to generate your fundraising materials
          </p>
        </div>
        <div className="flex gap-2">
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary btn-md"
              style={{ opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Save Context'}
            </button>
          )}
        </div>
      </div>

      {/* Completeness Overview */}
      <div className="card" style={cardPad}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span style={{ color: pctColor }}>
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 400, color: 'var(--text-primary)' }}>
                {completeness.overall}% complete
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {completeness.filledFields} of {completeness.totalFields} fields filled · {dataRoomFileCount} files in data room
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExtractFromDataRoom}
              disabled={extracting || dataRoomFileCount === 0}
              className="btn btn-secondary btn-sm flex items-center gap-2"
              style={{ opacity: extracting || dataRoomFileCount === 0 ? 0.5 : 1 }}
              title={dataRoomFileCount === 0 ? 'Upload files to data room first' : 'AI will extract context from your data room files'}>
              {extracting ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting...</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> Extract from Data Room</>
              )}
            </button>
            <Link href="/data-room" className="btn btn-secondary btn-sm flex items-center gap-2" style={{ textDecoration: 'none' }}>
              <Upload className="w-3.5 h-3.5" /> Upload Files
            </Link>
          </div>
        </div>

        {/* Overall progress bar */}
        <div style={progressBarBg}>
          <div style={{
            height: '100%',
            width: `${completeness.overall}%`,
            background: pctColor,
            borderRadius: '3px',
            transition: 'width 300ms ease',
          }} />
        </div>

        {/* Category breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginTop: 'var(--space-4)' }}>
          {completeness.categories.map(cat => {
            const pct = cat.total > 0 ? Math.round((cat.filled / cat.total) * 100) : 0;
            const color = pct >= 75 ? 'var(--success)' : pct >= 25 ? 'var(--warning)' : 'var(--text-muted)';
            return (
              <button
                key={cat.id}
                onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                className="text-left rounded-lg transition-colors"
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  background: expandedCategory === cat.id ? 'var(--surface-2)' : 'var(--surface-1)',
                  border: `1px solid ${expandedCategory === cat.id ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { if (expandedCategory !== cat.id) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
                onMouseLeave={e => { if (expandedCategory !== cat.id) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{cat.label}</span>
                  {pct === 100 ? (
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
                  ) : pct === 0 ? (
                    <AlertCircle className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  ) : null}
                </div>
                <div style={{ ...progressBarBg, height: '3px' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {cat.filled}/{cat.total} fields
                  {cat.hasFiles && <span style={{ marginLeft: 'var(--space-1)', color: 'var(--success)' }}>+ files</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Interview */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <button
          onClick={() => setInterviewOpen(!interviewOpen)}
          className="w-full flex items-center justify-between"
          style={{ ...cardPad, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--accent)' }}><MessageSquare className="w-4 h-4" /></span>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, ...stTextPrimary }}>AI Interview</span>
            <span style={labelMuted}>fill context through conversation instead of forms</span>
          </div>
          <div className="flex items-center gap-2">
            {interviewOpen ? (
              <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            ) : (
              <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            )}
          </div>
        </button>
        {interviewOpen && (
          <div style={{ height: '480px', borderTop: '1px solid var(--border-subtle)' }}>
            <InterviewChat
              onFieldsExtracted={handleInterviewFields}
              completionPct={completeness.overall}
            />
          </div>
        )}
      </div>

      {/* AI Gap Analysis */}
      <div className="card" style={cardPad}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={stTextMuted}><Search className="w-4 h-4" /></span>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, ...stTextPrimary }}>Gap Analysis</span>
            <span style={labelMuted}>AI identifies what investors will ask for</span>
          </div>
          <button
            onClick={handleAnalyzeGaps}
            disabled={analyzingGaps}
            className="btn btn-secondary btn-sm flex items-center gap-2"
            style={{ opacity: analyzingGaps ? 0.5 : 1 }}>
            {analyzingGaps ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
            ) : (
              <><Zap className="w-3.5 h-3.5" /> Analyze Readiness</>
            )}
          </button>
        </div>

        {gapAnalysis && (
          <div className="space-y-4">
            {/* Readiness score */}
            <div className="flex items-center gap-4" style={{ padding: 'var(--space-3)', background: 'var(--surface-1)', borderRadius: 'var(--radius-md)' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--font-size-lg)', fontWeight: 400,
                background: gapAnalysis.readiness_score >= 7 ? 'var(--success-muted)' : gapAnalysis.readiness_score >= 4 ? 'var(--warning-muted)' : 'color-mix(in srgb, var(--danger) 15%, transparent)',
                color: gapAnalysis.readiness_score >= 7 ? 'var(--success)' : gapAnalysis.readiness_score >= 4 ? 'var(--warning)' : 'var(--danger)',
              }}>
                {gapAnalysis.readiness_score}
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>
                  {gapAnalysis.readiness_label}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {gapAnalysis.summary}
                </div>
              </div>
            </div>

            {/* Critical gaps */}
            {gapAnalysis.critical_gaps.length > 0 && (
              <div>
                <div style={sectionTitle}>Critical Gaps</div>
                <div className="space-y-2">
                  {gapAnalysis.critical_gaps.map((gap, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        // Find which category contains this field and expand it
                        const cat = categories.find(c => c.fields.some(f => f.key === gap.field));
                        if (cat) setExpandedCategory(cat.id);
                        // Scroll to field
                        setTimeout(() => {
                          const el = document.getElementById(`field-${gap.field}`);
                          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
                        }, 200);
                      }}
                      className="w-full text-left flex items-start gap-3 rounded-lg"
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                    >
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: gap.priority === 'critical' ? 'color-mix(in srgb, var(--danger) 15%, transparent)' : gap.priority === 'high' ? 'var(--warning-muted)' : 'var(--surface-2)',
                        color: gap.priority === 'critical' ? 'var(--danger)' : gap.priority === 'high' ? 'var(--warning)' : 'var(--text-muted)',
                        flexShrink: 0,
                      }}>
                        {gap.priority}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                          {gap.question}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {gap.label} — {gap.why}
                        </div>
                      </div>
                      <span style={stTextMuted}><ArrowRight className="w-3.5 h-3.5 shrink-0" /></span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions + Data room gaps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gapAnalysis.suggestions.length > 0 && (
                <div>
                  <div style={sectionTitle}>Suggestions</div>
                  <ul className="space-y-1">
                    {gapAnalysis.suggestions.map((s, i) => (
                      <li key={i} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', paddingLeft: 'var(--space-2)' }}>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {gapAnalysis.data_room_gaps.length > 0 && (
                <div>
                  <div style={sectionTitle}>Missing Data Room Documents</div>
                  <ul className="space-y-1">
                    {gapAnalysis.data_room_gaps.map((g, i) => (
                      <li key={i} className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--warning)' }}><AlertTriangle className="w-3 h-3" /></span>
                        {g}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/data-room"
                    className="flex items-center gap-1 mt-2"
                    style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)', textDecoration: 'none' }}>
                    Upload to Data Room <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Generate Deliverables */}
      <div className="card" style={cardPad}>
        <div className="flex items-center gap-2 mb-3">
          <span style={stTextMuted}><Wand2 className="w-4 h-4" /></span>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, ...stTextPrimary }}>Generate Deliverables</span>
          <span style={labelMuted}>from your context + data room files</span>
        </div>

        {/* Investor selector for adaptive generation */}
        {investors.length > 0 && (
          <div className="flex items-center gap-3 mb-3" style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-1)', borderRadius: 'var(--radius-md)' }}>
            <span style={stTextMuted}><Users className="w-3.5 h-3.5" /></span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Adapt for:</span>
            <select
              value={selectedInvestor}
              onChange={e => setSelectedInvestor(e.target.value)}
              style={{ ...selectBase, flex: 1 }}>
              <option value="">All investors (generic)</option>
              {investors
                .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
                .map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name} ({inv.type}, Tier {inv.tier})
                  </option>
                ))}
            </select>
            {selectedInvestor && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
                Documents will be adapted to this investor&apos;s thesis and style
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerateAll}
            disabled={generating !== null}
            style={{
              ...genBtn,
              background: generating ? 'var(--surface-2)' : 'var(--accent)',
              color: generating ? 'var(--text-muted)' : 'var(--surface-0)',
            }}>
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating {generating.replace(/_/g, ' ')}...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate All</>
            )}
          </button>
          {['teaser', 'exec_summary', 'memo', 'deck', 'dd_memo'].map(type => (
            <button
              key={type}
              onClick={() => handleGenerate(type)}
              disabled={generating !== null}
              style={{
                ...genBtn,
                background: 'var(--surface-1)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                opacity: generating ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!generating) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
            >
              <FileText className="w-3.5 h-3.5" />
              {type === 'teaser' ? 'Teaser' : type === 'exec_summary' ? 'Exec Summary' : type === 'memo' ? 'Memo' : type === 'deck' ? 'Deck' : 'DD Memo'}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
          Generated documents appear in <Link href="/workspace" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Workspace</Link> where you can edit and refine them.
        </p>
      </div>

      {/* Context Categories (expandable sections) */}
      {categories.map(cat => {
        const isExpanded = expandedCategory === cat.id;
        const catCompleteness = completeness.categories.find(c => c.id === cat.id);
        const filledCount = catCompleteness?.filled || 0;
        const totalCount = catCompleteness?.total || cat.fields.length;

        return (
          <div key={cat.id} className="card" style={{ overflow: 'hidden' }}>
            <button
              onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
              className="w-full flex items-center justify-between"
              style={{
                ...cardPad,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}>
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 shrink-0" style={stTextMuted} />
                ) : (
                  <ChevronRight className="w-4 h-4 shrink-0" style={stTextMuted} />
                )}
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, ...stTextPrimary }}>{cat.label}</span>
                <span style={labelMuted}>{filledCount}/{totalCount}</span>
              </div>
              <div className="flex items-center gap-2">
                {filledCount === totalCount && totalCount > 0 && (
                  <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--success)' }} />
                )}
                {filledCount === 0 && (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--warning)', background: 'var(--warning-muted)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                    Missing
                  </span>
                )}
              </div>
            </button>

            {isExpanded && (
              <div style={{
                padding: '0 var(--space-4) var(--space-4)',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 'var(--space-4)',
              }}>
                <div className="space-y-4">
                  {cat.fields.map(field => (
                    <div key={field.key}>
                      <label
                        htmlFor={`field-${field.key}`}
                        style={{ ...sectionTitle, display: 'block' }}>
                        {field.label}
                        {!editedFields[field.key]?.trim() && (
                          <span style={{ color: 'var(--warning)', marginLeft: 'var(--space-1)' }}>*</span>
                        )}
                      </label>
                      {field.multiline ? (
                        <textarea
                          id={`field-${field.key}`}
                          value={editedFields[field.key] || ''}
                          onChange={e => handleFieldChange(field.key, e.target.value)}
                          style={textareaBase}
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                          rows={4}
                        />
                      ) : (
                        <input
                          id={`field-${field.key}`}
                          type="text"
                          value={editedFields[field.key] || ''}
                          onChange={e => handleFieldChange(field.key, e.target.value)}
                          style={inputBase}
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Additional Context (free-form) */}
      <div className="card" style={cardPad}>
        <div style={sectionTitle}>Additional Context</div>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
          Paste any additional information not covered above — meeting notes, strategic memos, board minutes, etc.
          The AI will use everything here when generating documents.
        </p>
        <textarea
          value={editedFields.additional_context || ''}
          onChange={e => handleFieldChange('additional_context', e.target.value)}
          style={{ ...textareaBase, minHeight: '160px' }}
          placeholder="Paste additional context here..."
        />
      </div>

      {/* Save bar (sticky at bottom when dirty) */}
      {dirty && (
        <div
          className="sticky bottom-4 flex items-center justify-between rounded-lg"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
          }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            Unsaved changes
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary btn-md">
            {saving ? 'Saving...' : 'Save Context (⌘S)'}
          </button>
        </div>
      )}
    </div>
  );
}
