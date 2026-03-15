export default function DealHeatLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <div className="skeleton rounded" style={{ width: '180px', height: '28px', marginBottom: '6px' }} />
        <div className="skeleton rounded" style={{ width: '260px', height: '16px' }} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '70px' }} />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '64px' }} />
        ))}
      </div>
    </div>
  );
}
