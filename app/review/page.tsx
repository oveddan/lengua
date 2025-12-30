'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  const router = useRouter();
  const deckId = searchParams.get('deck');
  const cardId = searchParams.get('card');

  const [cards, setCards] = useState<Card[]>([]);
  const [deckName, setDeckName] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSpanishWord, setEditSpanishWord] = useState('');
  const [editTranslation, setEditTranslation] = useState('');
  const [editContextSentence, setEditContextSentence] = useState('');
  const [editClozeSentence, setEditClozeSentence] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sessionKey = `review-order-${deckId || 'all'}`;

  // Update URL when card changes
  function updateUrlWithCard(id: string) {
    const params = new URLSearchParams();
    if (deckId) params.set('deck', deckId);
    params.set('card', id);
    router.replace(`/review?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchDueCards() {
      let url = '/api/cards?due=true';
      if (deckId) {
        url += `&deckId=${deckId}`;
        // Fetch deck name
        const decksRes = await fetch('/api/decks');
        const decksData = await decksRes.json();
        const deck = decksData.decks.find((d: { id: string; name: string }) => d.id === deckId);
        if (deck && !cancelled) setDeckName(deck.name);
      }
      const res = await fetch(url);
      const data: Card[] = await res.json();

      if (cancelled) return;

      // Try to restore order from sessionStorage
      const storedOrder = sessionStorage.getItem(sessionKey);
      let orderedCards: Card[];

      if (storedOrder) {
        const orderIds: string[] = JSON.parse(storedOrder);
        // Filter to only cards that are still due
        const currentIds = new Set(data.map((c) => c.id));
        const validOrderIds = orderIds.filter((id) => currentIds.has(id));
        // Map IDs back to cards, add any new cards at the end
        const cardMap = new Map(data.map((c) => [c.id, c]));
        orderedCards = validOrderIds.map((id) => cardMap.get(id)!);
        // Add any cards not in stored order (newly due)
        const orderedSet = new Set(validOrderIds);
        const newCards = data.filter((c) => !orderedSet.has(c.id));
        orderedCards = [...orderedCards, ...newCards];
      } else {
        // Shuffle cards randomly and store order
        orderedCards = [...data].sort(() => Math.random() - 0.5);
        sessionStorage.setItem(sessionKey, JSON.stringify(orderedCards.map((c) => c.id)));
      }

      setCards(orderedCards);

      // Restore position from URL card param
      if (cardId && orderedCards.length > 0) {
        const idx = orderedCards.findIndex((c) => c.id === cardId);
        if (idx !== -1) {
          setCurrentIndex(idx);
        } else if (orderedCards.length > 0) {
          // Card no longer exists, go to first card
          const params = new URLSearchParams();
          if (deckId) params.set('deck', deckId);
          params.set('card', orderedCards[0].id);
          router.replace(`/review?${params.toString()}`, { scroll: false });
        }
      } else if (orderedCards.length > 0) {
        // No card in URL, set it to first card
        const params = new URLSearchParams();
        if (deckId) params.set('deck', deckId);
        params.set('card', orderedCards[0].id);
        router.replace(`/review?${params.toString()}`, { scroll: false });
      }

      setLoading(false);
    }

    fetchDueCards();

    return () => {
      cancelled = true;
    };
  }, [deckId, cardId, sessionKey, router]);

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
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      updateUrlWithCard(cards[nextIndex].id);
    } else {
      // All cards reviewed - clear session storage and URL
      sessionStorage.removeItem(sessionKey);
      router.replace(deckId ? `/review?deck=${deckId}` : '/review', { scroll: false });
      setCards([]);
    }
  }

  function openEditModal() {
    const card = cards[currentIndex];
    setEditSpanishWord(card.spanish_word);
    setEditTranslation(card.translation);
    setEditContextSentence(card.context_sentence || '');

    // Generate cloze if not stored
    let cloze = card.cloze_sentence || '';
    if (!cloze && card.context_sentence) {
      // Generate cloze from context sentence
      const wordToFind = card.spanish_word.includes('(')
        ? card.spanish_word.split('(')[0].trim()
        : card.spanish_word;
      const escaped = wordToFind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[\\s¿¡])(${escaped})([\\s.,!?;:]|$)`, 'gi');
      cloze = card.context_sentence.replace(regex, (_, before, word, after) => {
        return `${before}{{c1::${word}}}${after}`;
      });
      // If no match found, create simple cloze
      if (!cloze.includes('{{c1::')) {
        cloze = `{{c1::${card.spanish_word}}}`;
      }
    } else if (!cloze) {
      cloze = `{{c1::${card.spanish_word}}}`;
    }

    setEditClozeSentence(cloze);
    setConfirmDelete(false);
    setEditModalOpen(true);
  }

  function closeEditModal() {
    setEditModalOpen(false);
    setConfirmDelete(false);
  }

  async function handleSaveEdit() {
    const card = cards[currentIndex];
    setSaving(true);

    const res = await fetch(`/api/cards?id=${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spanish_word: editSpanishWord,
        translation: editTranslation,
        context_sentence: editContextSentence || null,
        cloze_sentence: editClozeSentence || null,
      }),
    });

    if (res.ok) {
      // Update the card in state
      const updatedCards = [...cards];
      updatedCards[currentIndex] = {
        ...card,
        spanish_word: editSpanishWord,
        translation: editTranslation,
        context_sentence: editContextSentence || null,
        cloze_sentence: editClozeSentence || null,
      };
      setCards(updatedCards);
      closeEditModal();
    }

    setSaving(false);
  }

  async function handleDeleteCard() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    const card = cards[currentIndex];
    setSaving(true);

    const res = await fetch(`/api/cards?id=${card.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      // Remove card from list
      const updatedCards = cards.filter((_, i) => i !== currentIndex);
      setCards(updatedCards);

      // Update session storage with new order
      sessionStorage.setItem(sessionKey, JSON.stringify(updatedCards.map((c) => c.id)));

      // Adjust index if needed
      let newIndex = currentIndex;
      if (currentIndex >= updatedCards.length && updatedCards.length > 0) {
        newIndex = updatedCards.length - 1;
        setCurrentIndex(newIndex);
      }

      // Update URL
      if (updatedCards.length > 0) {
        updateUrlWithCard(updatedCards[newIndex].id);
      } else {
        sessionStorage.removeItem(sessionKey);
        router.replace(deckId ? `/review?deck=${deckId}` : '/review', { scroll: false });
      }

      setShowAnswer(false);
      closeEditModal();
    }

    setSaving(false);
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
              <button
                onClick={openEditModal}
                className="mt-3 text-sm text-primary hover:underline"
              >
                Edit card
              </button>
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

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-xl shadow-card border border-border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-text mb-4">Edit Card</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Spanish Word/Phrase
                </label>
                <input
                  type="text"
                  value={editSpanishWord}
                  onChange={(e) => setEditSpanishWord(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Translation
                </label>
                <input
                  type="text"
                  value={editTranslation}
                  onChange={(e) => setEditTranslation(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Context Sentence
                </label>
                <textarea
                  value={editContextSentence}
                  onChange={(e) => setEditContextSentence(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Cloze Sentence
                </label>
                <textarea
                  value={editClozeSentence}
                  onChange={(e) => setEditClozeSentence(e.target.value)}
                  rows={2}
                  placeholder="Use {{c1::word}} for cloze deletion"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-text-muted mt-1">
                  Wrap the word to hide with {"{{c1::word}}"}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editSpanishWord || !editTranslation}
                  className="flex-1 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={closeEditModal}
                  className="px-6 py-2 border border-border text-text rounded-lg hover:bg-background transition"
                >
                  Cancel
                </button>
              </div>

              <div className="pt-4 border-t border-border">
                <button
                  onClick={handleDeleteCard}
                  disabled={saving}
                  className={`w-full py-2 rounded-lg transition ${
                    confirmDelete
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'text-red-500 hover:bg-red-500/10'
                  }`}
                >
                  {confirmDelete ? 'Click again to confirm delete' : 'Delete Card'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
