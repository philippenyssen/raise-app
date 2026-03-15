export default function MeetingPrepLoading() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div>
        <div className="skeleton rounded" style={{ width: '180px', height: '28px', marginBottom: '6px' }} />
        <div className="skeleton rounded" style={{ width: '140px', height: '16px' }} />
      </div>
      <div className="skeleton rounded-xl" style={{ height: '52px' }} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="skeleton rounded-xl" style={{ height: '260px' }} />
        <div className="skeleton rounded-xl" style={{ height: '260px' }} />
      </div>
      <div className="skeleton rounded-xl" style={{ height: '200px' }} />
    </div>
  );
}
