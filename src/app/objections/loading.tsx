export default function ObjectionsLoading() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="skeleton rounded" style={{ width: '200px', height: '28px', marginBottom: '6px' }} />
        <div className="skeleton rounded" style={{ width: '300px', height: '16px' }} />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '80px' }} />
        ))}
      </div>

      {/* Topic groups */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="skeleton" style={{ height: '52px', borderRadius: '12px 12px 0 0' }} />
            <div className="p-4 space-y-3">
              <div className="skeleton rounded" style={{ height: '40px' }} />
              <div className="skeleton rounded" style={{ height: '40px', opacity: 0.7 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
