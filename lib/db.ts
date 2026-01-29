import { neon } from '@neondatabase/serverless';
import { v4 as uuidv4 } from 'uuid';

const sql = neon(process.env.DATABASE_URL!);

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
export async function createDeck(name: string): Promise<Deck> {
  const id = uuidv4();
  await sql`INSERT INTO decks (id, name) VALUES (${id}, ${name})`;
  return (await getDeck(id))!;
}

export async function getDeck(id: string): Promise<Deck | null> {
  const rows = await sql`SELECT * FROM decks WHERE id = ${id}`;
  return rows[0] as Deck | null;
}

export async function getAllDecks(): Promise<Deck[]> {
  const rows = await sql`SELECT * FROM decks ORDER BY created_at DESC`;
  return rows as Deck[];
}

export async function deleteDeck(id: string): Promise<void> {
  await sql`DELETE FROM decks WHERE id = ${id}`;
}

// Card operations
export async function createCard(card: Omit<Card, 'id' | 'interval' | 'ease_factor' | 'next_review' | 'review_count' | 'queue' | 'learning_step' | 'lapses' | 'created_at'>): Promise<Card> {
  const id = uuidv4();
  await sql`
    INSERT INTO cards (id, deck_id, spanish_word, translation, context_sentence, cloze_sentence)
    VALUES (${id}, ${card.deck_id}, ${card.spanish_word}, ${card.translation}, ${card.context_sentence}, ${card.cloze_sentence})
  `;
  return (await getCard(id))!;
}

export async function getCard(id: string): Promise<Card | null> {
  const rows = await sql`SELECT * FROM cards WHERE id = ${id}`;
  return rows[0] as Card | null;
}

export async function getCardsByDeck(deckId: string): Promise<Card[]> {
  const rows = await sql`SELECT * FROM cards WHERE deck_id = ${deckId} ORDER BY created_at DESC`;
  return rows as Card[];
}

export async function getAllCards(): Promise<Card[]> {
  const rows = await sql`SELECT * FROM cards ORDER BY created_at DESC`;
  return rows as Card[];
}

export async function getDueCards(deckId?: string): Promise<Card[]> {
  const now = new Date().toISOString();
  if (deckId) {
    const rows = await sql`
      SELECT * FROM cards
      WHERE deck_id = ${deckId} AND next_review <= ${now}
      ORDER BY
        CASE queue
          WHEN 1 THEN 0
          WHEN 3 THEN 1
          WHEN 0 THEN 2
          ELSE 3
        END,
        next_review ASC
    `;
    return rows as Card[];
  }
  const rows = await sql`
    SELECT * FROM cards
    WHERE next_review <= ${now}
    ORDER BY
      CASE queue
        WHEN 1 THEN 0
        WHEN 3 THEN 1
        WHEN 0 THEN 2
        ELSE 3
      END,
      next_review ASC
  `;
  return rows as Card[];
}

export async function getStudyAheadCards(deckId?: string, limit: number = 20): Promise<Card[]> {
  const now = new Date().toISOString();
  if (deckId) {
    const rows = await sql`
      SELECT * FROM cards
      WHERE deck_id = ${deckId} AND queue = 2 AND next_review > ${now}
      ORDER BY next_review ASC
      LIMIT ${limit}
    `;
    return rows as Card[];
  }
  const rows = await sql`
    SELECT * FROM cards
    WHERE queue = 2 AND next_review > ${now}
    ORDER BY next_review ASC
    LIMIT ${limit}
  `;
  return rows as Card[];
}

export async function getLearningCards(deckId?: string): Promise<Card[]> {
  if (deckId) {
    const rows = await sql`
      SELECT * FROM cards
      WHERE deck_id = ${deckId} AND queue IN (1, 3)
      ORDER BY next_review ASC
    `;
    return rows as Card[];
  }
  const rows = await sql`
    SELECT * FROM cards
    WHERE queue IN (1, 3)
    ORDER BY next_review ASC
  `;
  return rows as Card[];
}

export async function updateCard(id: string, updates: Partial<Card>): Promise<Card | null> {
  const card = await getCard(id);
  if (!card) return null;

  const fields = Object.keys(updates).filter(k => k !== 'id') as (keyof Card)[];
  if (fields.length === 0) return card;

  // Build dynamic update - Neon supports tagged template literals
  // We need to update each field individually for type safety
  for (const field of fields) {
    const value = updates[field];
    switch (field) {
      case 'deck_id':
        await sql`UPDATE cards SET deck_id = ${value} WHERE id = ${id}`;
        break;
      case 'spanish_word':
        await sql`UPDATE cards SET spanish_word = ${value} WHERE id = ${id}`;
        break;
      case 'translation':
        await sql`UPDATE cards SET translation = ${value} WHERE id = ${id}`;
        break;
      case 'context_sentence':
        await sql`UPDATE cards SET context_sentence = ${value} WHERE id = ${id}`;
        break;
      case 'cloze_sentence':
        await sql`UPDATE cards SET cloze_sentence = ${value} WHERE id = ${id}`;
        break;
      case 'interval':
        await sql`UPDATE cards SET interval = ${value} WHERE id = ${id}`;
        break;
      case 'ease_factor':
        await sql`UPDATE cards SET ease_factor = ${value} WHERE id = ${id}`;
        break;
      case 'next_review':
        await sql`UPDATE cards SET next_review = ${value} WHERE id = ${id}`;
        break;
      case 'review_count':
        await sql`UPDATE cards SET review_count = ${value} WHERE id = ${id}`;
        break;
      case 'queue':
        await sql`UPDATE cards SET queue = ${value} WHERE id = ${id}`;
        break;
      case 'learning_step':
        await sql`UPDATE cards SET learning_step = ${value} WHERE id = ${id}`;
        break;
      case 'lapses':
        await sql`UPDATE cards SET lapses = ${value} WHERE id = ${id}`;
        break;
    }
  }

  return getCard(id);
}

export async function deleteCard(id: string): Promise<void> {
  await sql`DELETE FROM cards WHERE id = ${id}`;
}

// Review session operations
export async function createReviewSession(
  cardIds: string[],
  deckId?: string,
  studyAhead: boolean = false
): Promise<ReviewSession> {
  const id = uuidv4();
  const cardOrder = JSON.stringify(cardIds);
  const studyAheadNum = studyAhead ? 1 : 0;
  await sql`
    INSERT INTO review_sessions (id, deck_id, card_order, study_ahead)
    VALUES (${id}, ${deckId || null}, ${cardOrder}, ${studyAheadNum})
  `;
  return (await getReviewSession(id))!;
}

export async function getReviewSession(id: string): Promise<ReviewSession | null> {
  const rows = await sql`SELECT * FROM review_sessions WHERE id = ${id}`;
  return rows[0] as ReviewSession | null;
}

export async function updateReviewSessionIndex(id: string, index: number): Promise<void> {
  await sql`UPDATE review_sessions SET current_index = ${index} WHERE id = ${id}`;
}

export async function deleteReviewSession(id: string): Promise<void> {
  await sql`DELETE FROM review_sessions WHERE id = ${id}`;
}

export async function cleanupOldReviewSessions(): Promise<void> {
  await sql`
    DELETE FROM review_sessions
    WHERE created_at < NOW() - INTERVAL '1 day'
  `;
}

// Stats
export async function getStats() {
  const totalCardsResult = await sql`SELECT COUNT(*) as count FROM cards`;
  const dueCardsResult = await sql`SELECT COUNT(*) as count FROM cards WHERE next_review <= NOW()`;
  const totalDecksResult = await sql`SELECT COUNT(*) as count FROM decks`;

  return {
    totalCards: Number(totalCardsResult[0].count),
    dueCards: Number(dueCardsResult[0].count),
    totalDecks: Number(totalDecksResult[0].count),
  };
}

// Chat session operations
export async function createChatSession(name?: string): Promise<ChatSession> {
  const id = uuidv4();
  await sql`INSERT INTO chat_sessions (id, name) VALUES (${id}, ${name || null})`;
  return (await getChatSession(id))!;
}

export async function getChatSession(id: string): Promise<ChatSession | null> {
  const rows = await sql`SELECT * FROM chat_sessions WHERE id = ${id}`;
  return rows[0] as ChatSession | null;
}

export async function getAllChatSessions(): Promise<ChatSession[]> {
  const rows = await sql`SELECT * FROM chat_sessions ORDER BY updated_at DESC`;
  return rows as ChatSession[];
}

export async function updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | null> {
  const session = await getChatSession(id);
  if (!session) return null;

  if (updates.name !== undefined) {
    await sql`UPDATE chat_sessions SET name = ${updates.name} WHERE id = ${id}`;
  }
  if (updates.updated_at !== undefined) {
    await sql`UPDATE chat_sessions SET updated_at = ${updates.updated_at} WHERE id = ${id}`;
  }

  return getChatSession(id);
}

export async function deleteChatSession(id: string): Promise<void> {
  await sql`DELETE FROM chat_sessions WHERE id = ${id}`;
}

// Chat exchange operations
export async function createChatExchange(exchange: Omit<ChatExchange, 'id' | 'created_at'>): Promise<ChatExchange> {
  const id = uuidv4();
  await sql`
    INSERT INTO chat_exchanges (id, session_id, input, intent, response_main, response_json)
    VALUES (${id}, ${exchange.session_id}, ${exchange.input}, ${exchange.intent}, ${exchange.response_main}, ${exchange.response_json})
  `;

  // Update session's updated_at
  await sql`UPDATE chat_sessions SET updated_at = NOW() WHERE id = ${exchange.session_id}`;

  return (await getChatExchange(id))!;
}

export async function getChatExchange(id: string): Promise<ChatExchange | null> {
  const rows = await sql`SELECT * FROM chat_exchanges WHERE id = ${id}`;
  return rows[0] as ChatExchange | null;
}

export async function getChatExchangesBySession(sessionId: string): Promise<ChatExchange[]> {
  const rows = await sql`SELECT * FROM chat_exchanges WHERE session_id = ${sessionId} ORDER BY created_at ASC`;
  return rows as ChatExchange[];
}

export async function deleteChatExchange(id: string): Promise<void> {
  await sql`DELETE FROM chat_exchanges WHERE id = ${id}`;
}
