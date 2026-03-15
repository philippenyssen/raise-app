export default function EnrichmentLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <div className="skeleton rounded" style={{ width: '220px', height: '28px', marginBottom: '6px' }} />
        <div className="skeleton rounded" style={{ width: '280px', height: '16px' }} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '90px' }} />
        ))}
      </div>
      <div className="skeleton rounded-xl" style={{ height: '260px' }} />
    </div>
  );
}
