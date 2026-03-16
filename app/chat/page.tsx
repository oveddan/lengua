'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { InlineCardSelector, InlineCardState, CardPreview } from '../components';

interface ChatSession {
  id: string;
  name: string | null;
  created_at: string;
  updated_at: string;
  exchangeCount: number;
}

interface ChatExchange {
  id: string;
  session_id: string;
  input: string;
  intent: string;
  response_main: string;
  response_json: string | null;
  created_at: string;
}

interface ResponseData {
  main: string;
  alternatives?: string[];
  explanation?: string;
  corrections?: string[];
  words?: { spanish: string; english: string; notes?: string }[];
}

interface Deck {
  id: string;
  name: string;
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [exchanges, setExchanges] = useState<ChatExchange[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [latestResponse, setLatestResponse] = useState<ResponseData | null>(null);
  const [copied, setCopied] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Deck state for navigation to /add
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>('');

  // Inline card creation state
  const [inlineCardStates, setInlineCardStates] = useState<Map<string, InlineCardState>>(new Map());
  const [activeCardExchangeId, setActiveCardExchangeId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const [sessionsRes, decksRes] = await Promise.all([
        fetch('/api/chat-sessions'),
        fetch('/api/decks'),
      ]);
      const [sessionsData, decksData] = await Promise.all([
        sessionsRes.json(),
        decksRes.json(),
      ]);
      setSessions(sessionsData.sessions);
      setDecks(decksData.decks);
      if (decksData.decks.length > 0) {
        setSelectedDeck(decksData.decks[0].id);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function fetchExchanges() {
      if (selectedSessionId) {
        const res = await fetch(`/api/chat-exchanges?sessionId=${selectedSessionId}`);
        const data = await res.json();
        setExchanges(data.exchanges);
      } else {
        setExchanges([]);
      }
    }
    fetchExchanges();
  }, [selectedSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [exchanges]);

  async function fetchSessions() {
    const res = await fetch('/api/chat-sessions');
    const data = await res.json();
    setSessions(data.sessions);
  }

  async function createSession() {
    const res = await fetch('/api/chat-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSessionName.trim() || null }),
    });
    const session = await res.json();
    setSessions((prev) => [{ ...session, exchangeCount: 0 }, ...prev]);
    setSelectedSessionId(session.id);
    setNewSessionName('');
    setShowNewSession(false);
  }

  async function deleteSession(id: string) {
    if (!confirm('Delete this conversation?')) return;
    await fetch(`/api/chat-sessions?id=${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (selectedSessionId === id) {
      setSelectedSessionId(null);
      setExchanges([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    setLatestResponse(null);

    const res = await fetch('/api/chat-assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: input.trim(),
        sessionId: selectedSessionId,
      }),
    });

    const data = await res.json();

    // Update session if new one was created
    if (!selectedSessionId && data.sessionId) {
      setSelectedSessionId(data.sessionId);
      fetchSessions();
    }

    // Add the new exchange to the list
    const newExchange: ChatExchange = {
      id: data.exchangeId,
      session_id: data.sessionId,
      input: input.trim(),
      intent: data.intent,
      response_main: data.response.main,
      response_json: JSON.stringify(data.response),
      created_at: new Date().toISOString(),
    };
    setExchanges((prev) => [...prev, newExchange]);
    setLatestResponse(data.response);
    setInput('');
    setLoading(false);

    // Update session count
    setSessions((prev) =>
      prev.map((s) =>
        s.id === data.sessionId ? { ...s, exchangeCount: s.exchangeCount + 1 } : s
      )
    );
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getIntentLabel(intent: string): string {
    switch (intent) {
      case 'english_to_spanish':
        return 'EN → ES';
      case 'spanish_to_english':
        return 'ES → EN';
      case 'lookup':
        return 'Lookup';
      case 'validation':
        return 'Check';
      default:
        return intent;
    }
  }

  function parseResponseJson(json: string | null): ResponseData | null {
    if (!json) return null;
    return JSON.parse(json);
  }

  function goToAddPage(exchange: ChatExchange) {
    // Determine which text to analyze - use the Spanish text
    const spanishText = exchange.intent === 'spanish_to_english'
      ? exchange.input  // User pasted Spanish
      : exchange.response_main;  // Assistant generated Spanish

    // Navigate to /add with the sentence pre-filled
    const params = new URLSearchParams();
    params.set('sentence', spanishText);
    if (selectedDeck) {
      params.set('deck', selectedDeck);
    }
    window.location.href = `/add?${params.toString()}`;
  }

  // Inline card creation functions
  async function startCardCreation(exchange: ChatExchange) {
    // If already active for this exchange, close it
    if (activeCardExchangeId === exchange.id) {
      setActiveCardExchangeId(null);
      return;
    }

    // Set this exchange as active
    setActiveCardExchangeId(exchange.id);

    // Check if we already have analysis for this exchange
    const existingState = inlineCardStates.get(exchange.id);
    if (existingState && existingState.analysis) {
      return; // Already analyzed, just show the UI
    }

    // Set loading state
    setInlineCardStates((prev) => {
      const next = new Map(prev);
      next.set(exchange.id, {
        exchangeId: exchange.id,
        intent: exchange.intent,
        userInput: exchange.input,
        status: 'loading',
        analysis: null,
        phrases: [],
        words: [],
        cards: [],
        selectedVerbForConjugation: null,
        verbConjugations: null,
        selectedConjugations: new Set<string>(),
        error: null,
      });
      return next;
    });

    // Get Spanish text to analyze
    const spanishText = exchange.intent === 'spanish_to_english'
      ? exchange.input
      : exchange.response_main;

    // Fetch analysis
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence: spanishText }),
    });

    if (!res.ok) {
      setInlineCardStates((prev) => {
        const next = new Map(prev);
        next.set(exchange.id, {
          exchangeId: exchange.id,
          intent: exchange.intent,
          userInput: exchange.input,
          status: 'selecting',
          analysis: null,
          phrases: [],
          words: [],
          cards: [],
          selectedVerbForConjugation: null,
          verbConjugations: null,
          selectedConjugations: new Set<string>(),
          error: 'Failed to analyze text',
        });
        return next;
      });
      return;
    }

    const analysis = await res.json();

    // Update state with analysis
    setInlineCardStates((prev) => {
      const next = new Map(prev);
      next.set(exchange.id, {
        exchangeId: exchange.id,
        intent: exchange.intent,
        userInput: exchange.input,
        status: 'selecting',
        analysis,
        phrases: analysis.phrases.map((p: { spanish: string; english: string; base_form: string }) => ({
          ...p,
          selected: false,
        })),
        words: analysis.words.map((w: { spanish: string; english: string; base_form: string }) => ({
          ...w,
          selected: false,
        })),
        cards: [],
        selectedVerbForConjugation: null,
        verbConjugations: null,
        selectedConjugations: new Set<string>(),
        error: null,
      });
      return next;
    });
  }

  function toggleWord(exchangeId: string, type: 'phrase' | 'word', index: number) {
    setInlineCardStates((prev) => {
      const next = new Map(prev);
      const state = next.get(exchangeId);
      if (!state) return prev;

      if (type === 'phrase') {
        const newPhrases = [...state.phrases];
        newPhrases[index] = { ...newPhrases[index], selected: !newPhrases[index].selected };
        next.set(exchangeId, { ...state, phrases: newPhrases });
      } else {
        const newWords = [...state.words];
        newWords[index] = { ...newWords[index], selected: !newWords[index].selected };
        next.set(exchangeId, { ...state, words: newWords });
      }
      return next;
    });
  }

  async function fetchConjugations(exchangeId: string, verb: string) {
    const state = inlineCardStates.get(exchangeId);
    if (!state) return;

    // Set loading conjugations state
    setInlineCardStates((prev) => {
      const next = new Map(prev);
      next.set(exchangeId, { ...state, status: 'loadingConjugations', selectedVerbForConjugation: verb });
      return next;
    });

    // Fetch conjugations for the verb
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence: verb }),
    });

    if (!res.ok) {
      setInlineCardStates((prev) => {
        const next = new Map(prev);
        next.set(exchangeId, { ...state, status: 'selecting', error: 'Failed to load conjugations' });
        return next;
      });
      return;
    }

    const data = await res.json();

    if (!data.is_verb || !data.conjugations) {
      setInlineCardStates((prev) => {
        const next = new Map(prev);
        next.set(exchangeId, { ...state, status: 'selecting', error: `${verb} is not a verb` });
        return next;
      });
      return;
    }

    // Get word translation for this verb
    const wordInfo = state.words.find((w) => w.base_form === verb);

    setInlineCardStates((prev) => {
      const next = new Map(prev);
      next.set(exchangeId, {
        ...state,
        status: 'selecting',
        selectedVerbForConjugation: verb,
        verbConjugations: {
          infinitive: data.infinitive,
          translation: wordInfo?.english || data.translation,
          present: data.conjugations.present,
          preterite: data.conjugations.preterite,
          imperative: data.conjugations.imperative,
        },
        selectedConjugations: new Set<string>(),
        error: null,
      });
      return next;
    });
  }

  function toggleConjugation(exchangeId: string, tense: string, index: number) {
    setInlineCardStates((prev) => {
      const next = new Map(prev);
      const state = next.get(exchangeId);
      if (!state) return prev;

      const key = `${tense}-${index}`;
      const newSelected = new Set(state.selectedConjugations);
      if (newSelected.has(key)) {
        newSelected.delete(key);
      } else {
        newSelected.add(key);
      }
      next.set(exchangeId, { ...state, selectedConjugations: newSelected });
      return next;
    });
  }

  function clearConjugations(exchangeId: string) {
    setInlineCardStates((prev) => {
      const next = new Map(prev);
      const state = next.get(exchangeId);
      if (!state) return prev;

      next.set(exchangeId, {
        ...state,
        selectedVerbForConjugation: null,
        verbConjugations: null,
        selectedConjugations: new Set<string>(),
      });
      return next;
    });
  }

  async function generateCardsForExchange(exchangeId: string) {
    const state = inlineCardStates.get(exchangeId);
    if (!state || !state.analysis) return;

    // For lookups, the "original sentence" is explanatory text, not a proper Spanish sentence
    // We need to generate example sentences for lookups
    const isLookup = state.intent === 'lookup';

    const selectedItems = [
      ...state.phrases.filter((p) => p.selected).map((p) => ({
        ...p,
        extraSentences: isLookup ? 1 : 0,
      })),
      ...state.words.filter((w) => w.selected).map((w) => ({
        ...w,
        extraSentences: isLookup ? 1 : 0,
      })),
    ];

    const hasSelectedConjugations = state.selectedConjugations.size > 0;

    if (selectedItems.length === 0 && !hasSelectedConjugations) return;

    // Set generating state
    setInlineCardStates((prev) => {
      const next = new Map(prev);
      next.set(exchangeId, { ...state, status: 'generating' });
      return next;
    });

    let wordCards: CardPreview[] = [];

    // Generate word/phrase cards via API (only uses original sentence)
    if (selectedItems.length > 0) {
      const generateRes = await fetch('/api/generate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalSentence: state.analysis.original_sentence,
          selectedWords: selectedItems,
          skipOriginal: isLookup, // For lookups, skip the explanatory text and only use generated sentences
          userContext: isLookup ? state.userInput : undefined, // Provide context for generating relevant sentences
        }),
      });

      if (!generateRes.ok) {
        setInlineCardStates((prev) => {
          const next = new Map(prev);
          next.set(exchangeId, { ...state, status: 'selecting', error: 'Failed to generate cards' });
          return next;
        });
        return;
      }

      const { cards } = await generateRes.json();
      wordCards = cards.map((c: CardPreview) => ({ ...c, enabled: true }));
    }

    // Generate conjugation cards (these use their own sentences from the API)
    const conjugationCards: CardPreview[] = [];
    if (hasSelectedConjugations && state.verbConjugations) {
      const tenses = ['present', 'preterite', 'imperative'] as const;
      for (const tense of tenses) {
        const items = state.verbConjugations[tense];
        items.forEach((item, index) => {
          if (state.selectedConjugations.has(`${tense}-${index}`)) {
            // Create cloze from the conjugation's own sentence
            const escaped = item.form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const cloze = item.sentence.replace(
              new RegExp(`(^|[\\s¿¡])${escaped}([\\s.,!?;:]|$)`, 'gi'),
              `$1{{c1::${item.form}}}$2`
            );
            conjugationCards.push({
              spanish_word: `${state.verbConjugations!.infinitive} (${item.pronoun} ${tense})`,
              translation: item.sentence_english,
              context_sentence: item.sentence,
              cloze_sentence: cloze,
              enabled: true,
            });
          }
        });
      }
    }

    // Combine all cards
    const allCards = [...wordCards, ...conjugationCards];

    // Set previewing state with generated cards
    setInlineCardStates((prev) => {
      const next = new Map(prev);
      next.set(exchangeId, {
        ...state,
        status: 'previewing',
        cards: allCards,
        error: null,
      });
      return next;
    });
  }

  function toggleCard(exchangeId: string, index: number) {
    setInlineCardStates((prev) => {
      const next = new Map(prev);
      const state = next.get(exchangeId);
      if (!state) return prev;

      const newCards = [...state.cards];
      newCards[index] = { ...newCards[index], enabled: !newCards[index].enabled };
      next.set(exchangeId, { ...state, cards: newCards });
      return next;
    });
  }

  function goBackToSelect(exchangeId: string) {
    setInlineCardStates((prev) => {
      const next = new Map(prev);
      const state = next.get(exchangeId);
      if (!state) return prev;

      next.set(exchangeId, { ...state, status: 'selecting', cards: [] });
      return next;
    });
  }

  async function saveCardsInline(exchangeId: string) {
    const state = inlineCardStates.get(exchangeId);
    if (!state || !selectedDeck) return;

    const enabledCards = state.cards.filter((c) => c.enabled);
    if (enabledCards.length === 0) return;

    // Set saving state
    setInlineCardStates((prev) => {
      const next = new Map(prev);
      next.set(exchangeId, { ...state, status: 'saving' });
      return next;
    });

    // Save each enabled card
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

    // Set saved state
    setInlineCardStates((prev) => {
      const next = new Map(prev);
      next.set(exchangeId, { ...state, status: 'saved', savedCount: enabledCards.length });
      return next;
    });
  }

  function cancelCardCreation() {
    setActiveCardExchangeId(null);
  }

  function handleSelectSession(id: string) {
    setSelectedSessionId(id);
    setSidebarOpen(false);
  }

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-border">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-text">Conversations</h2>
          <Link href="/" className="text-primary text-sm hover:underline">
            Home
          </Link>
        </div>
        <button
          onClick={() => setShowNewSession(true)}
          className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition"
        >
          + New Conversation
        </button>
      </div>

      {showNewSession && (
        <div className="p-4 border-b border-border bg-background">
          <input
            type="text"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            placeholder="Name (optional)..."
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text placeholder:text-text-placeholder mb-2"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={createSession}
              className="flex-1 py-1 bg-secondary text-white rounded text-sm hover:bg-secondary-hover"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowNewSession(false);
                setNewSessionName('');
              }}
              className="flex-1 py-1 bg-surface border border-border text-text rounded text-sm hover:bg-background"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-4 text-text-muted text-sm">No conversations yet</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleSelectSession(session.id)}
              className={`p-3 border-b border-border cursor-pointer hover:bg-background transition ${
                selectedSessionId === session.id ? 'bg-primary/10 border-l-4 border-l-primary' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text truncate">
                    {session.name || 'Untitled'}
                  </div>
                  <div className="text-xs text-text-muted">
                    {session.exchangeCount} message{session.exchangeCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="text-error text-xs hover:underline ml-2"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-surface border-r border-border flex-col">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
        {/* Drawer */}
        <div
          className={`absolute inset-y-0 left-0 w-72 bg-surface flex flex-col transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebarContent}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-4 border-b border-border bg-surface flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1 text-text-muted hover:text-text"
            aria-label="Open conversations"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-text">Spanish Chat Assistant</h1>
            <p className="text-sm text-text-muted">
              Ask &quot;How do you say...&quot;, paste Spanish text, or check your Spanish
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {exchanges.length === 0 && !loading && (
            <div className="text-center text-text-muted py-12">
              <p className="text-lg mb-2">Start a conversation</p>
              <p className="text-sm">
                Try: &quot;How do you say I&apos;m running late&quot; or paste a Spanish message
              </p>
            </div>
          )}

          {exchanges.map((exchange) => {
            const responseData = parseResponseJson(exchange.response_json);
            const inlineState = inlineCardStates.get(exchange.id);
            const isActive = activeCardExchangeId === exchange.id;
            return (
              <div key={exchange.id} className="space-y-2">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="bg-primary text-white px-4 py-2 rounded-lg max-w-[80%]">
                    {exchange.input}
                  </div>
                </div>

                {/* Assistant response */}
                <div className="flex justify-start">
                  <div className="bg-surface border border-border px-4 py-3 rounded-lg max-w-[80%]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-secondary/20 text-secondary px-2 py-0.5 rounded">
                        {getIntentLabel(exchange.intent)}
                      </span>
                    </div>
                    <div className="text-text font-medium">{exchange.response_main}</div>

                    {responseData?.alternatives && responseData.alternatives.length > 0 && (
                      <div className="mt-2 text-sm text-text-secondary">
                        <span className="text-text-muted">Also: </span>
                        {responseData.alternatives.join(' / ')}
                      </div>
                    )}

                    {responseData?.explanation && (
                      <div className="mt-2 text-sm text-text-muted italic">
                        {responseData.explanation}
                      </div>
                    )}

                    {responseData?.corrections && responseData.corrections.length > 0 && (
                      <div className="mt-2 text-sm text-error">
                        {responseData.corrections.join('. ')}
                      </div>
                    )}

                    <div className="mt-2 flex gap-3">
                      <button
                        onClick={() => copyToClipboard(exchange.response_main)}
                        className="text-xs text-primary hover:underline"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => startCardCreation(exchange)}
                        className="text-xs text-secondary hover:underline"
                      >
                        {isActive ? 'Close' : 'Make Cards'}
                      </button>
                      <button
                        onClick={() => goToAddPage(exchange)}
                        className="text-xs text-text-muted hover:underline"
                      >
                        Full Editor
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inline Card Selector */}
                {isActive && inlineState && (
                  <InlineCardSelector
                    state={inlineState}
                    onToggleWord={(type, index) => toggleWord(exchange.id, type, index)}
                    onFetchConjugations={(verb) => fetchConjugations(exchange.id, verb)}
                    onToggleConjugation={(tense, index) => toggleConjugation(exchange.id, tense, index)}
                    onClearConjugations={() => clearConjugations(exchange.id)}
                    onGenerate={() => generateCardsForExchange(exchange.id)}
                    onToggleCard={(index) => toggleCard(exchange.id, index)}
                    onSave={() => saveCardsInline(exchange.id)}
                    onBack={() => goBackToSelect(exchange.id)}
                    onCancel={cancelCardCreation}
                    deckName={decks.find((d) => d.id === selectedDeck)?.name || 'Unknown'}
                  />
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface border border-border px-4 py-3 rounded-lg">
                <div className="text-text-muted">Thinking...</div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Latest Response Actions (if any) */}
        {latestResponse && (
          <div className="px-4 py-2 bg-success-light border-t border-success/30">
            <div className="flex items-center justify-between">
              <span className="text-success text-sm">
                {copied ? 'Copied!' : 'Response ready'}
              </span>
              <button
                onClick={() => copyToClipboard(latestResponse.main)}
                className="px-3 py-1 bg-success text-white rounded text-sm hover:opacity-90"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border bg-surface">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="How do you say... / Paste Spanish text / Is this correct: ..."
              className="flex-1 px-4 py-3 border border-border rounded-lg bg-background text-text placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition disabled:opacity-50"
            >
              {loading ? '...' : 'Send'}
            </button>
          </div>
          <div className="mt-2 text-xs text-text-muted">
            Press Enter to send. Start a new conversation to reset context.
          </div>
        </form>
      </div>
    </div>
  );
}
