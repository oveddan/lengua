import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const dbPath = path.join(process.cwd(), 'data', 'spanish.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
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
    interval INTEGER DEFAULT 1,
    ease_factor REAL DEFAULT 2.5,
    next_review TEXT DEFAULT (datetime('now')),
    review_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_cards_next_review ON cards(next_review);
  CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
`);

// Types
export interface Deck {
  id: string;
  name: string;
  created_at: string;
}

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
export function createCard(card: Omit<Card, 'id' | 'interval' | 'ease_factor' | 'next_review' | 'review_count' | 'created_at'>): Card {
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
  if (deckId) {
    const stmt = db.prepare('SELECT * FROM cards WHERE deck_id = ? AND next_review <= ? ORDER BY next_review ASC');
    return stmt.all(deckId, now) as Card[];
  }
  const stmt = db.prepare('SELECT * FROM cards WHERE next_review <= ? ORDER BY next_review ASC');
  return stmt.all(now) as Card[];
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

export default db;
