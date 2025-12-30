'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  StepIndicator,
  SelectableCard,
  ConjugationSection,
  Card,
  CardHeader,
  CardContent,
} from '../components';

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
  const [sentence, setSentence] = useState(searchParams.get('sentence') || '');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('input');

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [phrases, setPhrases] = useState<WordItem[]>([]);
  const [words, setWords] = useState<WordItem[]>([]);
  const [selectedConjugations, setSelectedConjugations] = useState<Set<string>>(new Set());
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

  const steps = [
    { name: 'Enter Text', status: step === 'input' ? 'current' : 'complete' },
    { name: 'Select Words', status: step === 'select' ? 'current' : step === 'preview' ? 'complete' : 'upcoming' },
    { name: 'Review Cards', status: step === 'preview' ? 'current' : 'upcoming' },
  ] as const;

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
    setPhrases(data.phrases.map((p) => ({ ...p, selected: false, extraSentences: 1 })));
    setWords(data.words.map((w) => ({ ...w, selected: false, extraSentences: 1 })));
    setSelectedConjugations(new Set());
    setLoading(false);
    setStep('select');
  }

  function toggleConjugation(tense: string, index: number) {
    const key = `${tense}-${index}`;
    setSelectedConjugations((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  }

  function toggleItem(type: 'phrase' | 'word', index: number) {
    if (type === 'phrase') {
      setPhrases((prev) => prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p)));
    } else {
      setWords((prev) => prev.map((w, i) => (i === index ? { ...w, selected: !w.selected } : w)));
    }
  }

  function setExtraSentences(type: 'phrase' | 'word', index: number, count: number) {
    if (type === 'phrase') {
      setPhrases((prev) => prev.map((p, i) => (i === index ? { ...p, extraSentences: count } : p)));
    } else {
      setWords((prev) => prev.map((w, i) => (i === index ? { ...w, extraSentences: count } : w)));
    }
  }

  async function generateCards() {
    const selectedItems = [...phrases.filter((p) => p.selected), ...words.filter((w) => w.selected)];

    const conjugationCards: CardPreview[] = [];
    if (analysis?.is_verb && analysis.conjugations) {
      const tenses = ['present', 'preterite', 'imperative'] as const;
      for (const tense of tenses) {
        const items = analysis.conjugations[tense];
        items.forEach((item, index) => {
          if (selectedConjugations.has(`${tense}-${index}`)) {
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
        body: JSON.stringify({ originalSentence: analysis?.original_sentence, selectedWords: selectedItems }),
      });
      const data = await res.json();
      wordCards = data.cards.map((card: Omit<CardPreview, 'enabled'>) => ({ ...card, enabled: true }));
    }

    setCards([...conjugationCards, ...wordCards]);
    setLoading(false);
    setStep('preview');
  }

  function toggleCard(index: number) {
    setCards((prev) => prev.map((card, i) => (i === index ? { ...card, enabled: !card.enabled } : card)));
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

  const selectedCount =
    phrases.filter((p) => p.selected).length + words.filter((w) => w.selected).length + selectedConjugations.size;
  const enabledCount = cards.filter((c) => c.enabled).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-text">Add New Words</h1>
          <Link href="/" className="text-primary hover:underline text-sm">
            ← Back to Home
          </Link>
        </div>

        {/* Step Indicator */}
        <StepIndicator steps={[...steps]} />

        {/* Step 1: Input */}
        {step === 'input' && (
          <Card>
            <CardHeader title="Enter Spanish Text" description="Paste a sentence or word you want to learn" />
            <CardContent>
              <form onSubmit={analyzeSentence} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-2">Select Deck</label>
                  <select
                    value={selectedDeck}
                    onChange={(e) => setSelectedDeck(e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {deck.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text mb-2">Spanish Sentence or Phrase</label>
                  <textarea
                    value={sentence}
                    onChange={(e) => setSentence(e.target.value)}
                    placeholder="Enter a Spanish sentence you heard..."
                    className="w-full px-4 py-3 border border-border rounded-lg bg-background text-text placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-primary h-28 resize-none"
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
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Words */}
        {step === 'select' && analysis && (
          <div className="space-y-6">
            {/* Original sentence */}
            <Card>
              <CardContent>
                <div className="text-lg font-medium text-text">{analysis.original_sentence}</div>
                <div className="text-text-secondary mt-1">{analysis.translation}</div>
                {analysis.is_verb && analysis.infinitive && (
                  <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded">
                    Verb: {analysis.infinitive}
                  </span>
                )}
              </CardContent>
            </Card>

            {/* Conjugations */}
            {analysis.is_verb && analysis.conjugations && (
              <Card>
                <CardHeader
                  title="Conjugations"
                  description="Select conjugations to create flashcards"
                />
                <CardContent className="space-y-6">
                  <ConjugationSection
                    title="Present Tense"
                    tense="present"
                    items={analysis.conjugations.present}
                    selectedKeys={selectedConjugations}
                    onToggle={toggleConjugation}
                    variant="primary"
                  />
                  <ConjugationSection
                    title="Past Tense (Preterite)"
                    tense="preterite"
                    items={analysis.conjugations.preterite}
                    selectedKeys={selectedConjugations}
                    onToggle={toggleConjugation}
                    variant="secondary"
                  />
                  <ConjugationSection
                    title="Commands (Imperative)"
                    tense="imperative"
                    items={analysis.conjugations.imperative}
                    selectedKeys={selectedConjugations}
                    onToggle={toggleConjugation}
                    variant="accent"
                  />
                </CardContent>
              </Card>
            )}

            {/* Phrases */}
            {phrases.length > 0 && (
              <Card>
                <CardHeader title="Phrases & Idioms" description="Select phrases to create flashcards" />
                <CardContent className="space-y-3">
                  {phrases.map((phrase, i) => (
                    <SelectableCard
                      key={i}
                      selected={phrase.selected}
                      onClick={() => toggleItem('phrase', i)}
                      title={
                        <span>
                          <span className="text-primary">{phrase.spanish}</span>
                          <span className="text-text-secondary ml-2">= {phrase.english}</span>
                        </span>
                      }
                      rightContent={
                        phrase.selected && (
                          <select
                            value={phrase.extraSentences}
                            onChange={(e) => setExtraSentences('phrase', i, Number(e.target.value))}
                            className="px-2 py-1 border border-border rounded text-sm bg-background text-text"
                          >
                            <option value={0}>1 card</option>
                            <option value={1}>2 cards</option>
                            <option value={2}>3 cards</option>
                          </select>
                        )
                      }
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Words */}
            {words.length > 0 && (
              <Card>
                <CardHeader title="Individual Words" description="Select words to create flashcards" />
                <CardContent className="space-y-3">
                  {words.map((word, i) => (
                    <SelectableCard
                      key={i}
                      selected={word.selected}
                      onClick={() => toggleItem('word', i)}
                      title={
                        <span>
                          <span className="text-primary">{word.spanish}</span>
                          <span className="text-text-secondary ml-2">= {word.english}</span>
                          {word.base_form && word.base_form !== word.spanish && (
                            <span className="text-text-muted ml-2 text-sm">({word.base_form})</span>
                          )}
                        </span>
                      }
                      rightContent={
                        word.selected && (
                          <select
                            value={word.extraSentences}
                            onChange={(e) => setExtraSentences('word', i, Number(e.target.value))}
                            className="px-2 py-1 border border-border rounded text-sm bg-background text-text"
                          >
                            <option value={0}>1 card</option>
                            <option value={1}>2 cards</option>
                            <option value={2}>3 cards</option>
                          </select>
                        )
                      }
                    />
                  ))}
                </CardContent>
              </Card>
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
                className="flex-1 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50"
              >
                {loading ? 'Generating...' : `Create ${selectedCount} Card${selectedCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview & Save */}
        {step === 'preview' && (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title={`Review Cards (${enabledCount} of ${cards.length})`}
                description="Toggle cards to include or exclude them"
              />
              <CardContent className="space-y-3">
                {cards.map((card, i) => (
                  <SelectableCard
                    key={i}
                    selected={card.enabled}
                    onClick={() => toggleCard(i)}
                    title={
                      <span>
                        <span className="text-primary">{card.spanish_word}</span>
                        <span className="text-text-secondary ml-2">= {card.translation}</span>
                      </span>
                    }
                    description={card.cloze_sentence}
                  />
                ))}
              </CardContent>

              {saved ? (
                <div className="px-6 py-4 border-t border-border bg-success/10">
                  <div className="flex items-center justify-between">
                    <span className="text-success font-medium">Saved {enabledCount} cards!</span>
                    <button onClick={reset} className="text-primary hover:underline">
                      Add more words
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-6 py-4 border-t border-border flex gap-4">
                  <button
                    onClick={() => setStep('select')}
                    className="flex-1 py-3 bg-surface border border-border text-text rounded-lg font-semibold hover:bg-background transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={saveCards}
                    disabled={enabledCount === 0}
                    className="flex-1 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50"
                  >
                    Save {enabledCount} Card{enabledCount !== 1 ? 's' : ''} to Deck
                  </button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
