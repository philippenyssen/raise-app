'use client';

import { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';

interface SkillHealth {
  skill_name: string;
  total_executions: number;
  success_rate: number;
  avg_quality: number;
  parse_success_rate: number;
  avg_latency_ms: number;
  last_execution: string;
}

interface SkillExecution {
  id: string;
  skill_name: string;
  skill_type: string;
  version: number;
  trigger_source: string;
  outcome: string;
  output_quality: number;
  parse_success: number;
  latency_ms: number;
  error_message: string;
  fields_extracted: number;
  fields_expected: number;
  user_accepted: number;
  created_at: string;
}

function getHealthColor(rate: number): string {
  if (rate >= 90) return 'var(--success)';
  if (rate >= 70) return 'var(--warning)';
  return 'var(--danger)';
}

function getHealthBg(rate: number): string {
  if (rate >= 90) return 'var(--success-muted)';
  if (rate >= 70) return 'var(--warning-muted)';
  return 'var(--danger-muted)';
}

export default function SkillsPage() {
  const [health, setHealth] = useState<SkillHealth[]>([]);
  const [executions, setExecutions] = useState<SkillExecution[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/skills?view=health').then(r => r.json()),
      fetch('/api/skills?view=executions&limit=100').then(r => r.json()),
    ])
      .then(([h, e]) => {
        setHealth(Array.isArray(h) ? h : []);
        setExecutions(Array.isArray(e) ? e : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const overallSuccessRate = health.length > 0
    ? Math.round(health.reduce((s, h) => s + h.success_rate, 0) / health.length)
    : 0;
  const totalExecutions = health.reduce((s, h) => s + h.total_executions, 0);
  const avgParseRate = health.length > 0
    ? Math.round(health.reduce((s, h) => s + h.parse_success_rate, 0) / health.length)
    : 0;

  if (loading) return <div className="animate-pulse" style={{ color: 'var(--text-muted)' }}>Loading skill health...</div>;

  return (
    <div className="space-y-6 page-content">
      <div>
        <h1 className="page-title">Skill Health</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Monitor and evolve product AI skills — observe, inspect, amend, evaluate
        </p>
      </div>

      {/* Overview metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Active Skills</div>
          <div className="text-2xl font-normal mt-1" style={{ color: 'var(--text-primary)' }}>{health.length}</div>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Executions</div>
          <div className="text-2xl font-normal mt-1" style={{ color: 'var(--text-primary)' }}>{totalExecutions}</div>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Success Rate</div>
          <div className="text-2xl font-normal mt-1" style={{ color: getHealthColor(overallSuccessRate) }}>
            {overallSuccessRate}%
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Parse Success</div>
          <div className="text-2xl font-normal mt-1" style={{ color: getHealthColor(avgParseRate) }}>
            {avgParseRate}%
          </div>
        </div>
      </div>

      {/* Skill health table */}
      {health.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-tertiary)' }}>
            No skill executions yet. Skills start logging automatically when AI features are used — run a meeting analysis, investor research, or enrichment to begin tracking.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-normal" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.01em' }}>
            Skill Performance
          </div>
          {health.map(skill => {
            const isExpanded = expanded === skill.skill_name;
            const skillExecs = executions.filter(e => e.skill_name === skill.skill_name);
            return (
              <div key={skill.skill_name}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : skill.skill_name)}
                  className="w-full card transition-colors"
                  style={{ padding: 'var(--space-4)', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      }
                      <div>
                        <span className="text-sm font-normal" style={{ color: 'var(--text-primary)' }}>
                          {skill.skill_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                          {skill.total_executions} runs
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        {skill.success_rate >= 90
                          ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                          : skill.success_rate >= 70
                          ? <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                          : <XCircle className="w-3.5 h-3.5" style={{ color: 'var(--text-primary)' }} />
                        }
                        <span
                          className="text-xs font-normal px-2 py-0.5 rounded-full"
                          style={{
                            color: getHealthColor(skill.success_rate),
                            backgroundColor: getHealthBg(skill.success_rate),
                          }}
                        >
                          {skill.success_rate}%
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        parse: {skill.parse_success_rate}%
                      </span>
                    </div>
                  </div>

                  {/* Mini progress bar */}
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-2)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${skill.success_rate}%`,
                        backgroundColor: getHealthColor(skill.success_rate),
                      }}
                    />
                  </div>
                </button>

                {/* Expanded execution history */}
                {isExpanded && skillExecs.length > 0 && (
                  <div className="ml-8 mt-1 space-y-1">
                    {skillExecs.slice(0, 10).map(exec => (
                      <div
                        key={exec.id}
                        className="flex items-center gap-3 py-2 px-3 rounded-lg text-xs"
                        style={{ backgroundColor: 'var(--surface-1)' }}
                      >
                        <span style={{
                          color: exec.outcome === 'success' ? 'var(--success)' : exec.outcome === 'partial' ? 'var(--warning)' : 'var(--danger)',
                          fontWeight: 400,
                          minWidth: '50px',
                        }}>
                          {exec.outcome}
                        </span>
                        <span style={{ color: 'var(--text-muted)', minWidth: '80px' }}>
                          {exec.fields_extracted}/{exec.fields_expected} fields
                        </span>
                        <span style={{ color: exec.parse_success ? 'var(--success)' : 'var(--danger)', minWidth: '60px' }}>
                          {exec.parse_success ? 'parsed' : 'parse fail'}
                        </span>
                        <span className="flex-1 truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {exec.trigger_source}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {new Date(exec.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent executions timeline */}
      {executions.length > 0 && (
        <div>
          <div className="text-xs font-normal mb-2" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.01em' }}>
            Recent Executions
          </div>
          <div className="space-y-1">
            {executions.slice(0, 20).map(exec => (
              <div
                key={exec.id}
                className="flex items-center gap-3 py-2 px-4 rounded-lg text-xs"
                style={{ backgroundColor: 'var(--surface-1)' }}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: exec.outcome === 'success' ? 'var(--success)' : exec.outcome === 'partial' ? 'var(--warning)' : 'var(--danger)',
                  }}
                />
                <span className="font-normal" style={{ color: 'var(--text-primary)', minWidth: '140px' }}>
                  {exec.skill_name.replace(/_/g, ' ')}
                </span>
                <span style={{ color: 'var(--text-muted)', minWidth: '60px' }}>v{exec.version}</span>
                <span className="flex-1 truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {exec.error_message || `${exec.fields_extracted}/${exec.fields_expected} fields`}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {new Date(exec.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
