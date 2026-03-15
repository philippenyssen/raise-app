export default function PipelineLoading() {
  const columns = [
    { label: 80, cards: 3 },
    { label: 72, cards: 4 },
    { label: 64, cards: 2 },
    { label: 88, cards: 3 },
    { label: 72, cards: 1 },
  ];

  return (
    <div className="flex flex-col gap-4 p-6" style={{ height: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="skeleton" style={{ width: 120, height: 24 }} />
        <div className="flex gap-2">
          <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 'var(--radius-md)' }} />
          <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 'var(--radius-md)' }} />
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 flex-1" style={{ overflow: 'hidden' }}>
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-2 flex-1" style={{ minWidth: 200 }}>
            {/* Column header */}
            <div className="flex items-center justify-between p-3" style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-md)' }}>
              <div className="skeleton" style={{ width: col.label, height: 12 }} />
              <div className="skeleton" style={{ width: 24, height: 20, borderRadius: 9999 }} />
            </div>
            {/* Cards */}
            <div className="flex flex-col gap-2">
              {Array.from({ length: col.cards }).map((_, ki) => (
                <div key={ki} className="flex flex-col gap-2 p-3" style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-md)' }}>
                  <div className="skeleton" style={{ width: '80%', height: 14 }} />
                  <div className="flex items-center gap-2">
                    <div className="skeleton" style={{ width: 52, height: 18, borderRadius: 9999 }} />
                    <div className="skeleton" style={{ width: 36, height: 18, borderRadius: 9999 }} />
                  </div>
                  <div className="skeleton" style={{ width: '60%', height: 11 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
