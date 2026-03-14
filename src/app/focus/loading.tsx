export default function FocusLoading() {
  return (
    <div className="flex flex-col gap-4 p-6" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="skeleton" style={{ width: 160, height: 24 }} />
          <div className="skeleton" style={{ width: 240, height: 13 }} />
        </div>
        <div className="skeleton" style={{ width: 100, height: 32, borderRadius: 'var(--radius-md)' }} />
      </div>

      {/* Budget bar */}
      <div className="flex gap-4 p-4" style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="flex flex-col gap-1 flex-1">
            <div className="skeleton" style={{ width: 80, height: 11 }} />
            <div className="skeleton" style={{ width: 48, height: 20 }} />
          </div>
        ))}
      </div>

      {/* Ranked list with score bars */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4" style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            {/* Rank */}
            <div className="skeleton" style={{ width: 24, height: 24, borderRadius: '50%' }} />
            {/* Investor info */}
            <div className="flex flex-col gap-2" style={{ minWidth: 160 }}>
              <div className="skeleton" style={{ width: 140, height: 14 }} />
              <div className="flex items-center gap-2">
                <div className="skeleton" style={{ width: 48, height: 18, borderRadius: 9999 }} />
                <div className="skeleton" style={{ width: 22, height: 22, borderRadius: '50%' }} />
              </div>
            </div>
            {/* Score bar */}
            <div className="flex flex-col gap-1 flex-1">
              <div className="skeleton" style={{ width: 60, height: 10 }} />
              <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, width: '100%' }}>
                <div className="skeleton" style={{ width: `${85 - i * 8}%`, height: 6, borderRadius: 3 }} />
              </div>
            </div>
            {/* Action */}
            <div className="flex flex-col gap-2 items-end" style={{ minWidth: 140 }}>
              <div className="skeleton" style={{ width: 120, height: 12 }} />
              <div className="skeleton" style={{ width: 64, height: 11 }} />
            </div>
            {/* CTA */}
            <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
