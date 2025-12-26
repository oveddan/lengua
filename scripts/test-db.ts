#!/usr/bin/env npx tsx

/**
 * Test script for database functionality
 *
 * Usage:
 *   pnpm test:db
 */

import {
  createDeck,
  getAllDecks,
  deleteDeck,
  createCard,
  getCardsByDeck,
  getDueCards,
  updateCard,
  deleteCard,
  getStats,
} from '../lib/db';
import { reviewCard } from '../lib/sm2';

function log(msg: string) {
  console.log(`\n${msg}`);
  console.log('─'.repeat(50));
}

async function main() {
  log('Testing Database Operations');

  // Create a test deck
  console.log('Creating test deck...');
  const deck = createDeck('Test Deck');
  console.log('Created deck:', deck);

  // Create a test card
  console.log('\nCreating test card...');
  const card = createCard({
    deck_id: deck.id,
    spanish_word: 'hola',
    translation: 'hello',
    context_sentence: '¡Hola! ¿Cómo estás?',
    cloze_sentence: '¡{{c1::Hola}}! ¿Cómo estás?',
  });
  console.log('Created card:', card);

  // Get all decks
  log('All Decks');
  const decks = getAllDecks();
  console.log(decks);

  // Get cards in deck
  log('Cards in Test Deck');
  const cards = getCardsByDeck(deck.id);
  console.log(cards);

  // Get due cards
  log('Due Cards');
  const dueCards = getDueCards();
  console.log(`${dueCards.length} cards due for review`);

  // Test SM-2 review
  log('Testing SM-2 Review');
  const sm2Result = reviewCard(card, 'good');
  console.log('After "good" review:', sm2Result);

  // Update card with SM-2 result
  const updatedCard = updateCard(card.id, sm2Result);
  console.log('Updated card:', updatedCard);

  // Get stats
  log('Database Stats');
  const stats = getStats();
  console.log(stats);

  // Cleanup
  log('Cleanup');
  deleteCard(card.id);
  deleteDeck(deck.id);
  console.log('Deleted test card and deck');

  // Final stats
  log('Final Stats');
  console.log(getStats());

  console.log('\n✓ All database tests passed!\n');
}

main().catch(console.error);
