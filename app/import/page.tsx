'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  StepIndicator,
  SelectableCard,
  Card,
  CardHeader,
  CardContent,
} from '../components';

interface Deck {
  id: string;
  name: string;
}

interface ImportPrompt {
  date: string;
  title: string;
  question: string;
  category: string;
}

interface VocabItem {
  spanish: string;
  english: string;
  base_form: string;
  selected: boolean;
  extraSentences: number;
}

interface CardPreview {
  spanish_word: string;
  translation: string;
  context_sentence: string;
  cloze_sentence: string;
  enabled: boolean;
}

interface ExtractResult {
  skippable: boolean;
  skip_reason: string | null;
  vocab: { spanish: string; english: string; base_form: string }[];
  spanish_sentences: string[];
}

type Step = 'upload' | 'process' | 'done';
type SubStep = 'extracting' | 'selecting' | 'generating' | 'previewing';

export default function ImportPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState('');
  const [step, setStep] = useState<Step>('upload');

  // Upload state
  const [prompts, setPrompts] = useState<ImportPrompt[]>([]);
  const [fileName, setFileName] = useState('');

  // Process state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [subStep, setSubStep] = useState<SubStep>('extracting');
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [cards, setCards] = useState<CardPreview[]>([]);
  const [spanishSentences, setSpanishSentences] = useState<string[]>([]);

  // Summary state
  const [totalSaved, setTotalSaved] = useState(0);
  const [totalSkipped, setTotalSkipped] = useState(0);

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

  const currentPrompt = prompts[currentIndex] || null;

  const stepIndicator = [
    { name: 'Upload', status: step === 'upload' ? 'current' : 'complete' },
    { name: 'Process', status: step === 'process' ? 'current' : step === 'done' ? 'complete' : 'upcoming' },
    { name: 'Done', status: step === 'done' ? 'current' : 'upcoming' },
  ] as const;

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = JSON.parse(event.target?.result as string);
      setPrompts(Array.isArray(data) ? data : []);
    };
    reader.readAsText(file);
  }

  function startImport() {
    if (prompts.length === 0 || !selectedDeck) return;
    setCurrentIndex(0);
    setTotalSaved(0);
    setTotalSkipped(0);
    setStep('process');
    extractVocab(0);
  }

  async function extractVocab(index: number) {
    const prompt = prompts[index];
    setSubStep('extracting');
    setExtractResult(null);
    setVocab([]);
    setCards([]);
    setSpanishSentences([]);

    const res = await fetch('/api/extract-vocab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: prompt.question, title: prompt.title }),
    });

    const data: ExtractResult = await res.json();
    setExtractResult(data);
    setSpanishSentences(data.spanish_sentences || []);
    const vocabItems = data.vocab || [];
    setVocab(vocabItems.map((v) => ({ ...v, selected: true, extraSentences: 1 })));
    setSubStep('selecting');
  }

  function toggleVocab(index: number) {
    setVocab((prev) => prev.map((v, i) => (i === index ? { ...v, selected: !v.selected } : v)));
  }

  function setExtraSentences(index: number, count: number) {
    setVocab((prev) => prev.map((v, i) => (i === index ? { ...v, extraSentences: count } : v)));
  }

  async function generateCards() {
    const selected = vocab.filter((v) => v.selected);
    if (selected.length === 0) return;

    setSubStep('generating');

    // Use a Spanish sentence from the question if available, otherwise use the title or question as context
    const originalSentence = spanishSentences[0] || currentPrompt?.title || currentPrompt?.question || 'Spanish vocabulary';

    const res = await fetch('/api/generate-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalSentence,
        selectedWords: selected,
        skipOriginal: true,
        userContext: currentPrompt?.question,
      }),
    });

    const data = await res.json();
    const generatedCards = data.cards || [];
    setCards(generatedCards.map((card: Omit<CardPreview, 'enabled'>) => ({ ...card, enabled: true })));
    setSubStep('previewing');
  }

  function toggleCard(index: number) {
    setCards((prev) => prev.map((card, i) => (i === index ? { ...card, enabled: !card.enabled } : card)));
  }

  async function saveAndNext() {
    const enabledCards = cards.filter((card) => card.enabled);

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

    setTotalSaved((prev) => prev + enabledCards.length);
    advanceToNext();
  }

  function skip() {
    setTotalSkipped((prev) => prev + 1);
    advanceToNext();
  }

  function advanceToNext() {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= prompts.length) {
      setStep('done');
    } else {
      setCurrentIndex(nextIndex);
      extractVocab(nextIndex);
    }
  }

  const selectedCount = vocab.filter((v) => v.selected).length;
  const enabledCount = cards.filter((c) => c.enabled).length;

  // Upload summary stats
  const dateRange =
    prompts.length > 0
      ? (() => {
          const dates = prompts.map((p) => p.date).filter(Boolean).sort();
          if (dates.length === 0) return '';
          const first = new Date(dates[0]).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          const last = new Date(dates[dates.length - 1]).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          return first === last ? first : `${first} – ${last}`;
        })()
      : '';

  const categoryBreakdown = prompts.reduce(
    (acc, p) => {
      const cat = p.category || 'uncategorized';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-text">Import Prompts</h1>
          <Link href="/" className="text-primary hover:underline text-sm">
            ← Back to Home
          </Link>
        </div>

        {/* Step Indicator */}
        <StepIndicator steps={[...stepIndicator]} />

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <Card>
            <CardHeader
              title="Upload JSON File"
              description="Select your ChatGPT Spanish prompts export file"
            />
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-2">JSON File</label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-text file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-medium file:cursor-pointer"
                  />
                  {fileName && (
                    <p className="text-sm text-text-muted mt-1">{fileName}</p>
                  )}
                </div>

                {prompts.length > 0 && (
                  <div className="p-4 bg-surface rounded-lg border border-border">
                    <p className="font-medium text-text">
                      Found {prompts.length} prompts
                      {dateRange && <span className="text-text-secondary"> ({dateRange})</span>}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(categoryBreakdown).map(([cat, count]) => (
                        <span
                          key={cat}
                          className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded"
                        >
                          {cat} ({count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-text mb-2">Target Deck</label>
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

                <button
                  onClick={startImport}
                  disabled={prompts.length === 0 || !selectedDeck}
                  className="w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50"
                >
                  Start Import →
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Process */}
        {step === 'process' && currentPrompt && (
          <div className="space-y-6">
            {/* Progress */}
            <div className="text-center">
              <div className="text-sm text-text-muted mb-1">
                {currentIndex + 1} of {prompts.length}
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${((currentIndex + 1) / prompts.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Current prompt */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
                  {currentPrompt.date && (
                    <span>
                      {new Date(currentPrompt.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                  {currentPrompt.date && currentPrompt.category && <span>·</span>}
                  {currentPrompt.category && <span>{currentPrompt.category}</span>}
                </div>
                <div className="text-lg font-medium text-text mb-2">{currentPrompt.title}</div>
                <div className="text-text-secondary">&ldquo;{currentPrompt.question}&rdquo;</div>
              </CardContent>
            </Card>

            {/* Extracting */}
            {subStep === 'extracting' && (
              <Card>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="text-text-muted">Extracting vocabulary...</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Skippable prompt */}
            {subStep === 'selecting' && extractResult?.skippable && vocab.length === 0 && (
              <Card>
                <CardContent>
                  <div className="text-center py-6">
                    <p className="text-text-muted mb-4">
                      {extractResult.skip_reason || 'No vocabulary to extract from this prompt.'}
                    </p>
                    <button
                      onClick={skip}
                      className="px-6 py-2 bg-surface border border-border text-text rounded-lg font-medium hover:bg-background transition"
                    >
                      Skip →
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selecting vocab */}
            {subStep === 'selecting' && vocab.length > 0 && (
              <>
                <Card>
                  <CardHeader
                    title="Extracted Vocabulary"
                    description="Select words you want to learn"
                  />
                  <CardContent className="space-y-3">
                    {vocab.map((item, i) => (
                      <SelectableCard
                        key={i}
                        selected={item.selected}
                        onClick={() => toggleVocab(i)}
                        title={
                          <span>
                            <span className="text-primary">{item.spanish}</span>
                            <span className="text-text-secondary ml-2">= {item.english}</span>
                            {item.base_form && item.base_form !== item.spanish && (
                              <span className="text-text-muted ml-2 text-sm">({item.base_form})</span>
                            )}
                          </span>
                        }
                        rightContent={
                          item.selected && (
                            <select
                              value={item.extraSentences}
                              onChange={(e) => setExtraSentences(i, Number(e.target.value))}
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

                <div className="flex gap-4">
                  <button
                    onClick={skip}
                    className="flex-1 py-3 bg-surface border border-border text-text rounded-lg font-semibold hover:bg-background transition"
                  >
                    Skip
                  </button>
                  <button
                    onClick={generateCards}
                    disabled={selectedCount === 0}
                    className="flex-1 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50"
                  >
                    Generate Cards for {selectedCount} word{selectedCount !== 1 ? 's' : ''} →
                  </button>
                </div>
              </>
            )}

            {/* Generating */}
            {subStep === 'generating' && (
              <Card>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="text-text-muted">Generating cards...</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Previewing cards */}
            {subStep === 'previewing' && (
              <>
                <Card>
                  <CardHeader
                    title={`Preview (${enabledCount} of ${cards.length})`}
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
                </Card>

                <div className="flex gap-4">
                  <button
                    onClick={skip}
                    className="flex-1 py-3 bg-surface border border-border text-text rounded-lg font-semibold hover:bg-background transition"
                  >
                    Skip
                  </button>
                  <button
                    onClick={saveAndNext}
                    disabled={enabledCount === 0}
                    className="flex-1 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50"
                  >
                    Save & Next →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <Card>
            <CardContent>
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold text-text mb-2">Import Complete!</h2>
                <p className="text-text-secondary mb-8">
                  Created {totalSaved} cards from {prompts.length - totalSkipped} prompts
                  {totalSkipped > 0 && ` (${totalSkipped} skipped)`}
                </p>
                <div className="flex justify-center gap-4">
                  <Link
                    href="/"
                    className="px-6 py-3 bg-surface border border-border text-text rounded-lg font-semibold hover:bg-background transition"
                  >
                    ← Back to Home
                  </Link>
                  {selectedDeck && (
                    <Link
                      href={`/review?deck=${selectedDeck}`}
                      className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition"
                    >
                      Review Cards →
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
