# Lengua

A Spanish vocabulary learning app that uses Claude AI to generate flashcards with spaced repetition scheduling. Enter a Spanish sentence or word, and the app analyzes it, generates translations with disambiguating context, creates cloze-deletion cards, and schedules reviews using the SM-2 algorithm.

## Features

- **AI Sentence Analysis** — Enter any Spanish sentence or word. Claude detects individual words, multi-word phrases/idioms, and verbs, providing disambiguating translations (e.g., "meter" = "to put into an enclosed space" vs "poner" = "to place on a surface").
- **Verb Conjugations** — Single verbs display present, preterite, and imperative conjugations with example sentences.
- **Multi-step Card Creation** — Analyze a sentence, select which words/phrases/conjugations to keep, preview generated cloze cards, then save to a deck.
- **Spaced Repetition (SM-2)** — Review cards with Again/Hard/Good/Easy buttons and interval previews. Supports Anki-compatible queue states (New, Learning, Review, Relearning) with sub-day learning steps.
- **Cloze Cards** — Cards use `{{c1::...}}` cloze deletion format with English-only hints and Spanish context sentences.
- **Deck Organization** — Group cards into decks, browse deck contents, see stats (due cards, total cards).
- **Anki Export** — Download any deck as an Anki-importable tab-separated text file in Basic or Cloze format.
- **Chat Assistant** — A conversational interface for Spanish practice. Handles natural language queries like "How do you say...", accepts pasted Spanish for translation, validates grammar, and links directly to card creation.
- **Dark Mode** — Full dark mode support via `prefers-color-scheme`.

## Tech Stack

- **Next.js 16** (App Router) + TypeScript + React 19
- **Neon Postgres** (serverless) for data storage
- **Claude API** (claude-sonnet-4-20250514) for translations and analysis
- **Tailwind CSS v4** with dark mode
- **pnpm** for package management

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- A [Neon](https://neon.tech) Postgres database
- An [Anthropic API key](https://console.anthropic.com)

### Setup

```bash
# Install dependencies
pnpm install

# Create .env.local with your credentials
cat > .env.local << 'EOF'
ANTHROPIC_API_KEY=your-api-key-here
DATABASE_URL=your-neon-postgres-connection-string
EOF

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

```bash
pnpm dev              # Development server
pnpm build            # Production build
pnpm lint             # ESLint
pnpm build-test       # Build + test

# CLI tools
pnpm sentence "Spanish sentence"           # Analyze a sentence
pnpm sentence --save --deck "Movies" "s"   # Analyze + save to deck
pnpm test:translate hola                   # Test single word translation
```

## Project Structure

```
app/
  api/            # API routes (translate, generate-cards, cards, decks, review, export, chat)
  components/     # Reusable UI components
  add/            # Multi-step card creation
  review/         # Spaced repetition review
  deck/[id]/      # Deck browser
  chat/           # Chat assistant
  export/         # Anki export
  import/         # Card import
lib/
  db.ts           # Database operations (Neon Postgres)
  sm2.ts          # SM-2 spaced repetition algorithm
  claude.ts       # Claude API integration
  anki-export.ts  # Anki file generation
  auth.ts         # Authentication
scripts/          # CLI utilities
```
