'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Card {
  id: string;
  spanish_word: string;
  translation: string;
  context_sentence: string | null;
  cloze_sentence: string | null;
  interval: number;
  next_review: string;
  review_count: number;
}

interface Deck {
  id: string;
  name: string;
}

export default function DeckPage() {
  const params = useParams();
  const deckId = params.id as string;
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [deckId]);

  async function fetchData() {
    const [decksRes, cardsRes] = await Promise.all([
      fetch('/api/decks'),
      fetch(`/api/cards?deckId=${deckId}`),
    ]);

    const decksData = await decksRes.json();
    const cardsData = await cardsRes.json();

    const currentDeck = decksData.decks.find((d: Deck) => d.id === deckId);
    setDeck(currentDeck || null);
    setCards(cardsData);
    setLoading(false);
  }

  async function deleteCard(id: string) {
    if (!confirm('Delete this card?')) return;

    await fetch(`/api/cards?id=${id}`, { method: 'DELETE' });
    fetchData();
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Due now';
    if (diffDays === 1) return 'Tomorrow';
    return `In ${diffDays} days`;
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!deck) {
    return (
      <div className="p-8 text-center">
        <p>Deck not found</p>
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/" className="text-blue-600 hover:underline text-sm">
              ← Back to Home
            </Link>
            <h1 className="text-3xl font-bold">{deck.name}</h1>
            <p className="text-gray-600">{cards.length} cards</p>
          </div>
          <Link
            href={`/add?deck=${deckId}`}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Add Cards
          </Link>
        </div>

        {cards.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-500 mb-4">No cards in this deck yet.</p>
            <Link
              href={`/add?deck=${deckId}`}
              className="text-blue-600 hover:underline"
            >
              Add your first card
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {cards.map((card) => (
              <div
                key={card.id}
                className="bg-white p-4 rounded-lg shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-lg">
                      {card.spanish_word}{' '}
                      <span className="text-gray-500 font-normal">= {card.translation}</span>
                    </div>
                    {card.cloze_sentence && (
                      <div className="text-sm text-gray-600 mt-1">
                        {card.cloze_sentence.replace(/\{\{c1::(.+?)\}\}/g, '[$1]')}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-2">
                      Reviews: {card.review_count} · Next: {formatDate(card.next_review)} · Interval: {card.interval}d
                    </div>
                  </div>
                  <button
                    onClick={() => deleteCard(card.id)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
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
