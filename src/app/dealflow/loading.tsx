export default function DealflowLoading() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="skeleton rounded" style={{ width: '140px', height: '28px', marginBottom: '6px' }} />
          <div className="skeleton rounded" style={{ width: '280px', height: '16px' }} />
        </div>
        <div className="skeleton rounded-lg" style={{ width: '100px', height: '36px' }} />
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton rounded-lg" style={{ height: '72px' }} />
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton rounded-md" style={{ width: '56px', height: '28px' }} />
        ))}
      </div>

      {/* Table header */}
      <div className="rounded-xl overflow-hidden">
        <div className="skeleton" style={{ height: '40px', borderBottom: '1px solid var(--border-subtle)' }} />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '56px', borderBottom: '1px solid var(--border-subtle)', opacity: 1 - i * 0.08 }} />
        ))}
      </div>
    </div>
  );
}
