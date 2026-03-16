export default function FollowupsLoading() {
  return (
    <div className="flex flex-col gap-4 p-6" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="skeleton" style={{ width: 130, height: 24 }} />
        <div className="flex gap-2">
          <div className="skeleton" style={{ width: 90, height: 32, borderRadius: 'var(--radius-md)' }} />
          <div className="skeleton" style={{ width: 90, height: 32, borderRadius: 'var(--radius-md)' }} />
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex flex-col gap-2 flex-1 p-3" style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-md)' }}>
            <div className="skeleton" style={{ width: 64, height: 11 }} />
            <div className="skeleton" style={{ width: 36, height: 24 }} />
          </div>
        ))}
      </div>

      {/* Priority queue */}
      <div className="flex flex-col gap-2">
        <div className="skeleton" style={{ width: 100, height: 12, marginBottom: 'var(--space-1)' }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4" style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-md)' }}>
            {/* Icon */}
            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)' }} />
            {/* Content */}
            <div className="flex flex-col gap-2 flex-1">
              <div className="flex items-center gap-2">
                <div className="skeleton" style={{ width: 160, height: 14 }} />
                <div className="skeleton" style={{ width: 56, height: 18, borderRadius: 'var(--radius-full)' }} />
              </div>
              <div className="skeleton" style={{ width: '75%', height: 12 }} />
            </div>
            {/* Due date + action */}
            <div className="flex items-center gap-3">
              <div className="skeleton" style={{ width: 72, height: 12 }} />
              <div className="skeleton" style={{ width: 80, height: 28, borderRadius: 'var(--radius-md)' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Lower priority section */}
      <div className="flex flex-col gap-2">
        <div className="skeleton" style={{ width: 80, height: 12, marginBottom: 'var(--space-1)' }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3" style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-md)', opacity: 0.7 }}>
            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)' }} />
            <div className="flex flex-col gap-2 flex-1">
              <div className="skeleton" style={{ width: 140, height: 14 }} />
              <div className="skeleton" style={{ width: '60%', height: 12 }} />
            </div>
            <div className="skeleton" style={{ width: 72, height: 12 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
