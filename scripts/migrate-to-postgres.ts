#!/usr/bin/env npx tsx

/**
 * Migrate data from local SQLite to Neon Postgres
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." tsx scripts/migrate-to-postgres.ts
 *
 * Or with .env.local:
 *   pnpm tsx scripts/migrate-to-postgres.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import Database from 'better-sqlite3';
import { neon } from '@neondatabase/serverless';
import path from 'path';

const SQLITE_PATH = path.join(process.cwd(), '..', '..', '..', 'data', 'spanish.db');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  console.log(`Opening SQLite: ${SQLITE_PATH}`);
  const db = new Database(SQLITE_PATH);
  const sql = neon(process.env.DATABASE_URL);

  // Migrate decks
  const decks = db.prepare('SELECT * FROM decks').all() as { id: string; name: string; created_at: string }[];
  console.log(`Migrating ${decks.length} decks...`);
  for (const deck of decks) {
    await sql`INSERT INTO decks (id, name, created_at) VALUES (${deck.id}, ${deck.name}, ${deck.created_at}) ON CONFLICT (id) DO NOTHING`;
  }

  // Migrate cards
  const cards = db.prepare('SELECT * FROM cards').all() as Record<string, unknown>[];
  console.log(`Migrating ${cards.length} cards...`);
  for (const card of cards) {
    await sql`
      INSERT INTO cards (id, deck_id, spanish_word, translation, context_sentence, cloze_sentence, interval, ease_factor, next_review, review_count, queue, learning_step, lapses, created_at)
      VALUES (${card.id as string}, ${card.deck_id as string}, ${card.spanish_word as string}, ${card.translation as string}, ${card.context_sentence as string}, ${card.cloze_sentence as string}, ${card.interval as number}, ${card.ease_factor as number}, ${card.next_review as string}, ${card.review_count as number}, ${card.queue as number ?? 0}, ${card.learning_step as number ?? 0}, ${card.lapses as number ?? 0}, ${card.created_at as string})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  // Migrate chat sessions
  const chatSessions = db.prepare('SELECT * FROM chat_sessions').all() as Record<string, unknown>[];
  console.log(`Migrating ${chatSessions.length} chat sessions...`);
  for (const session of chatSessions) {
    await sql`
      INSERT INTO chat_sessions (id, name, created_at, updated_at)
      VALUES (${session.id as string}, ${session.name as string}, ${session.created_at as string}, ${session.updated_at as string})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  // Migrate chat exchanges
  const chatExchanges = db.prepare('SELECT * FROM chat_exchanges').all() as Record<string, unknown>[];
  console.log(`Migrating ${chatExchanges.length} chat exchanges...`);
  for (const exchange of chatExchanges) {
    await sql`
      INSERT INTO chat_exchanges (id, session_id, input, intent, response_main, response_json, created_at)
      VALUES (${exchange.id as string}, ${exchange.session_id as string}, ${exchange.input as string}, ${exchange.intent as string}, ${exchange.response_main as string}, ${exchange.response_json as string}, ${exchange.created_at as string})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  db.close();
  console.log('\nMigration complete!');
}

main().catch(console.error);
