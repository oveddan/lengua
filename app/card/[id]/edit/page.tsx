'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Card {
  id: string;
  spanish_word: string;
  translation: string;
  context_sentence: string | null;
  cloze_sentence: string | null;
}

export default function EditCardPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.id as string;

  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [spanishWord, setSpanishWord] = useState('');
  const [translation, setTranslation] = useState('');
  const [contextSentence, setContextSentence] = useState('');
  const [clozeSentence, setClozeSentence] = useState('');

  useEffect(() => {
    fetchCard();
  }, [cardId]);

  async function fetchCard() {
    const res = await fetch(`/api/cards?id=${cardId}`);
    if (!res.ok) {
      setError('Card not found');
      setLoading(false);
      return;
    }
    const cards = await res.json();
    const foundCard = Array.isArray(cards)
      ? cards.find((c: Card) => c.id === cardId)
      : cards;

    if (!foundCard) {
      setError('Card not found');
      setLoading(false);
      return;
    }

    setCard(foundCard);
    setSpanishWord(foundCard.spanish_word);
    setTranslation(foundCard.translation);
    setContextSentence(foundCard.context_sentence || '');
    setClozeSentence(foundCard.cloze_sentence || '');
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setError('');

    const res = await fetch(`/api/cards?id=${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spanish_word: spanishWord,
        translation: translation,
        context_sentence: contextSentence || null,
        cloze_sentence: clozeSentence || null,
      }),
    });

    if (!res.ok) {
      setError('Failed to save card');
      setSaving(false);
      return;
    }

    setSaving(false);
    // Close tab after successful save
    window.close();
  }

  async function handleDelete() {
    if (!confirm(`Delete this card?\n\n"${spanishWord}" - ${translation}`)) {
      return;
    }

    const res = await fetch(`/api/cards?id=${cardId}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      setError('Failed to delete card');
      return;
    }

    window.close();
  }

  if (loading) {
    return <div className="min-h-screen bg-background p-8 text-center text-text">Loading...</div>;
  }

  if (error && !card) {
    return (
      <div className="min-h-screen bg-background p-8 text-center">
        <div className="text-red-500 mb-4">{error}</div>
        <Link href="/" className="text-primary hover:underline">
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold text-text mb-6">Edit Card</h1>

        <div className="bg-surface rounded-xl shadow-card border border-border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Spanish Word/Phrase
            </label>
            <input
              type="text"
              value={spanishWord}
              onChange={(e) => setSpanishWord(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Translation
            </label>
            <input
              type="text"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Context Sentence
            </label>
            <textarea
              value={contextSentence}
              onChange={(e) => setContextSentence(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Cloze Sentence
            </label>
            <textarea
              value={clozeSentence}
              onChange={(e) => setClozeSentence(e.target.value)}
              rows={2}
              placeholder="Use {{c1::word}} for cloze deletion"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-text-muted mt-1">
              Wrap the word to hide with {"{{c1::word}}"}
            </p>
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !spanishWord || !translation}
              className="flex-1 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 border border-border text-text rounded-lg hover:bg-surface transition"
            >
              Cancel
            </button>
          </div>

          <div className="pt-4 border-t border-border mt-4">
            <button
              onClick={handleDelete}
              className="w-full py-2 text-red-500 hover:bg-red-500/10 rounded-lg transition"
            >
              Delete Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
