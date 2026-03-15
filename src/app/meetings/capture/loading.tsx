export default function MeetingCaptureLoading() {
  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-6">
      <div className="skeleton rounded" style={{ width: '200px', height: '28px' }} />
      <div className="skeleton rounded-xl" style={{ height: '44px' }} />
      <div className="skeleton rounded-xl" style={{ height: '44px' }} />
      <div className="skeleton rounded-xl" style={{ height: '180px' }} />
      <div className="skeleton rounded-lg" style={{ width: '140px', height: '40px' }} />
    </div>
  );
}
