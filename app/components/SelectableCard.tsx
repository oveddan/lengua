import { ReactNode } from 'react';

interface SelectableCardProps {
  selected: boolean;
  onClick: () => void;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  rightContent?: ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'accent';
}

const variantStyles = {
  default: {
    selected: 'border-primary bg-primary/10 ring-2 ring-primary',
    unselected: 'border-border hover:border-text-muted',
  },
  primary: {
    selected: 'border-primary bg-primary/10 ring-2 ring-primary',
    unselected: 'border-border hover:border-primary/50',
  },
  secondary: {
    selected: 'border-secondary bg-secondary/10 ring-2 ring-secondary',
    unselected: 'border-border hover:border-secondary/50',
  },
  accent: {
    selected: 'border-accent bg-accent/10 ring-2 ring-accent',
    unselected: 'border-border hover:border-accent/50',
  },
};

export function SelectableCard({
  selected,
  onClick,
  title,
  description,
  badge,
  rightContent,
  variant = 'default',
}: SelectableCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={`relative flex cursor-pointer rounded-xl border p-4 transition-all ${
        selected ? styles.selected : styles.unselected
      }`}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="flex h-5 shrink-0 items-center">
          <div
            className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
              selected
                ? variant === 'secondary'
                  ? 'border-secondary bg-secondary'
                  : variant === 'accent'
                  ? 'border-accent bg-accent'
                  : 'border-primary bg-primary'
                : 'border-text-muted'
            }`}
          >
            {selected && (
              <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3.707 5.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L5 6.586 3.707 5.293z" />
              </svg>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text">{title}</span>
            {badge}
          </div>
          {description && <div className="mt-1 text-sm text-text-muted">{description}</div>}
        </div>
      </div>
      {rightContent && (
        <div className="ml-4 flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
          {rightContent}
        </div>
      )}
    </div>
  );
}

// Compact pill-style card for conjugations
interface PillCardProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  sublabel?: string;
  variant?: 'primary' | 'secondary' | 'accent';
}

export function PillCard({ selected, onClick, label, sublabel, variant = 'primary' }: PillCardProps) {
  const colorMap = {
    primary: selected ? 'bg-primary text-white' : 'bg-surface border-border hover:border-primary',
    secondary: selected ? 'bg-secondary text-white' : 'bg-surface border-border hover:border-secondary',
    accent: selected ? 'bg-accent text-white' : 'bg-surface border-border hover:border-accent',
  };

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${colorMap[variant]} ${
        !selected ? 'text-text' : ''
      }`}
    >
      <span className="block">{label}</span>
      {sublabel && (
        <span className={`block text-xs ${selected ? 'text-white/80' : 'text-text-muted'}`}>
          {sublabel}
        </span>
      )}
    </button>
  );
}
