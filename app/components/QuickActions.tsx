import Link from 'next/link';
import { ReactNode } from 'react';

interface ActionButton {
  href: string;
  icon: ReactNode;
  label: string;
  variant: 'primary' | 'secondary' | 'accent' | 'outline';
  show?: boolean;
}

interface QuickActionsProps {
  actions: ActionButton[];
}

const variantStyles = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-secondary text-white hover:bg-secondary-hover',
  accent: 'bg-accent text-white hover:bg-accent-hover',
  outline: 'bg-surface border border-border text-text hover:bg-background',
};

export function QuickActions({ actions }: QuickActionsProps) {
  const visibleActions = actions.filter((action) => action.show !== false);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {visibleActions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={`flex flex-col items-center justify-center gap-2 py-5 px-4 rounded-xl font-semibold transition shadow-sm ${variantStyles[action.variant]}`}
        >
          {action.icon}
          <span>{action.label}</span>
        </Link>
      ))}
    </div>
  );
}
