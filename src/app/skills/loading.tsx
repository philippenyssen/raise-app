export default function SkillsLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <div className="skeleton rounded" style={{ width: '160px', height: '28px', marginBottom: '6px' }} />
        <div className="skeleton rounded" style={{ width: '240px', height: '16px' }} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '100px' }} />
        ))}
      </div>
    </div>
  );
}
