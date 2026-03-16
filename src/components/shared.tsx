import React from 'react';

export function TierBadge({ tier }: { tier: number }) {
  const tierClass = tier <= 3 ? `tier-badge tier-${tier}` : 'tier-badge tier-3';
  return (
    <span className={tierClass}>
      {tier}
    </span>);
}

const DOTS = [1, 2, 3, 4, 5] as const;
function dotColorSm(v: number): string { return v >= 4 ? 'var(--success)' : v >= 3 ? 'var(--accent)' : 'var(--text-muted)'; }
function dotColorMd(v: number): string { return v >= 4 ? 'var(--success)' : v >= 3 ? 'var(--warning)' : 'var(--danger)'; }

export function EnthusiasmDots({ value, score, size = 'md' }: { value?: number; score?: number; size?: 'sm' | 'md' }) {
  const v = value ?? score ?? 0;
  if (size === 'sm') {
    const active = dotColorSm(v);
    return (
      <div className="flex gap-0.5">
        {DOTS.map(n => (
          <div key={n} className="w-1 h-1 rounded-full" style={{ background: n <= v ? active : 'var(--surface-2)' }}/>
        ))}
      </div>);
  }
  const active = dotColorMd(v);
  return (
    <div className="enthusiasm-dots">
      {DOTS.map(i => (
        <div key={i} className="enthusiasm-dot" style={{ background: i <= v ? active : 'var(--border-default)' }} />
      ))}
    </div>);
}
