export default function WorkspaceLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <div className="skeleton rounded" style={{ width: '160px', height: '28px', marginBottom: '6px' }} />
        <div className="skeleton rounded" style={{ width: '240px', height: '16px' }} />
      </div>
      <div className="skeleton rounded-xl" style={{ height: '400px' }} />
      <div className="skeleton rounded-xl" style={{ height: '48px' }} />
    </div>
  );
}
