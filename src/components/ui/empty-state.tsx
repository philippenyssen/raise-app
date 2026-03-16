import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string } | { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {Icon && <Icon className="empty-state-icon" />}
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && (
        'href' in action ? (
          <Link href={action.href} className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-3)' }}>
            {action.label}</Link>
        ) : (
          <button onClick={action.onClick} className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-3)' }}>
            {action.label}</button>
        )
      )}
    </div>
  );
}
