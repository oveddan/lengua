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
9. **Authentication**: Simple hardcoded username/password authentication via environment variables

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

## Architecture

### Tech Stack
- Next.js 16 (App Router) + TypeScript
- PostgreSQL via Neon serverless (`@neondatabase/serverless`)
- Claude API (claude-sonnet-4-20250514) for AI translations
- Tailwind CSS v4 with dark mode support

### Database Setup (Neon)

Project: `Dan Spanish Anki` (ID: `autumn-waterfall-21379745`)

Tables in `public` schema:
- `decks` - Deck collections
- `cards` - Flashcards with SM-2 scheduling fields
- `review_sessions` - Active review session state
- `chat_sessions` - Chat conversation sessions
- `chat_exchanges` - Individual chat messages

To recreate schema (run via Neon MCP or SQL client):
```sql
CREATE TABLE IF NOT EXISTS decks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  deck_id TEXT REFERENCES decks(id) ON DELETE CASCADE,
  spanish_word TEXT NOT NULL,
  translation TEXT NOT NULL,
  context_sentence TEXT,
  cloze_sentence TEXT,
  interval INTEGER DEFAULT 0,
  ease_factor REAL DEFAULT 2.5,
  next_review TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  review_count INTEGER DEFAULT 0,
  queue INTEGER DEFAULT 0,
  learning_step INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_sessions (
  id TEXT PRIMARY KEY,
  deck_id TEXT REFERENCES decks(id) ON DELETE CASCADE,
  card_order TEXT NOT NULL,
  current_index INTEGER DEFAULT 0,
  study_ahead INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_exchanges (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  intent TEXT NOT NULL,
  response_main TEXT NOT NULL,
  response_json TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cards_next_review ON cards(next_review);
CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_cards_queue ON cards(queue);
CREATE INDEX IF NOT EXISTS idx_review_sessions_deck ON review_sessions(deck_id);
CREATE INDEX IF NOT EXISTS idx_chat_exchanges_session ON chat_exchanges(session_id);
```

### Core Libraries (`lib/`)

- **db.ts**: Neon Postgres database layer. Exports `Card` and `Deck` types plus async CRUD functions.
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
- `POST /api/auth/login` - Authenticate with username/password
- `GET/POST /api/auth/logout` - Clear auth session

### UI Pages (`app/`)

- **Home (`/`)**: List decks with Review/Add/Delete buttons, stats (due cards, total cards, deck count)
- **Add (`/add?deck=id&sentence=text`)**: Multi-step flow - enter sentence → select words/phrases/conjugations with checkboxes → preview cards with enable/disable toggles → save to deck. Supports `sentence` query param for pre-population from Chat.
- **Review (`/review?deck=id`)**: Cloze cards with English hint only, randomized order, Again/Hard/Good/Easy buttons with interval preview
- **Deck (`/deck/[id]`)**: Browse cards in a deck, delete individual cards
- **Export (`/export`)**: Select deck, download Anki file
- **Chat (`/chat`)**: WhatsApp conversation assistant - natural language input ("How do you say...", paste Spanish, "Is this correct:"), session management, conversation context, "Make Cards" links to /add flow
- **Login (`/login`)**: Authentication page with username/password form

### Cloze Generation

Uses custom regex for Spanish word boundaries (handles accented characters like "estiró"):
```typescript
const regex = new RegExp(`(^|[\\s¿¡])${escaped}([\\s.,!?;:]|$)`, 'gi');
```

The review page has fallback logic to create cloze on-the-fly for cards without `{{c1::...}}` markers.

## Code Style

- **No try-catch**: Let errors propagate naturally. Don't wrap code in try-catch blocks.
- **Dark mode**: Uses CSS custom properties with `prefers-color-scheme: dark` media query

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...

# Database (Neon Postgres)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# Authentication (required for deployment)
AUTH_USERNAME=your_username
AUTH_PASSWORD=your_password
AUTH_SECRET=random_32_char_secret_for_signing
```
