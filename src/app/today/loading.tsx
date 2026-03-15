export default function TodayLoading() {
  return (
    <div className="flex flex-col gap-6 p-6" style={{ maxWidth: 1200 }}>
      {/* Greeting bar */}
      <div className="flex items-center gap-4">
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)' }} />
        <div className="flex flex-col gap-2">
          <div className="skeleton" style={{ width: 280, height: 20 }} />
          <div className="skeleton" style={{ width: 180, height: 14 }} />
        </div>
      </div>

      {/* Momentum strip */}
      <div className="flex gap-3">
        {[120, 100, 90, 110].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: 32, borderRadius: 9999 }} />
        ))}
      </div>

      {/* 3 action cards */}
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="card flex flex-col gap-3" style={{ background: 'var(--surface-1)' }}>
            <div className="flex items-center gap-2">
              <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)' }} />
              <div className="skeleton" style={{ width: 140, height: 14 }} />
            </div>
            <div className="skeleton" style={{ width: '100%', height: 12 }} />
            <div className="skeleton" style={{ width: '70%', height: 12 }} />
            <div className="skeleton" style={{ width: 80, height: 28, borderRadius: 'var(--radius-md)', marginTop: 4 }} />
          </div>
        ))}
      </div>

      {/* Meetings section */}
      <div className="flex flex-col gap-3">
        <div className="skeleton" style={{ width: 140, height: 16 }} />
        {[0, 1, 2].map(i => (
          <div key={i} className="card flex items-center gap-4" style={{ background: 'var(--surface-1)', padding: 'var(--space-4)' }}>
            <div className="skeleton" style={{ width: 56, height: 32, borderRadius: 'var(--radius-sm)' }} />
            <div className="flex flex-col gap-2 flex-1">
              <div className="skeleton" style={{ width: 200, height: 14 }} />
              <div className="skeleton" style={{ width: 120, height: 12 }} />
            </div>
            <div className="skeleton" style={{ width: 64, height: 24, borderRadius: 9999 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
