#!/usr/bin/env npx tsx

/**
 * Convert a Spanish sentence into flashcards
 *
 * Usage:
 *   pnpm sentence "El conductor fue asesinado"
 *   pnpm sentence --extra 2 "sentence"                 # Generate 2 extra sentences per word
 *   pnpm sentence --save "sentence"                    # Save to database
 *   pnpm sentence --save --deck "Movies" "sentence"    # Save to specific deck
 *   pnpm sentence -e 3 -s -d "Movies" "sentence"       # All options combined
 */

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import Anthropic from '@anthropic-ai/sdk';
import * as readline from 'readline';
import { createCard, createDeck, getAllDecks } from '../lib/db';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface SentenceAnalysis {
  original_sentence: string;
  translation: string;
  words: {
    spanish: string;
    english: string;
    base_form: string;
  }[];
}

interface WordWithSentences {
  spanish_word: string;
  translation: string;
  sentences: {
    spanish: string;
    cloze: string;
  }[];
}

interface CardData {
  spanish_word: string;
  translation: string;
  context_sentence: string;
  cloze_sentence: string;
}

async function analyzeSentence(sentence: string): Promise<SentenceAnalysis> {
  const prompt = `Analyze this Spanish sentence for a language learner.

Sentence: "${sentence}"

Provide:
1. The full English translation
2. A list of vocabulary words with their translations (focus on content words - nouns, verbs, adjectives, adverbs - skip common words like "el", "y", "fue", "ella")

Respond in JSON only:
{
  "original_sentence": "the original Spanish sentence",
  "translation": "full English translation",
  "words": [
    { "spanish": "word as it appears", "english": "translation", "base_form": "dictionary form if different" }
  ]
}`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No response from Claude');
  }

  const jsonMatch = textContent.text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, textContent.text];
  const jsonStr = jsonMatch[1] || textContent.text;

  return JSON.parse(jsonStr.trim());
}

function createClozeCard(word: string, sentence: string): string {
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  return sentence.replace(regex, `{{c1::${word}}}`);
}

async function generateExtraSentences(
  word: string,
  baseForm: string,
  translation: string,
  originalSentence: string,
  count: number = 2
): Promise<{ spanish: string; cloze: string }[]> {
  const prompt = `Generate ${count} additional Spanish sentences using the word "${baseForm}" (${translation}).

Requirements:
- Beginner to intermediate level
- Different contexts from: "${originalSentence}"
- Natural, everyday usage

Respond in JSON only:
{
  "sentences": [
    { "spanish": "sentence here", "cloze": "sentence with {{c1::${word}}} format" }
  ]
}`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No response from Claude');
  }

  const jsonMatch = textContent.text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, textContent.text];
  const jsonStr = jsonMatch[1] || textContent.text;

  const parsed = JSON.parse(jsonStr.trim());
  return parsed.sentences;
}

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function parseArgs(args: string[]) {
  const result = {
    save: false,
    deckName: '',
    sentence: '',
    extraSentences: 0, // number of extra sentences per word
  };

  let i = 0;
  while (i < args.length) {
    if (args[i] === '--save' || args[i] === '-s') {
      result.save = true;
      i++;
    } else if (args[i] === '--deck' || args[i] === '-d') {
      result.deckName = args[i + 1] || '';
      i += 2;
    } else if (args[i] === '--extra' || args[i] === '-e') {
      result.extraSentences = parseInt(args[i + 1] || '2', 10);
      i += 2;
    } else {
      result.sentence = args.slice(i).join(' ');
      break;
    }
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let { sentence, save, deckName, extraSentences } = args;

  if (!sentence) {
    sentence = await askQuestion('Enter a Spanish sentence: ');
  }

  if (!sentence.trim()) {
    console.log('No sentence provided');
    process.exit(1);
  }

  console.log(`\nAnalyzing: "${sentence}"...\n`);

  const analysis = await analyzeSentence(sentence);

  const divider = '─'.repeat(60);
  console.log(divider);
  console.log(`Translation: ${analysis.translation}`);
  console.log(divider);
  console.log('\nVocabulary found:');

  analysis.words.forEach((word, i) => {
    const baseNote = word.base_form !== word.spanish ? ` (${word.base_form})` : '';
    console.log(`  ${i + 1}. ${word.spanish}${baseNote} = ${word.english}`);
  });

  // Build cards - one per word initially, with original sentence
  const cards: CardData[] = [];

  for (const word of analysis.words) {
    const baseForm = word.base_form || word.spanish;

    // Add card with original sentence
    cards.push({
      spanish_word: baseForm,
      translation: word.english,
      context_sentence: analysis.original_sentence,
      cloze_sentence: createClozeCard(word.spanish, analysis.original_sentence),
    });

    // Generate extra sentences if requested
    if (extraSentences > 0) {
      console.log(`\nGenerating ${extraSentences} extra sentences for "${baseForm}"...`);
      const extras = await generateExtraSentences(
        word.spanish,
        baseForm,
        word.english,
        analysis.original_sentence,
        extraSentences
      );

      for (const extra of extras) {
        cards.push({
          spanish_word: baseForm,
          translation: word.english,
          context_sentence: extra.spanish,
          cloze_sentence: extra.cloze,
        });
      }
    }
  }

  console.log(`\n${divider}`);
  console.log(`Cards (${cards.length} total):\n`);

  let currentWord = '';
  cards.forEach((card, i) => {
    if (card.spanish_word !== currentWord) {
      currentWord = card.spanish_word;
      console.log(`  ${card.spanish_word} = ${card.translation}`);
    }
    console.log(`    ${i + 1}. ${card.cloze_sentence}`);
  });

  if (save) {
    console.log(`\n${divider}`);

    // Get or create deck
    let deckId: string;
    if (deckName) {
      const existingDecks = await getAllDecks();
      const existing = existingDecks.find(d => d.name.toLowerCase() === deckName.toLowerCase());
      if (existing) {
        deckId = existing.id;
        console.log(`Using existing deck: ${existing.name}`);
      } else {
        const newDeck = await createDeck(deckName);
        deckId = newDeck.id;
        console.log(`Created new deck: ${deckName}`);
      }
    } else {
      // Use default deck or prompt
      const decks = await getAllDecks();
      if (decks.length === 0) {
        const newDeck = await createDeck('Default');
        deckId = newDeck.id;
        console.log('Created default deck');
      } else {
        deckId = decks[0].id;
        console.log(`Using deck: ${decks[0].name}`);
      }
    }

    // Save cards
    console.log(`\nSaving ${cards.length} cards...`);
    for (const card of cards) {
      await createCard({
        deck_id: deckId,
        spanish_word: card.spanish_word,
        translation: card.translation,
        context_sentence: card.context_sentence,
        cloze_sentence: card.cloze_sentence,
      });
    }
    console.log(`✓ Saved ${cards.length} cards to database`);
  } else {
    console.log(`\n💡 Add --save to save cards, --extra 2 for extra sentences`);
  }
}

main().catch(console.error);
