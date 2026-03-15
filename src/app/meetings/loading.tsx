export default function MeetingsLoading() {
  return (
    <div className="flex flex-col gap-4 p-6" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="skeleton" style={{ width: 120, height: 24 }} />
        <div className="skeleton" style={{ width: 130, height: 36, borderRadius: 'var(--radius-md)' }} />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="skeleton" style={{ width: 220, height: 36, borderRadius: 'var(--radius-md)' }} />
        {[80, 96, 72].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: 32, borderRadius: 9999 }} />
        ))}
      </div>

      {/* Meeting list items */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card flex items-start gap-4" style={{ background: 'var(--surface-1)', padding: 'var(--space-4)' }}>
            {/* Date column */}
            <div className="flex flex-col items-center gap-1" style={{ minWidth: 48 }}>
              <div className="skeleton" style={{ width: 32, height: 11 }} />
              <div className="skeleton" style={{ width: 24, height: 20 }} />
              <div className="skeleton" style={{ width: 40, height: 11 }} />
            </div>
            {/* Content */}
            <div className="flex flex-col gap-2 flex-1">
              <div className="flex items-center gap-2">
                <div className="skeleton" style={{ width: 180, height: 15 }} />
                <div className="skeleton" style={{ width: 64, height: 20, borderRadius: 9999 }} />
              </div>
              <div className="skeleton" style={{ width: '90%', height: 12 }} />
              <div className="skeleton" style={{ width: '60%', height: 12 }} />
              <div className="flex gap-2 mt-1">
                <div className="skeleton" style={{ width: 56, height: 18, borderRadius: 9999 }} />
                <div className="skeleton" style={{ width: 48, height: 18, borderRadius: 9999 }} />
              </div>
            </div>
            {/* Rating dots */}
            <div className="flex gap-1" style={{ minWidth: 80 }}>
              {[0, 1, 2, 3, 4].map(j => (
                <div key={j} className="skeleton" style={{ width: 20, height: 20, borderRadius: '50%' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
