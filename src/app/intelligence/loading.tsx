export default function IntelligenceLoading() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="skeleton rounded" style={{ width: '220px', height: '28px', marginBottom: '6px' }} />
        <div className="skeleton rounded" style={{ width: '320px', height: '16px' }} />
      </div>

      {/* Research bar */}
      <div className="skeleton rounded-xl" style={{ height: '96px' }} />

      {/* Tabs */}
      <div className="flex gap-4" style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '2px' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton rounded" style={{ width: '120px', height: '32px' }} />
        ))}
      </div>

      {/* Content cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '64px', opacity: 1 - i * 0.1 }} />
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '72px' }} />
        ))}
      </div>
    </div>
  );
}
