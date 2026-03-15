export default function StrategicLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <div className="skeleton rounded" style={{ width: '220px', height: '28px', marginBottom: '6px' }} />
        <div className="skeleton rounded" style={{ width: '320px', height: '16px' }} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '90px' }} />
        ))}
      </div>
      <div className="skeleton rounded-xl" style={{ height: '280px' }} />
      <div className="skeleton rounded-xl" style={{ height: '200px' }} />
    </div>
  );
}
