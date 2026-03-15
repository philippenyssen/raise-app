export default function ModelLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <div className="skeleton rounded" style={{ width: '200px', height: '28px', marginBottom: '6px' }} />
        <div className="skeleton rounded" style={{ width: '300px', height: '16px' }} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '120px' }} />
        ))}
      </div>
      <div className="skeleton rounded-xl" style={{ height: '240px' }} />
    </div>
  );
}
