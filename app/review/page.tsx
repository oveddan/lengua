'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Card {
  id: string;
  spanish_word: string;
  translation: string;
  context_sentence: string | null;
  cloze_sentence: string | null;
  interval: number;
  ease_factor: number;
  next_review: string;
  review_count: number;
}

type Quality = 'again' | 'hard' | 'good' | 'easy';

export default function ReviewPage() {
  const searchParams = useSearchParams();
  const deckId = searchParams.get('deck');

  const [cards, setCards] = useState<Card[]>([]);
  const [deckName, setDeckName] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    fetchDueCards();
  }, [deckId]);

  async function fetchDueCards() {
    let url = '/api/cards?due=true';
    if (deckId) {
      url += `&deckId=${deckId}`;
      // Fetch deck name
      const decksRes = await fetch('/api/decks');
      const decksData = await decksRes.json();
      const deck = decksData.decks.find((d: { id: string; name: string }) => d.id === deckId);
      if (deck) setDeckName(deck.name);
    }
    const res = await fetch(url);
    const data = await res.json();
    // Shuffle cards randomly
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setLoading(false);
  }

  async function handleReview(quality: Quality) {
    const card = cards[currentIndex];
    setReviewing(true);

    await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: card.id, quality }),
    });

    setReviewing(false);
    setShowAnswer(false);

    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // All cards reviewed
      setCards([]);
    }
  }

  function renderCloze(cloze: string, reveal: boolean, spanishWord: string) {
    // Check if cloze already has {{c1::...}} markers
    if (cloze.includes('{{c1::')) {
      return cloze.replace(/\{\{c1::(.+?)\}\}/g, (_, word) => {
        if (reveal) {
          return `<span class="text-success font-bold underline">${word}</span>`;
        }
        return `<span class="bg-primary/30 text-primary/30 px-2 rounded">______</span>`;
      });
    }

    // Fallback: try to create cloze on-the-fly for old cards without markers
    // Extract the actual word from spanish_word (may contain "verb (pronoun tense)" format)
    const wordToFind = spanishWord.includes('(') ? spanishWord.split('(')[0].trim() : spanishWord;
    const escaped = wordToFind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[\\s¿¡])(${escaped})([\\s.,!?;:]|$)`, 'gi');

    const replaced = cloze.replace(regex, (_, before, word, after) => {
      if (reveal) {
        return `${before}<span class="text-success font-bold underline">${word}</span>${after}`;
      }
      return `${before}<span class="bg-primary/30 text-primary/30 px-2 rounded">______</span>${after}`;
    });

    if (replaced !== cloze) {
      return replaced;
    }

    // Last resort: just show the sentence with word highlighted/hidden at the end
    if (reveal) {
      return `${cloze} <span class="text-success font-bold underline">[${spanishWord}]</span>`;
    }
    return `${cloze} <span class="bg-primary/30 text-primary/30 px-2 rounded">______</span>`;
  }

  if (loading) {
    return <div className="min-h-screen bg-background p-8 text-center text-text">Loading...</div>;
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-text mb-2">All caught up!</h1>
          <p className="text-text-secondary mb-4">
            No cards due for review{deckName ? ` in ${deckName}` : ''}.
          </p>
          <Link href="/" className="text-primary hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const card = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-8">
        <div className="flex justify-between items-center mb-4">
          <Link href="/" className="text-primary hover:underline">
            ← Back
          </Link>
          <div className="text-right">
            {deckName && <div className="text-sm text-text-muted">{deckName}</div>}
            <span className="text-text-secondary">
              {currentIndex + 1} / {cards.length}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-border rounded-full mb-8">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Card */}
        <div className="bg-surface rounded-xl shadow-card border border-border p-8 mb-8">
          {/* Hint - English meaning */}
          <div className="text-center mb-4 pb-4 border-b border-border">
            <div className="text-text-muted">{card.translation}</div>
          </div>

          {/* Cloze sentence */}
          <div
            className="text-2xl text-center mb-6 leading-relaxed text-text"
            dangerouslySetInnerHTML={{
              __html: renderCloze(
                card.cloze_sentence || card.context_sentence || `{{c1::${card.spanish_word}}}`,
                showAnswer,
                card.spanish_word
              ),
            }}
          />

          {/* Show answer button or answer details */}
          {!showAnswer ? (
            <button
              onClick={() => setShowAnswer(true)}
              className="w-full py-4 bg-background border border-border text-text rounded-lg font-medium hover:bg-surface transition"
            >
              Show Answer
            </button>
          ) : (
            <div className="text-center">
              <div className="text-xl font-bold text-success mb-2">
                Answer: {card.cloze_sentence?.match(/\{\{c1::(.+?)\}\}/)?.[1] || card.spanish_word}
              </div>
              {card.context_sentence && card.context_sentence !== card.cloze_sentence?.replace(/\{\{c1::(.+?)\}\}/g, '$1') && (
                <div className="text-text-secondary text-sm mt-2">{card.context_sentence}</div>
              )}
            </div>
          )}
        </div>

        {/* Review buttons */}
        {showAnswer && (
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => handleReview('again')}
              disabled={reviewing}
              className="py-4 bg-again text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              <div className="text-lg">Again</div>
              <div className="text-xs opacity-75">1d</div>
            </button>
            <button
              onClick={() => handleReview('hard')}
              disabled={reviewing}
              className="py-4 bg-hard text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              <div className="text-lg">Hard</div>
              <div className="text-xs opacity-75">{Math.round(card.interval * 1.2)}d</div>
            </button>
            <button
              onClick={() => handleReview('good')}
              disabled={reviewing}
              className="py-4 bg-good text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              <div className="text-lg">Good</div>
              <div className="text-xs opacity-75">{Math.round(card.interval * card.ease_factor)}d</div>
            </button>
            <button
              onClick={() => handleReview('easy')}
              disabled={reviewing}
              className="py-4 bg-easy text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              <div className="text-lg">Easy</div>
              <div className="text-xs opacity-75">{Math.round(card.interval * card.ease_factor * 1.3)}d</div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
