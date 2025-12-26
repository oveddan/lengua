'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Deck {
  id: string;
  name: string;
}

interface WordItem {
  spanish: string;
  english: string;
  base_form: string;
  selected: boolean;
  extraSentences: number;
}

interface ConjugationItem {
  pronoun: string;
  form: string;
  sentence: string;
  sentence_english: string;
}

interface Conjugations {
  present: ConjugationItem[];
  preterite: ConjugationItem[];
  imperative: ConjugationItem[];
}

interface AnalysisResult {
  original_sentence: string;
  translation: string;
  phrases: { spanish: string; english: string; base_form: string }[];
  words: { spanish: string; english: string; base_form: string }[];
  is_verb?: boolean;
  infinitive?: string;
  conjugations?: Conjugations;
}

interface CardPreview {
  spanish_word: string;
  translation: string;
  context_sentence: string;
  cloze_sentence: string;
  enabled: boolean;
}

type Step = 'input' | 'select' | 'preview';

export default function AddPage() {
  const searchParams = useSearchParams();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState(searchParams.get('deck') || '');
  const [sentence, setSentence] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('input');

  // Analysis results
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [phrases, setPhrases] = useState<WordItem[]>([]);
  const [words, setWords] = useState<WordItem[]>([]);

  // Selected conjugations (for verbs)
  const [selectedConjugations, setSelectedConjugations] = useState<Set<string>>(new Set());

  // Generated cards
  const [cards, setCards] = useState<CardPreview[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/decks')
      .then((res) => res.json())
      .then((data) => {
        setDecks(data.decks);
        if (!selectedDeck && data.decks.length > 0) {
          setSelectedDeck(data.decks[0].id);
        }
      });
  }, [selectedDeck]);

  async function analyzeSentence(e: React.FormEvent) {
    e.preventDefault();
    if (!sentence.trim()) return;

    setLoading(true);

    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence }),
    });

    const data: AnalysisResult = await res.json();
    setAnalysis(data);

    // Initialize phrases and words with selection state
    setPhrases(
      data.phrases.map((p) => ({
        ...p,
        selected: false,
        extraSentences: 1,
      }))
    );
    setWords(
      data.words.map((w) => ({
        ...w,
        selected: false,
        extraSentences: 1,
      }))
    );

    setSelectedConjugations(new Set());
    setLoading(false);
    setStep('select');
  }

  function toggleConjugation(tense: string, index: number) {
    const key = `${tense}-${index}`;
    setSelectedConjugations((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }

  function toggleItem(type: 'phrase' | 'word', index: number) {
    if (type === 'phrase') {
      setPhrases((prev) =>
        prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p))
      );
    } else {
      setWords((prev) =>
        prev.map((w, i) => (i === index ? { ...w, selected: !w.selected } : w))
      );
    }
  }

  function setExtraSentences(type: 'phrase' | 'word', index: number, count: number) {
    if (type === 'phrase') {
      setPhrases((prev) =>
        prev.map((p, i) => (i === index ? { ...p, extraSentences: count } : p))
      );
    } else {
      setWords((prev) =>
        prev.map((w, i) => (i === index ? { ...w, extraSentences: count } : w))
      );
    }
  }

  async function generateCards() {
    const selectedItems = [
      ...phrases.filter((p) => p.selected),
      ...words.filter((w) => w.selected),
    ];

    // Build conjugation cards directly (no API call needed)
    const conjugationCards: CardPreview[] = [];
    if (analysis?.is_verb && analysis.conjugations) {
      const tenses = ['present', 'preterite', 'imperative'] as const;
      for (const tense of tenses) {
        const items = analysis.conjugations[tense];
        items.forEach((item, index) => {
          if (selectedConjugations.has(`${tense}-${index}`)) {
            // Create cloze from sentence - escape special regex chars and use lookaround for word boundaries
            const escaped = item.form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const cloze = item.sentence.replace(
              new RegExp(`(^|[\\s¿¡])${escaped}([\\s.,!?;:]|$)`, 'gi'),
              `$1{{c1::${item.form}}}$2`
            );
            conjugationCards.push({
              spanish_word: `${analysis.infinitive} (${item.pronoun} ${tense})`,
              translation: item.sentence_english,
              context_sentence: item.sentence,
              cloze_sentence: cloze,
              enabled: true,
            });
          }
        });
      }
    }

    if (selectedItems.length === 0 && conjugationCards.length === 0) return;

    setLoading(true);

    let wordCards: CardPreview[] = [];
    if (selectedItems.length > 0) {
      const res = await fetch('/api/generate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalSentence: analysis?.original_sentence,
          selectedWords: selectedItems,
        }),
      });

      const data = await res.json();
      wordCards = data.cards.map((card: Omit<CardPreview, 'enabled'>) => ({ ...card, enabled: true }));
    }

    // Combine conjugation cards and word cards
    setCards([...conjugationCards, ...wordCards]);
    setLoading(false);
    setStep('preview');
  }

  function toggleCard(index: number) {
    setCards((prev) =>
      prev.map((card, i) => (i === index ? { ...card, enabled: !card.enabled } : card))
    );
  }

  async function saveCards() {
    const enabledCards = cards.filter((card) => card.enabled);
    if (!enabledCards.length || !selectedDeck) return;

    for (const card of enabledCards) {
      await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deck_id: selectedDeck,
          spanish_word: card.spanish_word,
          translation: card.translation,
          context_sentence: card.context_sentence,
          cloze_sentence: card.cloze_sentence,
        }),
      });
    }

    setSaved(true);
  }

  function reset() {
    setStep('input');
    setSentence('');
    setAnalysis(null);
    setPhrases([]);
    setWords([]);
    setSelectedConjugations(new Set());
    setCards([]);
    setSaved(false);
  }

  const selectedCount = phrases.filter((p) => p.selected).length + words.filter((w) => w.selected).length + selectedConjugations.size;
  const enabledCount = cards.filter((c) => c.enabled).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-text">Add New Words</h1>
          <Link href="/" className="text-primary hover:underline">
            ← Back to Home
          </Link>
        </div>

        {/* Step 1: Input */}
        {step === 'input' && (
          <form onSubmit={analyzeSentence} className="bg-surface p-6 rounded-lg shadow-card border border-border">
            <div className="mb-4">
              <label className="block text-sm font-medium text-text mb-2">Select Deck</label>
              <select
                value={selectedDeck}
                onChange={(e) => setSelectedDeck(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-text bg-surface"
              >
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-text mb-2">
                Spanish Sentence or Phrase
              </label>
              <textarea
                value={sentence}
                onChange={(e) => setSentence(e.target.value)}
                placeholder="Enter a Spanish sentence you heard..."
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary h-24 text-text bg-surface placeholder:text-text-placeholder"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !sentence.trim()}
              className="w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Analyze Sentence'}
            </button>
          </form>
        )}

        {/* Step 2: Select Words */}
        {step === 'select' && analysis && (
          <div className="space-y-6">
            {/* Original sentence/word */}
            <div className="bg-surface p-6 rounded-lg shadow-card border border-border">
              <div className="text-lg font-medium text-text">{analysis.original_sentence}</div>
              <div className="text-text-secondary mt-1">{analysis.translation}</div>
              {analysis.is_verb && analysis.infinitive && (
                <div className="text-sm text-primary mt-2">Verb: {analysis.infinitive}</div>
              )}
            </div>

            {/* Conjugations (for verbs) */}
            {analysis.is_verb && analysis.conjugations && (
              <div className="bg-surface p-6 rounded-lg shadow-card border border-border">
                <h2 className="text-lg font-semibold text-text mb-4">Conjugations with Examples</h2>
                <p className="text-sm text-text-muted mb-4">Click to select sentences for flashcards</p>
                <div className="space-y-6">
                  {/* Present */}
                  <div>
                    <h3 className="font-medium text-primary mb-3">Present Tense</h3>
                    <div className="space-y-2">
                      {analysis.conjugations.present.map((item, i) => (
                        <div
                          key={i}
                          onClick={() => toggleConjugation('present', i)}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                            selectedConjugations.has(`present-${i}`)
                              ? 'border-primary bg-primary/10'
                              : 'border-border bg-background hover:border-text-muted'
                          }`}
                        >
                          <div className="flex gap-3 items-start">
                            <input
                              type="checkbox"
                              checked={selectedConjugations.has(`present-${i}`)}
                              onChange={() => toggleConjugation('present', i)}
                              className="mt-1 w-4 h-4 accent-primary"
                            />
                            <div className="flex-1">
                              <div className="flex gap-2 items-baseline">
                                <span className="text-text-muted text-sm w-24">{item.pronoun}</span>
                                <span className="text-primary font-medium">{item.form}</span>
                              </div>
                              <div className="mt-1 text-sm">
                                <span className="text-text">{item.sentence}</span>
                                <span className="text-text-muted ml-2">({item.sentence_english})</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Preterite */}
                  <div>
                    <h3 className="font-medium text-secondary mb-3">Past Tense (Preterite)</h3>
                    <div className="space-y-2">
                      {analysis.conjugations.preterite.map((item, i) => (
                        <div
                          key={i}
                          onClick={() => toggleConjugation('preterite', i)}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                            selectedConjugations.has(`preterite-${i}`)
                              ? 'border-secondary bg-secondary/10'
                              : 'border-border bg-background hover:border-text-muted'
                          }`}
                        >
                          <div className="flex gap-3 items-start">
                            <input
                              type="checkbox"
                              checked={selectedConjugations.has(`preterite-${i}`)}
                              onChange={() => toggleConjugation('preterite', i)}
                              className="mt-1 w-4 h-4 accent-secondary"
                            />
                            <div className="flex-1">
                              <div className="flex gap-2 items-baseline">
                                <span className="text-text-muted text-sm w-24">{item.pronoun}</span>
                                <span className="text-secondary font-medium">{item.form}</span>
                              </div>
                              <div className="mt-1 text-sm">
                                <span className="text-text">{item.sentence}</span>
                                <span className="text-text-muted ml-2">({item.sentence_english})</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Imperative */}
                  <div>
                    <h3 className="font-medium text-accent mb-3">Commands (Imperative)</h3>
                    <div className="space-y-2">
                      {analysis.conjugations.imperative.map((item, i) => (
                        <div
                          key={i}
                          onClick={() => toggleConjugation('imperative', i)}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                            selectedConjugations.has(`imperative-${i}`)
                              ? 'border-accent bg-accent/10'
                              : 'border-border bg-background hover:border-text-muted'
                          }`}
                        >
                          <div className="flex gap-3 items-start">
                            <input
                              type="checkbox"
                              checked={selectedConjugations.has(`imperative-${i}`)}
                              onChange={() => toggleConjugation('imperative', i)}
                              className="mt-1 w-4 h-4 accent-accent"
                            />
                            <div className="flex-1">
                              <div className="flex gap-2 items-baseline">
                                <span className="text-text-muted text-sm w-24">{item.pronoun}</span>
                                <span className="text-accent font-medium">{item.form}</span>
                              </div>
                              <div className="mt-1 text-sm">
                                <span className="text-text">{item.sentence}</span>
                                <span className="text-text-muted ml-2">({item.sentence_english})</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Phrases */}
            {phrases.length > 0 && (
              <div className="bg-surface p-6 rounded-lg shadow-card border border-border">
                <h2 className="text-lg font-semibold text-text mb-4">Phrases & Idioms</h2>
                <div className="space-y-3">
                  {phrases.map((phrase, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                        phrase.selected
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-text-muted'
                      }`}
                      onClick={() => toggleItem('phrase', i)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={phrase.selected}
                            onChange={() => toggleItem('phrase', i)}
                            className="w-5 h-5 accent-primary"
                          />
                          <div>
                            <span className="font-medium text-primary">{phrase.spanish}</span>
                            <span className="text-text-secondary ml-2">= {phrase.english}</span>
                          </div>
                        </div>
                        {phrase.selected && (
                          <select
                            value={phrase.extraSentences}
                            onChange={(e) => {
                              e.stopPropagation();
                              setExtraSentences('phrase', i, Number(e.target.value));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-1 border border-border rounded text-sm bg-surface text-text"
                          >
                            <option value={0}>1 card (original only)</option>
                            <option value={1}>2 cards (+1 example)</option>
                            <option value={2}>3 cards (+2 examples)</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Words */}
            {words.length > 0 && (
              <div className="bg-surface p-6 rounded-lg shadow-card border border-border">
                <h2 className="text-lg font-semibold text-text mb-4">Individual Words</h2>
                <div className="space-y-3">
                  {words.map((word, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                        word.selected
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-text-muted'
                      }`}
                      onClick={() => toggleItem('word', i)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={word.selected}
                            onChange={() => toggleItem('word', i)}
                            className="w-5 h-5 accent-primary"
                          />
                          <div>
                            <span className="font-medium text-primary">{word.spanish}</span>
                            <span className="text-text-secondary ml-2">= {word.english}</span>
                            {word.base_form && word.base_form !== word.spanish && (
                              <span className="text-text-muted ml-2 text-sm">({word.base_form})</span>
                            )}
                          </div>
                        </div>
                        {word.selected && (
                          <select
                            value={word.extraSentences}
                            onChange={(e) => {
                              e.stopPropagation();
                              setExtraSentences('word', i, Number(e.target.value));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-1 border border-border rounded text-sm bg-surface text-text"
                          >
                            <option value={0}>1 card (original only)</option>
                            <option value={1}>2 cards (+1 example)</option>
                            <option value={2}>3 cards (+2 examples)</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={reset}
                className="flex-1 py-3 bg-surface border border-border text-text rounded-lg font-semibold hover:bg-background transition"
              >
                ← Start Over
              </button>
              <button
                onClick={generateCards}
                disabled={loading || selectedCount === 0}
                className="flex-1 py-3 bg-secondary text-white rounded-lg font-semibold hover:bg-secondary-hover transition disabled:opacity-50"
              >
                {loading ? 'Generating...' : `Create Cards for ${selectedCount} item${selectedCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview & Save */}
        {step === 'preview' && (
          <div className="space-y-6">
            <div className="bg-surface p-6 rounded-lg shadow-card border border-border">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-text">
                  Cards to Create ({enabledCount} of {cards.length})
                </h2>
                <span className="text-sm text-text-muted">Click to toggle</span>
              </div>

              <div className="space-y-3 mb-6">
                {cards.map((card, i) => (
                  <div
                    key={i}
                    onClick={() => toggleCard(i)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                      card.enabled
                        ? 'border-primary bg-primary/10'
                        : 'border-border opacity-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={card.enabled}
                        onChange={() => toggleCard(i)}
                        className="w-5 h-5 mt-0.5 accent-primary"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-primary">
                          {card.spanish_word} = {card.translation}
                        </div>
                        <div className="text-sm text-text-secondary mt-1">
                          {card.cloze_sentence}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {saved ? (
                <div className="p-4 bg-success-light text-success rounded-lg text-center">
                  Saved {enabledCount} cards!
                  <button onClick={reset} className="ml-4 underline">
                    Add more
                  </button>
                </div>
              ) : (
                <div className="flex gap-4">
                  <button
                    onClick={() => setStep('select')}
                    className="flex-1 py-3 bg-surface border border-border text-text rounded-lg font-semibold hover:bg-background transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={saveCards}
                    disabled={enabledCount === 0}
                    className="flex-1 py-3 bg-secondary text-white rounded-lg font-semibold hover:bg-secondary-hover transition disabled:opacity-50"
                  >
                    Save {enabledCount} Card{enabledCount !== 1 ? 's' : ''} to Deck
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
