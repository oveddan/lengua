# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spanish flashcard app for vocabulary learning with spaced repetition (SM-2 algorithm). Uses Claude API for translations and context sentence generation.

### Core Features
1. **Sentence Analysis**: Enter Spanish sentence/word, Claude detects phrases/idioms and individual words
2. **Verb Conjugations**: Single verbs show present, preterite, and imperative conjugations with example sentences
3. **Multi-step Card Creation**: Analyze sentence → select words/phrases/conjugations → preview cards (enable/disable) → save
4. **Disambiguating Translations**: Synonyms get specific translations (e.g., "meter" = "to put (into enclosed space)" vs "poner" = "to put (place on surface)")
5. **Review Cards**: SM-2 spaced repetition with cloze-style cards, randomized order, English-only hints
6. **Deck Organization**: Group cards into decks, filter reviews by deck
7. **Export**: Download deck as Anki-importable file
8. **Chat Assistant**: WhatsApp conversation helper with natural language input, session persistence, and card creation flow

## Commands

```bash
pnpm dev          # Start development server (http://localhost:3000)
pnpm build        # Production build
pnpm lint         # Run ESLint
pnpm build-test   # Build and test everything
```

### CLI Scripts

```bash
pnpm sentence "Spanish sentence"              # Analyze sentence, show cards
pnpm sentence --extra 2 "sentence"            # Generate 2 extra example sentences per word
pnpm sentence --save "sentence"               # Save cards to default deck
pnpm sentence --save --deck "Movies" "sent"   # Save to specific deck
pnpm sentence -e 2 -s -d "Movies" "sent"      # Combined: extra + save + deck

pnpm test:translate hola                      # Test single word translation
pnpm test:db                                  # Test database operations
```

**Note:** After cloning, run `cd node_modules/better-sqlite3 && npm run build-release` to compile the native SQLite bindings.

## Architecture

### Tech Stack
- Next.js 16 (App Router) + TypeScript
- SQLite via better-sqlite3 (stored at `data/spanish.db`)
- Claude API (claude-sonnet-4-20250514) for AI translations
- Tailwind CSS v4 with dark mode support

### Core Libraries (`lib/`)

All database queries and business logic MUST live in reusable `lib/` functions. API routes (`app/api/`) should only handle HTTP concerns (parsing request, returning response) and delegate to `lib/` functions. Never put DB queries, Claude API calls, prompt construction, or domain logic directly in route handlers.

- **db.ts**: Database layer. Exports `Card`, `Deck`, `ReviewSession`, `ChatSession`, `ChatExchange` types plus CRUD functions.
- **claude-helpers.ts**: Shared Claude API utilities. Exports `anthropic` client instance, `extractJsonFromResponse(text)`, and `getTextFromResponse(message)`.
- **sentence-analyzer.ts**: `analyzeSentence(sentence)` analyzes a Spanish word or sentence via Claude, returning translations, phrases, words, and verb conjugations.
- **card-generation.ts**: `generateCards(originalSentence, selectedWords, options?)` generates cloze cards with optional extra sentences via Claude. Also exports `generateCloze()` and `generateExtraSentences()`.
- **card-spacing.ts**: `shuffleWithSpacing(cards)` shuffles review cards while spacing related words apart. Also exports `shuffleArray()` and `getBaseWord()`.
- **chat-assistant.ts**: `chatAssist(input, sessionId?)` handles chat intent detection, Claude API call, and exchange persistence.
- **vocab-extraction.ts**: `extractVocab(question, title?)` extracts Spanish vocabulary from natural language questions via Claude.
- **sm2.ts**: SM-2 spaced repetition algorithm. Use `reviewCard(card, 'again'|'hard'|'good'|'easy')` to calculate next review date.
- **claude.ts**: `translateWord(spanishWord)` returns translation + context sentence + cloze format via Claude API.
- **anki-export.ts**: `exportToAnki({ deckId?, format, includeContext })` generates Anki-importable text files.

### Data Model

```
Deck: id, name, created_at
Card: id, deck_id, spanish_word, translation, context_sentence, cloze_sentence,
      interval, ease_factor, next_review, review_count, created_at
ChatSession: id, name, created_at, updated_at
ChatExchange: id, session_id, input, intent, response_main, response_json, created_at
```

### API Routes (`app/api/`)

- `POST /api/translate` - Analyze sentence/word via Claude (returns phrases, words, conjugations)
- `POST /api/generate-cards` - Generate cloze cards for selected words with optional extra sentences
- `GET/POST/DELETE /api/cards` - Card CRUD
- `GET/POST/DELETE /api/decks` - Deck CRUD (GET includes stats)
- `POST /api/review` - Submit card review (updates SM-2 scheduling)
- `GET /api/export` - Export deck to Anki format
- `POST /api/chat-assist` - Smart assistant with intent detection (english_to_spanish, spanish_to_english, lookup, validation)
- `GET/POST/PATCH/DELETE /api/chat-sessions` - Chat session CRUD
- `GET/DELETE /api/chat-exchanges` - Chat exchange listing and deletion

### UI Pages (`app/`)

- **Home (`/`)**: List decks with Review/Add/Delete buttons, stats (due cards, total cards, deck count)
- **Add (`/add?deck=id&sentence=text`)**: Multi-step flow - enter sentence → select words/phrases/conjugations with checkboxes → preview cards with enable/disable toggles → save to deck. Supports `sentence` query param for pre-population from Chat.
- **Review (`/review?deck=id`)**: Cloze cards with English hint only, randomized order, Again/Hard/Good/Easy buttons with interval preview
- **Deck (`/deck/[id]`)**: Browse cards in a deck, delete individual cards
- **Export (`/export`)**: Select deck, download Anki file
- **Chat (`/chat`)**: WhatsApp conversation assistant - natural language input ("How do you say...", paste Spanish, "Is this correct:"), session management, conversation context, "Make Cards" links to /add flow

### Cloze Generation

Uses custom regex for Spanish word boundaries (handles accented characters like "estiró"):
```typescript
const regex = new RegExp(`(^|[\\s¿¡])${escaped}([\\s.,!?;:]|$)`, 'gi');
```

The review page has fallback logic to create cloze on-the-fly for cards without `{{c1::...}}` markers.

## Code Style

- **No try-catch**: Let errors propagate naturally. Don't wrap code in try-catch blocks.
- **Dark mode**: Uses CSS custom properties with `prefers-color-scheme: dark` media query
- **Lib-first**: All DB queries, Claude API calls, prompt construction, and business logic belong in `lib/` files. API routes should only parse requests and return responses — delegate everything else to lib functions. This keeps logic reusable across routes, CLI scripts, and tests.

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgres://...       # Neon Postgres connection string
```

### Worktree Setup

Git worktrees don't share `.env.local` with the main repo. **You must symlink env vars immediately after creating a worktree**, otherwise `pnpm build` and `pnpm dev` will fail with "No database connection string" errors:

```bash
ln -s /Users/danoved/Source/spanish-anki/.env.local <worktree-path>/.env.local
```
