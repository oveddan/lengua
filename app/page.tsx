'use client';

import { useEffect, useState } from 'react';
import {
  StatsGrid,
  QuickActions,
  DeckList,
  ReviewIcon,
  ChatIcon,
  AddIcon,
  ExportIcon,
} from './components';

interface Deck {
  id: string;
  name: string;
  created_at: string;
}

interface Stats {
  totalCards: number;
  dueCards: number;
  totalDecks: number;
}

export default function Home() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [stats, setStats] = useState<Stats>({ totalCards: 0, dueCards: 0, totalDecks: 0 });
  const [studyAheadCount, setStudyAheadCount] = useState(0);
  const [newDeckName, setNewDeckName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDecks();
  }, []);

  async function fetchDecks() {
    const res = await fetch('/api/decks');
    const data = await res.json();
    setDecks(data.decks);
    setStats(data.stats);

    // If no due cards, check how many are available for study ahead
    if (data.stats.dueCards === 0) {
      const aheadRes = await fetch('/api/cards?studyAhead=true');
      const aheadData = await aheadRes.json();
      setStudyAheadCount(aheadData.length);
    }

    setLoading(false);
  }

  async function createDeck(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeckName.trim()) return;

    await fetch('/api/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newDeckName }),
    });

    setNewDeckName('');
    fetchDecks();
  }

  async function deleteDeck(id: string) {
    if (!confirm('Delete this deck and all its cards?')) return;

    await fetch(`/api/decks?id=${id}`, { method: 'DELETE' });
    fetchDecks();
  }

  if (loading) {
    return <div className="min-h-screen bg-background p-4 sm:p-8 text-center text-text">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        <h1 className="text-3xl font-bold text-text mb-2">Spanish Flashcards</h1>
        <p className="text-text-secondary mb-8">Learn Spanish with spaced repetition</p>

        <StatsGrid
          stats={[
            {
              label: 'Cards Due',
              value: stats.dueCards,
              subtitle: stats.dueCards > 0 ? 'ready to review' : undefined,
              highlight: true,
            },
            { label: 'Total Cards', value: stats.totalCards, subtitle: 'in library' },
            { label: 'Decks', value: stats.totalDecks, subtitle: 'collections' },
          ]}
        />

        <QuickActions
          actions={[
            { href: '/chat', icon: <ChatIcon />, label: 'Chat Assistant', variant: 'secondary' },
            {
              href: '/review',
              icon: <ReviewIcon />,
              label: `Review (${stats.dueCards})`,
              variant: 'primary',
              show: stats.dueCards > 0,
            },
            {
              href: '/review?studyAhead=true',
              icon: <ReviewIcon />,
              label: `Study Ahead (${studyAheadCount})`,
              variant: 'secondary',
              show: stats.dueCards === 0 && studyAheadCount > 0,
            },
            { href: '/add', icon: <AddIcon />, label: 'Add Words', variant: 'accent' },
            { href: '/export', icon: <ExportIcon />, label: 'Export to Anki', variant: 'outline' },
          ]}
        />

        {/* Create Deck */}
        <form onSubmit={createDeck} className="flex gap-2 mb-8">
          <input
            type="text"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            placeholder="New deck name..."
            className="flex-1 px-4 py-2 border border-border rounded-lg bg-surface text-text placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-text text-surface rounded-lg hover:opacity-90 transition"
          >
            Create Deck
          </button>
        </form>

        <h2 className="text-xl font-semibold text-text mb-4">Your Decks</h2>
        <DeckList decks={decks} onDelete={deleteDeck} />
      </div>
    </div>
  );
}
