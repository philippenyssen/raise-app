export default function SettingsLoading() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="skeleton rounded" style={{ width: '120px', height: '28px', marginBottom: '6px' }} />
        <div className="skeleton rounded" style={{ width: '340px', height: '16px' }} />
      </div>

      {/* Raise Parameters card */}
      <div className="rounded-xl" style={{ padding: '24px' }}>
        <div className="skeleton rounded mb-6" style={{ width: '180px', height: '22px' }} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton rounded mb-2" style={{ width: '100px', height: '12px' }} />
              <div className="skeleton rounded-lg" style={{ height: '38px' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Scoring Weights card */}
      <div className="rounded-xl" style={{ padding: '24px' }}>
        <div className="skeleton rounded mb-6" style={{ width: '160px', height: '22px' }} />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="skeleton rounded" style={{ width: '140px', height: '14px' }} />
              <div className="skeleton rounded flex-1" style={{ height: '6px' }} />
              <div className="skeleton rounded" style={{ width: '48px', height: '28px' }} />
            </div>
          ))}
        </div>
      </div>

      {/* API Key card */}
      <div className="skeleton rounded-xl" style={{ height: '100px' }} />
    </div>
  );
}
