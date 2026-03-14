export default function DocumentsLoading() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="skeleton rounded" style={{ width: '160px', height: '28px', marginBottom: '6px' }} />
          <div className="skeleton rounded" style={{ width: '120px', height: '16px' }} />
        </div>
        <div className="flex gap-2">
          <div className="skeleton rounded-lg" style={{ width: '110px', height: '36px' }} />
          <div className="skeleton rounded-lg" style={{ width: '140px', height: '36px' }} />
        </div>
      </div>

      {/* Document type group */}
      {Array.from({ length: 3 }).map((_, g) => (
        <div key={g}>
          <div className="skeleton rounded mb-3" style={{ width: '140px', height: '14px' }} />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="skeleton rounded-xl" style={{ height: '64px', opacity: 1 - g * 0.15 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
