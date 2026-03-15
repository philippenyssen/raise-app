export default function TermsLoading() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="skeleton rounded" style={{ width: '220px', height: '28px', marginBottom: '6px' }} />
          <div className="skeleton rounded" style={{ width: '200px', height: '16px' }} />
        </div>
        <div className="flex gap-2">
          <div className="skeleton rounded-lg" style={{ width: '130px', height: '36px' }} />
          <div className="skeleton rounded-lg" style={{ width: '140px', height: '36px' }} />
        </div>
      </div>

      {/* Market standards card */}
      <div className="skeleton rounded-xl" style={{ height: '100px' }} />

      {/* Table skeleton */}
      <div className="rounded-xl overflow-hidden">
        <div className="skeleton" style={{ height: '44px', borderBottom: '1px solid var(--border-subtle)' }} />
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '40px', borderBottom: '1px solid var(--border-subtle)', opacity: 1 - i * 0.06 }} />
        ))}
        <div className="skeleton" style={{ height: '56px' }} />
      </div>
    </div>
  );
}
