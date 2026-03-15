export default function InvestorDetailLoading() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="skeleton rounded" style={{ width: '32px', height: '32px' }} />
        <div className="skeleton rounded" style={{ width: '200px', height: '28px' }} />
        <div className="skeleton rounded-full" style={{ width: '60px', height: '24px' }} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '100px' }} />
        ))}
      </div>
      <div className="skeleton rounded-xl" style={{ height: '320px' }} />
    </div>
  );
}
