import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const dbPath = path.join(process.cwd(), 'data', 'spanish.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema - base tables without new columns
db.exec(`
  CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
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
    next_review TEXT DEFAULT (datetime('now')),
    review_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_cards_next_review ON cards(next_review);
  CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
`);

// Migration: Add new columns if they don't exist (for existing databases)
const columns = db.prepare("PRAGMA table_info(cards)").all() as { name: string }[];
const columnNames = columns.map(c => c.name);

if (!columnNames.includes('queue')) {
  db.exec(`ALTER TABLE cards ADD COLUMN queue INTEGER DEFAULT 0`);
  db.exec(`ALTER TABLE cards ADD COLUMN learning_step INTEGER DEFAULT 0`);
  db.exec(`ALTER TABLE cards ADD COLUMN lapses INTEGER DEFAULT 0`);
  // Migrate existing cards: cards with review_count > 0 are graduated (queue=2)
  db.exec(`UPDATE cards SET queue = 2 WHERE review_count > 0`);
}

// Create index on queue (after migration ensures column exists)
db.exec(`CREATE INDEX IF NOT EXISTS idx_cards_queue ON cards(queue)`);

db.exec(`
  -- Review sessions for spaced repetition
  CREATE TABLE IF NOT EXISTS review_sessions (
    id TEXT PRIMARY KEY,
    deck_id TEXT REFERENCES decks(id) ON DELETE CASCADE,
    card_order TEXT NOT NULL,
    current_index INTEGER DEFAULT 0,
    study_ahead INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_review_sessions_deck ON review_sessions(deck_id);

  -- Chat sessions for WhatsApp conversation helper
  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Chat exchanges within sessions
  CREATE TABLE IF NOT EXISTS chat_exchanges (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
    input TEXT NOT NULL,
    intent TEXT NOT NULL,
    response_main TEXT NOT NULL,
    response_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_chat_exchanges_session ON chat_exchanges(session_id);
`);

// Types
export interface Deck {
  id: string;
  name: string;
  created_at: string;
}

// Queue states (matches Anki)
export const CardQueue = {
  New: 0,        // Never reviewed
  Learning: 1,   // In learning phase (sub-day steps)
  Review: 2,     // Graduated, spaced repetition
  Relearning: 3, // Lapsed, going through relearning steps
} as const;

export type CardQueueType = typeof CardQueue[keyof typeof CardQueue];

export interface Card {
  id: string;
  deck_id: string;
  spanish_word: string;
  translation: string;
  context_sentence: string | null;
  cloze_sentence: string | null;
  interval: number;
  ease_factor: number;
  next_review: string;
  review_count: number;
  queue: CardQueueType;
  learning_step: number;
  lapses: number;
  created_at: string;
}

export interface ReviewSession {
  id: string;
  deck_id: string | null;
  card_order: string;  // JSON array of card IDs
  current_index: number;
  study_ahead: number;  // 0 = normal, 1 = study ahead mode
  created_at: string;
}

export interface ChatSession {
  id: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatExchange {
  id: string;
  session_id: string;
  input: string;
  intent: string;
  response_main: string;
  response_json: string | null;
  created_at: string;
}

// Deck operations
export function createDeck(name: string): Deck {
  const id = uuidv4();
  const stmt = db.prepare('INSERT INTO decks (id, name) VALUES (?, ?)');
  stmt.run(id, name);
  return getDeck(id)!;
}

export function getDeck(id: string): Deck | null {
  const stmt = db.prepare('SELECT * FROM decks WHERE id = ?');
  return stmt.get(id) as Deck | null;
}

export function getAllDecks(): Deck[] {
  const stmt = db.prepare('SELECT * FROM decks ORDER BY created_at DESC');
  return stmt.all() as Deck[];
}

export function deleteDeck(id: string): void {
  const stmt = db.prepare('DELETE FROM decks WHERE id = ?');
  stmt.run(id);
}

// Card operations
export function createCard(card: Omit<Card, 'id' | 'interval' | 'ease_factor' | 'next_review' | 'review_count' | 'queue' | 'learning_step' | 'lapses' | 'created_at'>): Card {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO cards (id, deck_id, spanish_word, translation, context_sentence, cloze_sentence)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, card.deck_id, card.spanish_word, card.translation, card.context_sentence, card.cloze_sentence);
  return getCard(id)!;
}

export function getCard(id: string): Card | null {
  const stmt = db.prepare('SELECT * FROM cards WHERE id = ?');
  return stmt.get(id) as Card | null;
}

export function getCardsByDeck(deckId: string): Card[] {
  const stmt = db.prepare('SELECT * FROM cards WHERE deck_id = ? ORDER BY created_at DESC');
  return stmt.all(deckId) as Card[];
}

export function getAllCards(): Card[] {
  const stmt = db.prepare('SELECT * FROM cards ORDER BY created_at DESC');
  return stmt.all() as Card[];
}

export function getDueCards(deckId?: string): Card[] {
  const now = new Date().toISOString();
  // Get cards that are due: new cards (queue=0), review cards due (queue=2),
  // and learning/relearning cards due (queue=1,3)
  if (deckId) {
    const stmt = db.prepare(`
      SELECT * FROM cards
      WHERE deck_id = ? AND next_review <= ?
      ORDER BY
        CASE queue
          WHEN 1 THEN 0  -- Learning cards first
          WHEN 3 THEN 1  -- Then relearning
          WHEN 0 THEN 2  -- Then new
          ELSE 3         -- Then review
        END,
        next_review ASC
    `);
    return stmt.all(deckId, now) as Card[];
  }
  const stmt = db.prepare(`
    SELECT * FROM cards
    WHERE next_review <= ?
    ORDER BY
      CASE queue
        WHEN 1 THEN 0  -- Learning cards first
        WHEN 3 THEN 1  -- Then relearning
        WHEN 0 THEN 2  -- Then new
        ELSE 3         -- Then review
      END,
      next_review ASC
  `);
  return stmt.all(now) as Card[];
}

// Get cards for "study ahead" - not due yet, ordered by closest to due
export function getStudyAheadCards(deckId?: string, limit: number = 20): Card[] {
  const now = new Date().toISOString();
  if (deckId) {
    const stmt = db.prepare(`
      SELECT * FROM cards
      WHERE deck_id = ? AND queue = 2 AND next_review > ?
      ORDER BY next_review ASC
      LIMIT ?
    `);
    return stmt.all(deckId, now, limit) as Card[];
  }
  const stmt = db.prepare(`
    SELECT * FROM cards
    WHERE queue = 2 AND next_review > ?
    ORDER BY next_review ASC
    LIMIT ?
  `);
  return stmt.all(now, limit) as Card[];
}

// Get all learning/relearning cards (for in-session review)
export function getLearningCards(deckId?: string): Card[] {
  if (deckId) {
    const stmt = db.prepare(`
      SELECT * FROM cards
      WHERE deck_id = ? AND queue IN (1, 3)
      ORDER BY next_review ASC
    `);
    return stmt.all(deckId) as Card[];
  }
  const stmt = db.prepare(`
    SELECT * FROM cards
    WHERE queue IN (1, 3)
    ORDER BY next_review ASC
  `);
  return stmt.all() as Card[];
}

export function updateCard(id: string, updates: Partial<Card>): Card | null {
  const card = getCard(id);
  if (!card) return null;

  const fields = Object.keys(updates).filter(k => k !== 'id');
  if (fields.length === 0) return card;

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f as keyof Card]);

  const stmt = db.prepare(`UPDATE cards SET ${setClause} WHERE id = ?`);
  stmt.run(...values, id);

  return getCard(id);
}

export function deleteCard(id: string): void {
  const stmt = db.prepare('DELETE FROM cards WHERE id = ?');
  stmt.run(id);
}

// Review session operations
export function createReviewSession(
  cardIds: string[],
  deckId?: string,
  studyAhead: boolean = false
): ReviewSession {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO review_sessions (id, deck_id, card_order, study_ahead)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, deckId || null, JSON.stringify(cardIds), studyAhead ? 1 : 0);
  return getReviewSession(id)!;
}

export function getReviewSession(id: string): ReviewSession | null {
  const stmt = db.prepare('SELECT * FROM review_sessions WHERE id = ?');
  return stmt.get(id) as ReviewSession | null;
}

export function updateReviewSessionIndex(id: string, index: number): void {
  const stmt = db.prepare('UPDATE review_sessions SET current_index = ? WHERE id = ?');
  stmt.run(index, id);
}

export function deleteReviewSession(id: string): void {
  const stmt = db.prepare('DELETE FROM review_sessions WHERE id = ?');
  stmt.run(id);
}

// Clean up old review sessions (older than 24 hours)
export function cleanupOldReviewSessions(): void {
  const stmt = db.prepare(`
    DELETE FROM review_sessions
    WHERE created_at < datetime('now', '-1 day')
  `);
  stmt.run();
}

// Stats
export function getStats() {
  const totalCards = db.prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number };
  const dueCards = db.prepare("SELECT COUNT(*) as count FROM cards WHERE next_review <= datetime('now')").get() as { count: number };
  const totalDecks = db.prepare('SELECT COUNT(*) as count FROM decks').get() as { count: number };

  return {
    totalCards: totalCards.count,
    dueCards: dueCards.count,
    totalDecks: totalDecks.count,
  };
}

// Chat session operations
export function createChatSession(name?: string): ChatSession {
  const id = uuidv4();
  const stmt = db.prepare('INSERT INTO chat_sessions (id, name) VALUES (?, ?)');
  stmt.run(id, name || null);
  return getChatSession(id)!;
}

export function getChatSession(id: string): ChatSession | null {
  const stmt = db.prepare('SELECT * FROM chat_sessions WHERE id = ?');
  return stmt.get(id) as ChatSession | null;
}

export function getAllChatSessions(): ChatSession[] {
  const stmt = db.prepare('SELECT * FROM chat_sessions ORDER BY updated_at DESC');
  return stmt.all() as ChatSession[];
}

export function updateChatSession(id: string, updates: Partial<ChatSession>): ChatSession | null {
  const session = getChatSession(id);
  if (!session) return null;

  const fields = Object.keys(updates).filter(k => k !== 'id');
  if (fields.length === 0) return session;

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f as keyof ChatSession]);

  const stmt = db.prepare(`UPDATE chat_sessions SET ${setClause} WHERE id = ?`);
  stmt.run(...values, id);

  return getChatSession(id);
}

export function deleteChatSession(id: string): void {
  const stmt = db.prepare('DELETE FROM chat_sessions WHERE id = ?');
  stmt.run(id);
}

// Chat exchange operations
export function createChatExchange(exchange: Omit<ChatExchange, 'id' | 'created_at'>): ChatExchange {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO chat_exchanges (id, session_id, input, intent, response_main, response_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, exchange.session_id, exchange.input, exchange.intent, exchange.response_main, exchange.response_json);

  // Update session's updated_at
  db.prepare('UPDATE chat_sessions SET updated_at = datetime(\'now\') WHERE id = ?').run(exchange.session_id);

  return getChatExchange(id)!;
}

export function getChatExchange(id: string): ChatExchange | null {
  const stmt = db.prepare('SELECT * FROM chat_exchanges WHERE id = ?');
  return stmt.get(id) as ChatExchange | null;
}

export function getChatExchangesBySession(sessionId: string): ChatExchange[] {
  const stmt = db.prepare('SELECT * FROM chat_exchanges WHERE session_id = ? ORDER BY created_at ASC');
  return stmt.all(sessionId) as ChatExchange[];
}

export function deleteChatExchange(id: string): void {
  const stmt = db.prepare('DELETE FROM chat_exchanges WHERE id = ?');
  stmt.run(id);
}

export default db;
