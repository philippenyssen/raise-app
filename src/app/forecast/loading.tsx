const maxWidthCenter = { maxWidth: '1400px', margin: '0 auto' } as const;

export default function ForecastLoading() {
  return (
    <div className="flex-1 p-6 page-content" style={maxWidthCenter}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="skeleton rounded" style={{ width: '200px', height: '32px' }} />
      </div>

      {/* Progress bar card */}
      <div className="skeleton rounded-xl" style={{ height: '120px', marginBottom: '24px' }} />

      {/* Scenario cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '140px' }} />
        ))}
      </div>

      {/* Distribution / Critical / Risk row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '180px' }} />
        ))}
      </div>

      {/* Investor timeline */}
      <div className="skeleton rounded-xl" style={{ height: '320px' }} />
    </div>
  );
}
