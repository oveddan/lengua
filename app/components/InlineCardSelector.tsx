'use client';

import { SelectableCard } from './SelectableCard';

export interface WordItem {
  spanish: string;
  english: string;
  base_form: string;
  selected: boolean;
}

export interface AnalysisResult {
  original_sentence: string;
  translation: string;
  phrases: { spanish: string; english: string; base_form: string }[];
  words: { spanish: string; english: string; base_form: string }[];
}

export interface CardPreview {
  spanish_word: string;
  translation: string;
  context_sentence: string;
  cloze_sentence: string;
  enabled: boolean;
}

export interface ConjugationItem {
  pronoun: string;
  form: string;
  sentence: string;
  sentence_english: string;
}

export interface VerbConjugations {
  infinitive: string;
  translation: string;
  present: ConjugationItem[];
  preterite: ConjugationItem[];
  imperative: ConjugationItem[];
}

export interface InlineCardState {
  exchangeId: string;
  intent: string; // 'english_to_spanish' | 'spanish_to_english' | 'lookup' | etc.
  userInput: string; // Original user query for context when generating sentences
  status: 'loading' | 'selecting' | 'loadingConjugations' | 'generating' | 'previewing' | 'saving' | 'saved';
  analysis: AnalysisResult | null;
  phrases: WordItem[];
  words: WordItem[];
  cards: CardPreview[];
  // Verb conjugation support
  selectedVerbForConjugation: string | null;
  verbConjugations: VerbConjugations | null;
  selectedConjugations: Set<string>; // Keys like "present-0", "preterite-2"
  error: string | null;
  savedCount?: number;
}

interface InlineCardSelectorProps {
  state: InlineCardState;
  onToggleWord: (type: 'phrase' | 'word', index: number) => void;
  onFetchConjugations: (verb: string) => void;
  onToggleConjugation: (tense: string, index: number) => void;
  onClearConjugations: () => void;
  onGenerate: () => void;
  onToggleCard: (index: number) => void;
  onSave: () => void;
  onBack: () => void;
  onCancel: () => void;
  deckName: string;
}

export function InlineCardSelector({
  state,
  onToggleWord,
  onFetchConjugations,
  onToggleConjugation,
  onClearConjugations,
  onGenerate,
  onToggleCard,
  onSave,
  onBack,
  onCancel,
  deckName,
}: InlineCardSelectorProps) {
  const selectedWordCount = state.phrases.filter((p) => p.selected).length + state.words.filter((w) => w.selected).length;
  const selectedConjCount = state.selectedConjugations.size;
  const totalSelectedCount = selectedWordCount + selectedConjCount;
  const enabledCardCount = state.cards.filter((c) => c.enabled).length;

  // Detect verbs among selected words (base_form ending in -ar, -er, -ir)
  const selectedVerbs = state.words
    .filter((w) => w.selected && w.base_form && /[aei]r$/.test(w.base_form))
    .map((w) => w.base_form);

  // Loading state
  if (state.status === 'loading') {
    return (
      <div className="ml-12 bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 text-text-muted">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Analyzing words...</span>
        </div>
      </div>
    );
  }

  // Loading conjugations state
  if (state.status === 'loadingConjugations') {
    return (
      <div className="ml-12 bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 text-text-muted">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading conjugations for {state.selectedVerbForConjugation}...</span>
        </div>
      </div>
    );
  }

  // Saved state
  if (state.status === 'saved') {
    return (
      <div className="ml-12 bg-success/10 border border-success/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-success">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Saved {state.savedCount} card{state.savedCount !== 1 ? 's' : ''} to {deckName}</span>
          </div>
          <button
            onClick={onCancel}
            className="text-sm text-text-muted hover:text-text"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="ml-12 bg-error/10 border border-error/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-error">{state.error}</span>
          <button
            onClick={onCancel}
            className="text-sm text-text-muted hover:text-text"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Generating state
  if (state.status === 'generating') {
    return (
      <div className="ml-12 bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 text-text-muted">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Generating cards...</span>
        </div>
      </div>
    );
  }

  // Preview state - show generated cards
  if (state.status === 'previewing' || state.status === 'saving') {
    return (
      <div className="ml-12 bg-surface border border-border rounded-lg p-4 space-y-4">
        <div className="text-sm font-medium text-text">Preview Cards</div>

        <div className="space-y-3 max-h-80 overflow-y-auto">
          {state.cards.map((card, index) => (
            <div
              key={index}
              onClick={() => onToggleCard(index)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                card.enabled
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-background opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-5 shrink-0 items-center">
                  <div
                    className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                      card.enabled ? 'border-primary bg-primary' : 'border-text-muted'
                    }`}
                  >
                    {card.enabled && (
                      <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M3.707 5.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L5 6.586 3.707 5.293z" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text text-sm">{card.spanish_word}</div>
                  <div className="text-xs text-text-muted mt-0.5">{card.translation}</div>
                  <div className="text-sm text-text-secondary mt-2 bg-background rounded p-2">
                    {card.cloze_sentence.split(/(\{\{c1::.*?\}\})/).map((part, i) => {
                      if (part.startsWith('{{c1::')) {
                        const word = part.replace('{{c1::', '').replace('}}', '');
                        return (
                          <span key={i} className="bg-primary/20 text-primary font-medium px-1 rounded">
                            {word}
                          </span>
                        );
                      }
                      return <span key={i}>{part}</span>;
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            onClick={onBack}
            disabled={state.status === 'saving'}
            className="text-sm text-text-muted hover:text-text disabled:opacity-50"
          >
            ← Back
          </button>
          <button
            onClick={onSave}
            disabled={enabledCardCount === 0 || state.status === 'saving'}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.status === 'saving' ? (
              'Saving...'
            ) : enabledCardCount === 0 ? (
              'Enable cards'
            ) : (
              `Save ${enabledCardCount} Card${enabledCardCount !== 1 ? 's' : ''} to "${deckName}"`
            )}
          </button>
        </div>
      </div>
    );
  }

  // Empty analysis
  if (state.status === 'selecting' && state.phrases.length === 0 && state.words.length === 0) {
    return (
      <div className="ml-12 bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-text-muted">No words or phrases detected</span>
          <button
            onClick={onCancel}
            className="text-sm text-text-muted hover:text-text"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Selection state
  return (
    <div className="ml-12 bg-surface border border-border rounded-lg p-4 space-y-4">
      <div className="text-sm font-medium text-text">Select words to learn</div>

      {/* Phrases Section */}
      {state.phrases.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wide">Phrases</div>
          <div className="space-y-2">
            {state.phrases.map((phrase, index) => (
              <SelectableCard
                key={`phrase-${index}`}
                selected={phrase.selected}
                onClick={() => onToggleWord('phrase', index)}
                title={phrase.spanish}
                description={
                  <span>
                    {phrase.english}
                    {phrase.base_form && phrase.base_form !== phrase.spanish && (
                      <span className="text-text-placeholder ml-1">({phrase.base_form})</span>
                    )}
                  </span>
                }
                variant="secondary"
              />
            ))}
          </div>
        </div>
      )}

      {/* Words Section */}
      {state.words.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wide">Words</div>
          <div className="space-y-2">
            {state.words.map((word, index) => (
              <SelectableCard
                key={`word-${index}`}
                selected={word.selected}
                onClick={() => onToggleWord('word', index)}
                title={word.spanish}
                description={
                  <span>
                    {word.english}
                    {word.base_form && word.base_form !== word.spanish && (
                      <span className="text-text-placeholder ml-1">({word.base_form})</span>
                    )}
                  </span>
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Verb Conjugations Section */}
      {selectedVerbs.length > 0 && !state.verbConjugations && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wide">Verb Conjugations</div>
          <div className="flex flex-wrap gap-2">
            {selectedVerbs.map((verb) => (
              <button
                key={verb}
                onClick={() => onFetchConjugations(verb)}
                className="px-3 py-1.5 text-sm bg-accent/10 text-accent border border-accent/30 rounded-lg hover:bg-accent/20 transition"
              >
                + Add conjugations for {verb}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conjugation Selection */}
      {state.verbConjugations && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Conjugations for {state.verbConjugations.infinitive}
            </div>
            <button
              onClick={onClearConjugations}
              className="text-xs text-text-muted hover:text-text"
            >
              Clear
            </button>
          </div>

          {/* Present Tense */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-primary">Present</div>
            <div className="grid grid-cols-2 gap-1">
              {state.verbConjugations.present.map((conj, index) => (
                <button
                  key={`present-${index}`}
                  onClick={() => onToggleConjugation('present', index)}
                  className={`text-left px-2 py-1 text-xs rounded transition ${
                    state.selectedConjugations.has(`present-${index}`)
                      ? 'bg-primary text-white'
                      : 'bg-background hover:bg-primary/10'
                  }`}
                >
                  <span className="font-medium">{conj.pronoun}:</span> {conj.form}
                </button>
              ))}
            </div>
          </div>

          {/* Preterite Tense */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-secondary">Preterite</div>
            <div className="grid grid-cols-2 gap-1">
              {state.verbConjugations.preterite.map((conj, index) => (
                <button
                  key={`preterite-${index}`}
                  onClick={() => onToggleConjugation('preterite', index)}
                  className={`text-left px-2 py-1 text-xs rounded transition ${
                    state.selectedConjugations.has(`preterite-${index}`)
                      ? 'bg-secondary text-white'
                      : 'bg-background hover:bg-secondary/10'
                  }`}
                >
                  <span className="font-medium">{conj.pronoun}:</span> {conj.form}
                </button>
              ))}
            </div>
          </div>

          {/* Imperative Tense */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-accent">Imperative</div>
            <div className="grid grid-cols-2 gap-1">
              {state.verbConjugations.imperative.map((conj, index) => (
                <button
                  key={`imperative-${index}`}
                  onClick={() => onToggleConjugation('imperative', index)}
                  className={`text-left px-2 py-1 text-xs rounded transition ${
                    state.selectedConjugations.has(`imperative-${index}`)
                      ? 'bg-accent text-white'
                      : 'bg-background hover:bg-accent/10'
                  }`}
                >
                  <span className="font-medium">{conj.pronoun}:</span> {conj.form}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <button
          onClick={onCancel}
          className="text-sm text-text-muted hover:text-text"
        >
          Cancel
        </button>
        <button
          onClick={onGenerate}
          disabled={totalSelectedCount === 0}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {totalSelectedCount === 0 ? (
            'Select words'
          ) : (
            `Generate ${totalSelectedCount} Card${totalSelectedCount !== 1 ? 's' : ''} →`
          )}
        </button>
      </div>
    </div>
  );
}
