import { Card, Deck, getCardsByDeck, getDeck, getAllCards, getAllDecks } from './db';

/**
 * Export cards to Anki-compatible format
 *
 * Anki can import tab-separated text files with the format:
 * front<tab>back<tab>tags
 *
 * For cloze deletions, Anki uses the format: {{c1::text}}
 */

export interface ExportOptions {
  deckId?: string;
  format: 'basic' | 'cloze';
  includeContext: boolean;
}

/**
 * Generate Anki import file content
 */
export async function exportToAnki(options: ExportOptions): Promise<string> {
  const { deckId, format, includeContext } = options;

  // Get cards
  const cards = deckId ? await getCardsByDeck(deckId) : await getAllCards();

  if (cards.length === 0) {
    return '';
  }

  // Get deck name for tags
  const deck = deckId ? await getDeck(deckId) : null;
  const tag = deck ? deck.name.replace(/\s+/g, '_') : 'Spanish';

  const lines: string[] = [];

  // Add header comment for Anki
  lines.push('#separator:tab');
  lines.push('#html:false');
  lines.push('#tags column:3');
  lines.push('');

  for (const card of cards) {
    if (format === 'cloze') {
      // Cloze format: use the cloze sentence
      const front = card.cloze_sentence || `{{c1::${card.spanish_word}}} - ${card.translation}`;
      const back = includeContext && card.context_sentence
        ? `${card.spanish_word} = ${card.translation}\n\n${card.context_sentence}`
        : `${card.spanish_word} = ${card.translation}`;
      lines.push(`${escapeTab(front)}\t${escapeTab(back)}\t${tag}`);
    } else {
      // Basic format: spanish -> english
      const front = includeContext && card.context_sentence
        ? `${card.spanish_word}\n\n${card.context_sentence}`
        : card.spanish_word;
      const back = card.translation;
      lines.push(`${escapeTab(front)}\t${escapeTab(back)}\t${tag}`);
    }
  }

  return lines.join('\n');
}

/**
 * Escape tabs in content (replace with spaces)
 */
function escapeTab(text: string): string {
  return text.replace(/\t/g, '    ').replace(/\n/g, '<br>');
}

/**
 * Get export file name
 */
export async function getExportFileName(deckId?: string): Promise<string> {
  const deck = deckId ? await getDeck(deckId) : null;
  const name = deck ? deck.name.replace(/\s+/g, '_') : 'spanish_flashcards';
  const date = new Date().toISOString().split('T')[0];
  return `${name}_${date}.txt`;
}

/**
 * Get export statistics
 */
export async function getExportStats(deckId?: string) {
  const cards = deckId ? await getCardsByDeck(deckId) : await getAllCards();
  const deck = deckId ? await getDeck(deckId) : null;
  const decks = deckId ? (deck ? [deck] : []) : await getAllDecks();

  return {
    totalCards: cards.length,
    totalDecks: decks.length,
    deckNames: decks.map(d => d.name),
  };
}
