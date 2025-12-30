interface StatItem {
  label: string;
  value: number;
  subtitle?: string;
  highlight?: boolean;
}

interface StatsGridProps {
  stats: StatItem[];
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-px bg-border rounded-xl overflow-hidden sm:grid-cols-3 mb-8">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-surface px-6 py-8">
          <p className="text-sm font-medium text-text-muted">{stat.label}</p>
          <p className="mt-2 flex items-baseline gap-x-2">
            <span
              className={`text-4xl font-semibold tracking-tight ${
                stat.highlight ? 'text-primary' : 'text-text'
              }`}
            >
              {stat.value}
            </span>
            {stat.subtitle && (
              <span className={`text-sm ${stat.highlight ? 'text-primary' : 'text-text-muted'}`}>
                {stat.subtitle}
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
