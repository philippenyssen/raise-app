export default function DocumentDetailLoading() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="skeleton rounded" style={{ width: '32px', height: '32px' }} />
        <div className="skeleton rounded" style={{ width: '260px', height: '28px' }} />
      </div>
      <div className="skeleton rounded-xl" style={{ height: '48px' }} />
      <div className="skeleton rounded-xl" style={{ height: '400px' }} />
    </div>
  );
}
