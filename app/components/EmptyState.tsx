import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="text-center py-12 bg-surface rounded-xl border border-border">
      <div className="mx-auto h-12 w-12 text-text-muted">{icon}</div>
      <h3 className="mt-2 text-sm font-semibold text-text">{title}</h3>
      <p className="mt-1 text-sm text-text-muted">{description}</p>
    </div>
  );
}
