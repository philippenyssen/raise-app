export default function ReportsLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <div className="skeleton rounded" style={{ width: '160px', height: '28px', marginBottom: '6px' }} />
        <div className="skeleton rounded" style={{ width: '260px', height: '16px' }} />
      </div>
      <div className="skeleton rounded-xl" style={{ height: '200px' }} />
      <div className="skeleton rounded-xl" style={{ height: '200px' }} />
    </div>
  );
}
