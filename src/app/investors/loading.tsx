export default function InvestorsLoading() {
  return (
    <div className="flex flex-col gap-4 p-6" style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="skeleton" style={{ width: 140, height: 24 }} />
        <div className="skeleton" style={{ width: 120, height: 36, borderRadius: 'var(--radius-md)' }} />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="skeleton" style={{ width: 240, height: 36, borderRadius: 'var(--radius-md)' }} />
        {[72, 64, 56].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: 32, borderRadius: 9999 }} />
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {/* Header row */}
        <div className="flex items-center gap-4 p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div className="skeleton" style={{ width: 16, height: 16, borderRadius: 3 }} />
          {[160, 64, 48, 80, 100, 72, 60].map((w, i) => (
            <div key={i} className="skeleton" style={{ width: w, height: 11 }} />
          ))}
        </div>
        {/* Body rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="skeleton" style={{ width: 16, height: 16, borderRadius: 3 }} />
            <div className="skeleton" style={{ width: 160, height: 14 }} />
            <div className="skeleton" style={{ width: 64, height: 20, borderRadius: 9999 }} />
            <div className="skeleton" style={{ width: 22, height: 22, borderRadius: '50%' }} />
            <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 9999 }} />
            <div className="skeleton" style={{ width: 100, height: 14 }} />
            <div className="skeleton" style={{ width: 72, height: 14 }} />
            <div className="skeleton" style={{ width: 60, height: 4, borderRadius: 2 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
