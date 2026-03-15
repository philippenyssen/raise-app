export default function NewDocumentLoading() {
  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-6">
      <div className="skeleton rounded" style={{ width: '180px', height: '28px' }} />
      <div className="skeleton rounded-xl" style={{ height: '44px' }} />
      <div className="skeleton rounded-xl" style={{ height: '44px' }} />
      <div className="skeleton rounded-xl" style={{ height: '200px' }} />
      <div className="skeleton rounded-lg" style={{ width: '120px', height: '40px' }} />
    </div>
  );
}
