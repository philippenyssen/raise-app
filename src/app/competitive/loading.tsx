export default function CompetitiveLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <div className="skeleton rounded" style={{ width: '200px', height: '28px', marginBottom: '6px' }} />
        <div className="skeleton rounded" style={{ width: '260px', height: '16px' }} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '100px' }} />
        ))}
      </div>
      <div className="skeleton rounded-xl" style={{ height: '250px' }} />
    </div>
  );
}
