#!/usr/bin/env npx tsx

/**
 * Tests for pure lib functions (no DB or API key required)
 *
 * Usage:
 *   pnpm test:lib
 */

import { extractJsonFromResponse, DISAMBIGUATING_TRANSLATION_INSTRUCTIONS } from '../lib/claude-helpers';
import { generateCloze } from '../lib/card-generation';
import { shuffleWithSpacing, shuffleArray, getBaseWord } from '../lib/card-spacing';
import { buildConversationContext } from '../lib/conversation';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n${name}`);
  console.log('─'.repeat(50));
}

// ─── extractJsonFromResponse ───

section('extractJsonFromResponse');

assert(
  JSON.parse(extractJsonFromResponse('{"a":1}')).a === 1,
  'plain JSON',
);

assert(
  JSON.parse(extractJsonFromResponse('```json\n{"a":1}\n```')).a === 1,
  'JSON in ```json code block',
);

assert(
  JSON.parse(extractJsonFromResponse('```\n{"a":1}\n```')).a === 1,
  'JSON in ``` code block (no language)',
);

assert(
  JSON.parse(extractJsonFromResponse('Here is the result:\n{"a":1}')).a === 1,
  'JSON with leading text',
);

assert(
  JSON.parse(extractJsonFromResponse('  \n  {"a":1}  \n  ')).a === 1,
  'JSON with whitespace padding',
);

const complexJson = `\`\`\`json
{
  "original_sentence": "El conductor fue asesinado",
  "translation": "The driver was murdered",
  "phrases": [
    { "spanish": "fue asesinado", "english": "was murdered" }
  ],
  "words": [
    { "spanish": "conductor", "english": "driver" }
  ]
}
\`\`\``;
const complexParsed = JSON.parse(extractJsonFromResponse(complexJson));
assert(
  complexParsed.phrases.length === 1 && complexParsed.words.length === 1,
  'complex JSON with nested arrays',
);

// ─── generateCloze ───

section('generateCloze');

assert(
  generateCloze('Hola amigo', 'Hola') === '{{c1::Hola}} amigo',
  'word at start of sentence',
);

assert(
  generateCloze('Mi amigo está aquí', 'amigo') === 'Mi {{c1::amigo}} está aquí',
  'word in middle of sentence',
);

assert(
  generateCloze('¿Cómo estás?', 'estás') === '¿Cómo {{c1::estás}}?',
  'word before punctuation',
);

assert(
  generateCloze('¡Hola! ¿Cómo estás?', 'Hola') === '¡{{c1::Hola}}! ¿Cómo estás?',
  'word after ¡ and before !',
);

assert(
  generateCloze('Ella estiró la mano', 'estiró') === 'Ella {{c1::estiró}} la mano',
  'accented characters',
);

// Case insensitive
const clozeCI = generateCloze('hola amigo', 'Hola');
assert(
  clozeCI.includes('{{c1::Hola}}'),
  'case insensitive match preserves replacement case',
);

// Word that doesn't appear
assert(
  generateCloze('Hola amigo', 'perro') === 'Hola amigo',
  'word not in sentence returns original',
);

// Word with regex special chars (parentheses in phrase)
assert(
  generateCloze('Él se dio cuenta', 'dio') === 'Él se {{c1::dio}} cuenta',
  'word near other words with no special issues',
);

// ─── getBaseWord ───

section('getBaseWord');

assert(getBaseWord('hablar') === 'hablar', 'simple word');
assert(getBaseWord('hablar (present)') === 'hablar', 'word with parenthetical');
assert(getBaseWord('HABLAR') === 'hablar', 'uppercased word lowered');
assert(getBaseWord('tener que ver') === 'tener que ver', 'multi-word phrase (≤3 words)');
assert(getBaseWord('no me digas nada') === 'no me digas', 'phrase truncated to 3 words');

// ─── shuffleArray ───

section('shuffleArray');

assert(shuffleArray([]).length === 0, 'empty array');
assert(shuffleArray([1]).length === 1, 'single element');

const original = [1, 2, 3, 4, 5];
const shuffled = shuffleArray(original);
assert(original[0] === 1 && original[4] === 5, 'does not mutate original');
assert(shuffled.length === 5, 'preserves length');
assert(shuffled.sort((a, b) => a - b).join(',') === '1,2,3,4,5', 'preserves all elements');

// ─── shuffleWithSpacing ───

section('shuffleWithSpacing');

assert(shuffleWithSpacing([]).length === 0, 'empty array');

const singleCard = [{ id: '1', spanish_word: 'hola' }];
assert(shuffleWithSpacing(singleCard).length === 1, 'single card');

// Cards with same base word should be spaced apart
const relatedCards = [
  { id: '1', spanish_word: 'hablar (present yo)' },
  { id: '2', spanish_word: 'hablar (present tú)' },
  { id: '3', spanish_word: 'hablar (preterite yo)' },
  { id: '4', spanish_word: 'comer' },
  { id: '5', spanish_word: 'vivir' },
  { id: '6', spanish_word: 'dormir' },
];
const spaced = shuffleWithSpacing(relatedCards);
assert(spaced.length === 6, 'preserves all cards');

// Check that hablar cards are not all adjacent
const hablarIndices = spaced
  .map((c, i) => getBaseWord(c.spanish_word) === 'hablar' ? i : -1)
  .filter(i => i >= 0);

let allAdjacent = true;
for (let i = 1; i < hablarIndices.length; i++) {
  if (hablarIndices[i] - hablarIndices[i - 1] > 1) {
    allAdjacent = false;
    break;
  }
}
assert(!allAdjacent, 'related cards (hablar) are spaced apart, not all adjacent');

// All IDs preserved
const spacedIds = spaced.map(c => c.id).sort();
assert(spacedIds.join(',') === '1,2,3,4,5,6', 'all card IDs preserved');

// ─── buildConversationContext ───

section('buildConversationContext');

assert(buildConversationContext([]) === '', 'empty exchanges');

const exchanges = [
  { input: 'How do you say hello?', response_main: 'Hola' },
  { input: 'And goodbye?', response_main: 'Adiós' },
];

const ctx = buildConversationContext(exchanges);
assert(ctx.includes('You: How do you say hello?'), 'includes first input');
assert(ctx.includes('Assistant: Hola'), 'includes first response');
assert(ctx.includes('You: And goodbye?'), 'includes second input');
assert(ctx.includes('Assistant: Adiós'), 'includes second response');

// ─── DISAMBIGUATING_TRANSLATION_INSTRUCTIONS ───

section('DISAMBIGUATING_TRANSLATION_INSTRUCTIONS');

assert(
  DISAMBIGUATING_TRANSLATION_INSTRUCTIONS.includes('meter'),
  'contains meter example',
);
assert(
  DISAMBIGUATING_TRANSLATION_INSTRUCTIONS.includes('conocer'),
  'contains conocer example',
);

// ─── Summary ───

console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(50));

if (failed > 0) {
  process.exit(1);
}
