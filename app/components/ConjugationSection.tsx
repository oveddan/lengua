import { SelectableCard } from './SelectableCard';

interface ConjugationItem {
  pronoun: string;
  form: string;
  sentence: string;
  sentence_english: string;
}

interface ConjugationSectionProps {
  title: string;
  tense: string;
  items: ConjugationItem[];
  selectedKeys: Set<string>;
  onToggle: (tense: string, index: number) => void;
  variant: 'primary' | 'secondary' | 'accent';
}

export function ConjugationSection({
  title,
  tense,
  items,
  selectedKeys,
  onToggle,
  variant,
}: ConjugationSectionProps) {
  const colorMap = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    accent: 'text-accent',
  };

  return (
    <div>
      <h3 className={`font-medium ${colorMap[variant]} mb-3`}>{title}</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <SelectableCard
            key={i}
            selected={selectedKeys.has(`${tense}-${i}`)}
            onClick={() => onToggle(tense, i)}
            variant={variant}
            title={
              <span className="flex items-baseline gap-2">
                <span className="text-text-muted text-sm w-20">{item.pronoun}</span>
                <span className={colorMap[variant]}>{item.form}</span>
              </span>
            }
            description={
              <span>
                <span className="text-text">{item.sentence}</span>
                <span className="text-text-muted ml-2">({item.sentence_english})</span>
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
}
