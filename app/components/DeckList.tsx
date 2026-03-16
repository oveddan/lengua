import Link from 'next/link';
import { EmptyState } from './EmptyState';
import { DeckIcon } from './icons';

interface Deck {
  id: string;
  name: string;
}

interface DeckListProps {
  decks: Deck[];
  onDelete: (id: string) => void;
}

export function DeckList({ decks, onDelete }: DeckListProps) {
  if (decks.length === 0) {
    return (
      <EmptyState
        icon={<DeckIcon />}
        title="No decks"
        description="Get started by creating a new deck above."
      />
    );
  }

  return (
    <ul className="divide-y divide-border bg-surface rounded-xl border border-border overflow-hidden">
      {decks.map((deck) => (
        <li
          key={deck.id}
          className="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-background transition-colors"
        >
          <div className="flex min-w-0 gap-x-4">
            <div className="h-12 w-12 flex-none rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-semibold text-primary">
                {deck.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-auto">
              <p className="text-sm font-semibold text-text">
                <Link href={`/deck/${deck.id}`} className="hover:text-primary">
                  <span className="absolute inset-x-0 -top-px bottom-0" />
                  {deck.name}
                </Link>
              </p>
              <p className="mt-1 flex text-xs text-text-muted">
                <span className="relative truncate">Click to browse cards</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-x-4">
            <div className="flex gap-2 relative z-10">
              <Link
                href={`/review?deck=${deck.id}`}
                className="px-2.5 py-1.5 sm:px-3 text-xs sm:text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition"
              >
                Review
              </Link>
              <Link
                href={`/add?deck=${deck.id}`}
                className="px-2.5 py-1.5 sm:px-3 text-xs sm:text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition"
              >
                Add
              </Link>
              <button
                onClick={() => onDelete(deck.id)}
                className="px-2.5 py-1.5 sm:px-3 text-xs sm:text-sm font-medium bg-error-light text-error rounded-lg hover:opacity-80 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
