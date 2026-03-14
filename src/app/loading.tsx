export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-6" style={{ maxWidth: 1200 }}>
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div className="skeleton" style={{ width: 180, height: 24 }} />
        <div className="skeleton" style={{ width: 100, height: 32, borderRadius: 'var(--radius-md)' }} />
      </div>

      {/* Metric strip — 4 boxes */}
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="card flex flex-col gap-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
            <div className="skeleton" style={{ width: 80, height: 11 }} />
            <div className="skeleton" style={{ width: 64, height: 28 }} />
            <div className="skeleton" style={{ width: 100, height: 12 }} />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {/* Table header */}
        <div className="flex gap-4 p-4" style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--surface-1)' }}>
          {[100, 140, 80, 120, 80, 60].map((w, i) => (
            <div key={i} className="skeleton" style={{ width: w, height: 11 }} />
          ))}
        </div>
        {/* Table rows */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4 p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {[100, 140, 80, 120, 80, 60].map((w, j) => (
              <div key={j} className="skeleton" style={{ width: w, height: 14 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
