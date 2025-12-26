#!/usr/bin/env npx tsx

/**
 * Test script for translation functionality
 *
 * Usage:
 *   pnpm test:translate <word>
 *   pnpm test:translate hola
 *   pnpm test:translate "buenos días"
 */

import { translateWord } from '../lib/claude';

async function main() {
  const word = process.argv[2];

  if (!word) {
    console.log('Usage: pnpm test:translate <spanish_word>');
    console.log('Example: pnpm test:translate hola');
    process.exit(1);
  }

  console.log(`\nTranslating: "${word}"...\n`);

  try {
    const result = await translateWord(word);

    console.log('Result:');
    console.log('─'.repeat(50));
    console.log(`Spanish:  ${result.spanish_word}`);
    console.log(`English:  ${result.translation}`);
    console.log(`Context:  ${result.context_sentence}`);
    console.log(`Cloze:    ${result.cloze_sentence}`);
    console.log('─'.repeat(50));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
