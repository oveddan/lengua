'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface ButtonPreview {
  label: string;
  interval: string;
  scheduledSecs?: number;
  scheduledDays?: number;
}

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
  queue: number;
  learning_step: number;
  lapses: number;
}

type Quality = 'again' | 'hard' | 'good' | 'easy';

// Queue constants (match Anki)
const CardQueue = {
  New: 0,
  Learning: 1,
  Review: 2,
  Relearning: 3,
} as const;

export default function ReviewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const deckId = searchParams.get('deck');
  const sessionId = searchParams.get('session');
  const studyAheadParam = searchParams.get('studyAhead') === 'true';

  const [cards, setCards] = useState<Card[]>([]);
  const [learningCards, setLearningCards] = useState<Map<string, { card: Card; dueAt: Date }>>(new Map());
  const [deckName, setDeckName] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [buttonPreviews, setButtonPreviews] = useState<Record<Quality, ButtonPreview> | null>(null);
  const [studyAheadMode, setStudyAheadMode] = useState(studyAheadParam);
  const [studyAheadAvailable, setStudyAheadAvailable] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSpanishWord, setEditSpanishWord] = useState('');
  const [editTranslation, setEditTranslation] = useState('');
  const [editContextSentence, setEditContextSentence] = useState('');
  const [editClozeSentence, setEditClozeSentence] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Timer for learning cards
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [learningCountdown, setLearningCountdown] = useState<number | null>(null);

  // Create a new review session
  async function createSession(studyAhead: boolean = false): Promise<string | null> {
    const res = await fetch('/api/review-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deckId: deckId || null,
        studyAhead,
      }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.id;
  }

  // Update session progress on the server
  async function updateSessionProgress(index: number) {
    if (!currentSessionId) return;

    await fetch(`/api/review-sessions?id=${currentSessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentIndex: index }),
    });
  }

  // Start study ahead mode
  async function startStudyAhead() {
    setLoading(true);
    const newSessionId = await createSession(true);
    if (newSessionId) {
      const params = new URLSearchParams();
      if (deckId) params.set('deck', deckId);
      params.set('session', newSessionId);
      params.set('studyAhead', 'true');
      router.replace(`/review?${params.toString()}`);
    } else {
      setLoading(false);
    }
  }

  // Check for due learning cards and add them to the queue
  const checkLearningCards = useCallback(() => {
    const now = new Date();
    const dueCards: Card[] = [];
    const stillLearning = new Map(learningCards);

    learningCards.forEach((entry, cardId) => {
      if (entry.dueAt <= now) {
        dueCards.push(entry.card);
        stillLearning.delete(cardId);
      }
    });

    if (dueCards.length > 0) {
      setLearningCards(stillLearning);
      setCards(prev => {
        // Add due cards to the end, avoiding duplicates
        const existingIds = new Set(prev.map(c => c.id));
        const newCards = dueCards.filter(c => !existingIds.has(c.id));
        return [...prev, ...newCards];
      });
    }

    // Update countdown for next due learning card
    if (stillLearning.size > 0) {
      let nextDue = Infinity;
      stillLearning.forEach(entry => {
        const timeUntilDue = entry.dueAt.getTime() - now.getTime();
        if (timeUntilDue < nextDue) {
          nextDue = timeUntilDue;
        }
      });
      setLearningCountdown(Math.max(0, Math.ceil(nextDue / 1000)));
    } else {
      setLearningCountdown(null);
    }
  }, [learningCards]);

  // Set up timer for learning cards
  useEffect(() => {
    if (learningCards.size > 0) {
      timerRef.current = setInterval(() => {
        checkLearningCards();
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [learningCards, checkLearningCards]);

  // Fetch button previews when card changes
  useEffect(() => {
    async function fetchPreviews() {
      if (cards.length === 0 || currentIndex >= cards.length) return;

      const card = cards[currentIndex];
      const res = await fetch(`/api/review?cardId=${card.id}`);
      if (res.ok) {
        const data = await res.json();
        setButtonPreviews(data.previews);
      }
    }

    fetchPreviews();
  }, [cards, currentIndex]);

  // Main effect: load session or create one
  useEffect(() => {
    let cancelled = false;

    async function loadOrCreateSession() {
      // Fetch deck name if filtering by deck
      if (deckId) {
        const decksRes = await fetch('/api/decks');
        const decksData = await decksRes.json();
        const deck = decksData.decks.find((d: { id: string; name: string }) => d.id === deckId);
        if (deck && !cancelled) setDeckName(deck.name);
      }

      // If we have a session ID, load it
      if (sessionId) {
        const res = await fetch(`/api/review-sessions?id=${sessionId}`);
        if (!res.ok) {
          // Session expired or invalid, redirect to create a new one
          const params = new URLSearchParams();
          if (deckId) params.set('deck', deckId);
          if (studyAheadParam) params.set('studyAhead', 'true');
          router.replace(`/review?${params.toString()}`);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        setCards(data.cards);
        setCurrentIndex(data.currentIndex);
        setStudyAheadMode(data.studyAhead);
        setCurrentSessionId(sessionId);
        setLoading(false);
        return;
      }

      // No session ID - check if there are cards available
      const dueUrl = deckId ? `/api/cards?due=true&deckId=${deckId}` : '/api/cards?due=true';
      const dueRes = await fetch(dueUrl);
      const dueCards: Card[] = await dueRes.json();

      if (cancelled) return;

      if (studyAheadParam) {
        // Create study ahead session
        const newSessionId = await createSession(true);
        if (newSessionId && !cancelled) {
          const params = new URLSearchParams();
          if (deckId) params.set('deck', deckId);
          params.set('session', newSessionId);
          params.set('studyAhead', 'true');
          router.replace(`/review?${params.toString()}`);
        } else if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      if (dueCards.length > 0) {
        // Create normal review session
        const newSessionId = await createSession(false);
        if (newSessionId && !cancelled) {
          const params = new URLSearchParams();
          if (deckId) params.set('deck', deckId);
          params.set('session', newSessionId);
          router.replace(`/review?${params.toString()}`);
        } else if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      // No due cards - check study ahead availability
      const aheadUrl = deckId
        ? `/api/cards?studyAhead=true&deckId=${deckId}`
        : '/api/cards?studyAhead=true';
      const aheadRes = await fetch(aheadUrl);
      const aheadCards: Card[] = await aheadRes.json();
      if (!cancelled) {
        setStudyAheadAvailable(aheadCards.length);
        setLoading(false);
      }
    }

    loadOrCreateSession();

    return () => {
      cancelled = true;
    };
  }, [deckId, sessionId, studyAheadParam, router]);

  async function handleReview(quality: Quality) {
    const card = cards[currentIndex];
    setReviewing(true);

    const res = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: card.id, quality }),
    });

    const updatedCard = await res.json();

    setReviewing(false);
    setShowAnswer(false);

    // Check if this card is now a learning/relearning card
    const isLearning = updatedCard.queue === CardQueue.Learning ||
                       updatedCard.queue === CardQueue.Relearning;

    if (isLearning && updatedCard.scheduledSecs) {
      // Add to learning cards map with due time
      const dueAt = new Date(Date.now() + updatedCard.scheduledSecs * 1000);
      setLearningCards(prev => {
        const next = new Map(prev);
        next.set(updatedCard.id, { card: updatedCard, dueAt });
        return next;
      });
    }

    // Remove current card from the main queue
    const remainingCards = cards.filter((_, i) => i !== currentIndex);

    if (remainingCards.length > 0) {
      setCards(remainingCards);
      // Adjust index if needed
      const newIndex = currentIndex >= remainingCards.length
        ? remainingCards.length - 1
        : currentIndex;
      setCurrentIndex(newIndex);
      updateSessionProgress(newIndex);
    } else if (learningCards.size > 0 || isLearning) {
      // No cards in queue, but we have learning cards waiting
      setCards([]);
      // Timer will add them back when due
    } else {
      // All cards reviewed and no learning cards - delete session and go home
      if (currentSessionId) {
        await fetch(`/api/review-sessions?id=${currentSessionId}`, {
          method: 'DELETE',
        });
      }
      router.replace('/');
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

      // Adjust index if needed
      let newIndex = currentIndex;
      if (currentIndex >= updatedCards.length && updatedCards.length > 0) {
        newIndex = updatedCards.length - 1;
        setCurrentIndex(newIndex);
      }
      updateSessionProgress(newIndex);

      if (updatedCards.length === 0) {
        // No more cards, delete session and go home
        if (currentSessionId) {
          await fetch(`/api/review-sessions?id=${currentSessionId}`, {
            method: 'DELETE',
          });
        }
        router.replace('/');
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
    return <div className="min-h-screen bg-background p-4 sm:p-8 text-center text-text">Loading...</div>;
  }

  // Show waiting screen if we have learning cards but no cards in queue
  if (cards.length === 0 && learningCards.size > 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">&#x23F3;</div>
          <h1 className="text-2xl font-bold text-text mb-2">Waiting for cards...</h1>
          <p className="text-text-secondary mb-4">
            {learningCards.size} card{learningCards.size > 1 ? 's' : ''} in learning
          </p>
          {learningCountdown !== null && (
            <p className="text-xl font-mono text-primary">
              Next card in: {Math.floor(learningCountdown / 60)}:{(learningCountdown % 60).toString().padStart(2, '0')}
            </p>
          )}
          <Link href="/" className="text-primary hover:underline mt-4 block">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">&#127881;</div>
          <h1 className="text-2xl font-bold text-text mb-2">All caught up!</h1>
          <p className="text-text-secondary mb-4">
            No cards due for review{deckName ? ` in ${deckName}` : ''}.
          </p>

          {studyAheadAvailable > 0 && (
            <button
              onClick={startStudyAhead}
              className="mb-4 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition"
            >
              Study Ahead ({studyAheadAvailable} cards)
            </button>
          )}

          <div>
            <Link href="/" className="text-primary hover:underline">
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const card = cards[currentIndex];
  const totalCards = cards.length + learningCards.size;
  const progress = ((cards.length - currentIndex) / totalCards) * 100;

  // Determine card state for display
  const isLearning = card.queue === CardQueue.Learning || card.queue === CardQueue.Relearning;
  const isNew = card.queue === CardQueue.New;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-8">
        <div className="flex justify-between items-center mb-4">
          <Link href="/" className="text-primary hover:underline">
            &larr; Back
          </Link>
          <div className="text-right">
            {deckName && <div className="text-sm text-text-muted">{deckName}</div>}
            <div className="flex items-center gap-2">
              {studyAheadMode && (
                <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                  Study Ahead
                </span>
              )}
              {learningCards.size > 0 && (
                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                  {learningCards.size} learning
                </span>
              )}
              <span className="text-text-secondary">
                {currentIndex + 1} / {cards.length}
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-border rounded-full mb-4 sm:mb-8">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${100 - progress}%` }}
          />
        </div>

        {/* Card */}
        <div className="bg-surface rounded-xl shadow-card border border-border p-4 sm:p-8 mb-4 sm:mb-8">
          {/* Card state badge */}
          <div className="flex justify-between items-center mb-4">
            <div>
              {isNew && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                  New
                </span>
              )}
              {isLearning && (
                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                  {card.queue === CardQueue.Learning ? 'Learning' : 'Relearning'}
                </span>
              )}
            </div>
            {card.lapses > 0 && (
              <span className="text-xs text-text-muted">
                Lapses: {card.lapses}
              </span>
            )}
          </div>

          {/* Hint - English meaning */}
          <div className="text-center mb-4 pb-4 border-b border-border">
            <div className="text-text-muted">{card.translation}</div>
          </div>

          {/* Cloze sentence */}
          <div
            className="text-xl sm:text-2xl text-center mb-6 leading-relaxed text-text"
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
          <div className="grid grid-cols-4 gap-2 pb-[env(safe-area-inset-bottom)]">
            <button
              onClick={() => handleReview('again')}
              disabled={reviewing}
              className="py-3 sm:py-4 bg-again text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              <div className="text-base sm:text-lg">Again</div>
              <div className="text-xs opacity-75">
                {buttonPreviews?.again?.interval || '...'}
              </div>
            </button>
            <button
              onClick={() => handleReview('hard')}
              disabled={reviewing}
              className="py-3 sm:py-4 bg-hard text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              <div className="text-base sm:text-lg">Hard</div>
              <div className="text-xs opacity-75">
                {buttonPreviews?.hard?.interval || '...'}
              </div>
            </button>
            <button
              onClick={() => handleReview('good')}
              disabled={reviewing}
              className="py-3 sm:py-4 bg-good text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              <div className="text-base sm:text-lg">Good</div>
              <div className="text-xs opacity-75">
                {buttonPreviews?.good?.interval || '...'}
              </div>
            </button>
            <button
              onClick={() => handleReview('easy')}
              disabled={reviewing}
              className="py-3 sm:py-4 bg-easy text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              <div className="text-base sm:text-lg">Easy</div>
              <div className="text-xs opacity-75">
                {buttonPreviews?.easy?.interval || '...'}
              </div>
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
