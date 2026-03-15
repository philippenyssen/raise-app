export default function ConsistencyLoading() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div>
        <div className="skeleton rounded" style={{ width: '200px', height: '28px', marginBottom: '6px' }} />
        <div className="skeleton rounded" style={{ width: '160px', height: '16px' }} />
      </div>
      <div className="skeleton rounded-xl" style={{ height: '60px' }} />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '56px', opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    </div>
  );
}
