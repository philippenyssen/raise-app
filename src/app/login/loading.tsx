export default function LoginLoading() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
      <div style={{ width: '380px', textAlign: 'center' }}>
        <div className="skeleton rounded mx-auto" style={{ width: '48px', height: '48px', marginBottom: '24px' }} />
        <div className="skeleton rounded mx-auto" style={{ width: '140px', height: '24px', marginBottom: '32px' }} />
        <div className="skeleton rounded" style={{ height: '44px', marginBottom: '12px' }} />
        <div className="skeleton rounded" style={{ height: '44px' }} />
      </div>
    </div>
  );
}
