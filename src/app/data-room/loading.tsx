export default function DataRoomLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="skeleton rounded" style={{ width: '140px', height: '28px', marginBottom: '6px' }} />
          <div className="skeleton rounded" style={{ width: '200px', height: '16px' }} />
        </div>
        <div className="flex gap-2">
          <div className="skeleton rounded-lg" style={{ width: '110px', height: '36px' }} />
          <div className="skeleton rounded-lg" style={{ width: '120px', height: '36px' }} />
        </div>
      </div>

      {/* Search bar */}
      <div className="skeleton rounded-lg" style={{ height: '42px' }} />

      {/* Category sections */}
      {Array.from({ length: 4 }).map((_, g) => (
        <div key={g}>
          <div className="flex items-center gap-3 mb-2">
            <div className="skeleton rounded" style={{ width: '100px', height: '16px' }} />
            <div className="skeleton rounded" style={{ width: '50px', height: '14px' }} />
          </div>
          <div className="space-y-1">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="skeleton rounded-lg" style={{ height: '48px', opacity: 1 - g * 0.12 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
