import React from 'react';

export function TierBadge({ tier }: { tier: number }) {
  const tierClass = tier <= 3 ? `tier-badge tier-${tier}` : 'tier-badge tier-3';
  return (
    <span className={tierClass}>
      {tier}
    </span>);
}

export function EnthusiasmDots({ value, score, size = 'md' }: { value?: number; score?: number; size?: 'sm' | 'md' }) {
  const v = value ?? score ?? 0;
  if (size === 'sm') {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(n => (
          <div
            key={n}
            className="w-1 h-1 rounded-full"
            style={{
              background: n <= v
                ? v >= 4
                  ? 'var(--success)'
                  : v >= 3
                  ? 'var(--accent)'
                  : 'var(--text-muted)'
                : 'var(--surface-2)',
            }}/>
        ))}
      </div>);
  }
  return (
    <div className="enthusiasm-dots">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className="enthusiasm-dot"
          style={{
            background: i <= v
              ? (v >= 4 ? 'var(--success)' : v >= 3 ? 'var(--warning)' : 'var(--danger)')
              : 'var(--border-default)',
          }} />
      ))}
    </div>);
}
