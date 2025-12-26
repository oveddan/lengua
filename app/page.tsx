'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
    return <div className="min-h-screen bg-background p-8 text-center text-text">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-3xl font-bold text-text mb-2">Spanish Flashcards</h1>
        <p className="text-text-secondary mb-8">Learn Spanish with spaced repetition</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-surface p-4 rounded-lg shadow-card border border-border">
            <div className="text-3xl font-bold text-primary">{stats.dueCards}</div>
            <div className="text-text-secondary">Cards Due</div>
          </div>
          <div className="bg-surface p-4 rounded-lg shadow-card border border-border">
            <div className="text-3xl font-bold text-secondary">{stats.totalCards}</div>
            <div className="text-text-secondary">Total Cards</div>
          </div>
          <div className="bg-surface p-4 rounded-lg shadow-card border border-border">
            <div className="text-3xl font-bold text-accent">{stats.totalDecks}</div>
            <div className="text-text-secondary">Decks</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4 mb-8">
          {stats.dueCards > 0 && (
            <Link
              href="/review"
              className="flex-1 bg-primary text-white py-4 px-6 rounded-lg text-center font-semibold hover:bg-primary-hover transition"
            >
              Review {stats.dueCards} Cards
            </Link>
          )}
          <Link
            href="/chat"
            className="flex-1 bg-secondary text-white py-4 px-6 rounded-lg text-center font-semibold hover:bg-secondary-hover transition"
          >
            Chat Assistant
          </Link>
          <Link
            href="/add"
            className="flex-1 bg-accent text-white py-4 px-6 rounded-lg text-center font-semibold hover:bg-accent-hover transition"
          >
            Add New Words
          </Link>
          <Link
            href="/export"
            className="flex-1 bg-surface border border-border text-text py-4 px-6 rounded-lg text-center font-semibold hover:bg-background transition"
          >
            Export to Anki
          </Link>
        </div>

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

        {/* Deck List */}
        <h2 className="text-xl font-semibold text-text mb-4">Your Decks</h2>
        {decks.length === 0 ? (
          <p className="text-text-muted">No decks yet. Create one above!</p>
        ) : (
          <div className="space-y-2">
            {decks.map((deck) => (
              <div
                key={deck.id}
                className="bg-surface p-4 rounded-lg shadow-card border border-border flex justify-between items-center"
              >
                <Link href={`/deck/${deck.id}`} className="font-medium text-text hover:text-primary">
                  {deck.name}
                </Link>
                <div className="flex gap-2">
                  <Link
                    href={`/review?deck=${deck.id}`}
                    className="px-3 py-1 text-sm bg-primary text-white rounded hover:opacity-80"
                  >
                    Review
                  </Link>
                  <Link
                    href={`/add?deck=${deck.id}`}
                    className="px-3 py-1 text-sm bg-success-light text-success rounded hover:opacity-80"
                  >
                    Add
                  </Link>
                  <button
                    onClick={() => deleteDeck(deck.id)}
                    className="px-3 py-1 text-sm bg-error-light text-error rounded hover:opacity-80"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
