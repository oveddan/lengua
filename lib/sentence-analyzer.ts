import { anthropic, extractJsonFromResponse, getTextFromResponse } from './claude-helpers';

export interface SentenceAnalysis {
  original_sentence: string;
  translation: string;
  phrases: Array<{ spanish: string; english: string; base_form?: string }>;
  words: Array<{ spanish: string; english: string; base_form?: string }>;
  is_verb: boolean;
  infinitive: string | null;
  conjugations: Record<string, Array<{ pronoun: string; form: string; sentence: string; sentence_english: string }>> | null;
}

function buildSingleWordPrompt(word: string): string {
  return `Analyze this Spanish word for a language learner.

Word: "${word}"

If this is a verb (or conjugated form of a verb), provide conjugations WITH example sentences for each. For the example sentences, sometimes include the subject pronoun (yo, tú, él/ella, nosotros, ellos) and sometimes omit it - mix it up randomly like natural Spanish speakers do. If not a verb, just provide the translation.

IMPORTANT for translations: When a word has common synonyms in Spanish, provide a disambiguating translation that distinguishes it from similar words. For example:
- "meter" → "to put (into enclosed space)" not just "to put"
- "poner" → "to put (place on surface)" not just "to put"
- "coger" → "to grab/catch" not just "to take"
- "tomar" → "to take (consume/accept)" not just "to take"
- "saber" → "to know (facts/how to)" not just "to know"
- "conocer" → "to know (be familiar with)" not just "to know"

Respond in JSON only:
{
  "original_sentence": "the word as given",
  "translation": "English translation",
  "is_verb": true,
  "infinitive": "infinitive form",
  "conjugations": {
    "present": [
      { "pronoun": "yo", "form": "conjugated form", "sentence": "Example sentence using this form", "sentence_english": "English translation" },
      { "pronoun": "tú", "form": "conjugated form", "sentence": "Example sentence", "sentence_english": "English translation" },
      { "pronoun": "él/ella", "form": "conjugated form", "sentence": "Example sentence", "sentence_english": "English translation" },
      { "pronoun": "nosotros", "form": "conjugated form", "sentence": "Example sentence", "sentence_english": "English translation" },
      { "pronoun": "ellos/ustedes", "form": "conjugated form", "sentence": "Example sentence", "sentence_english": "English translation" }
    ],
    "preterite": [
      { "pronoun": "yo", "form": "conjugated form", "sentence": "Example sentence", "sentence_english": "English translation" },
      { "pronoun": "tú", "form": "conjugated form", "sentence": "Example sentence", "sentence_english": "English translation" },
      { "pronoun": "él/ella", "form": "conjugated form", "sentence": "Example sentence", "sentence_english": "English translation" },
      { "pronoun": "nosotros", "form": "conjugated form", "sentence": "Example sentence", "sentence_english": "English translation" },
      { "pronoun": "ellos/ustedes", "form": "conjugated form", "sentence": "Example sentence", "sentence_english": "English translation" }
    ],
    "imperative": [
      { "pronoun": "tú (affirmative)", "form": "conjugated form", "sentence": "Example command", "sentence_english": "English translation" },
      { "pronoun": "tú (negative)", "form": "no + form", "sentence": "Example negative command", "sentence_english": "English translation" },
      { "pronoun": "usted", "form": "conjugated form", "sentence": "Example formal command", "sentence_english": "English translation" }
    ]
  },
  "phrases": [],
  "words": [
    { "spanish": "the word", "english": "translation", "base_form": "infinitive" }
  ]
}

If NOT a verb, use this simpler format:
{
  "original_sentence": "the word",
  "translation": "English translation",
  "is_verb": false,
  "phrases": [],
  "words": [
    { "spanish": "the word", "english": "translation", "base_form": "base form if different" }
  ]
}`;
}

function buildSentencePrompt(sentence: string): string {
  return `Analyze this Spanish sentence for a language learner.

Sentence: "${sentence}"

Provide:
1. The full English translation
2. Common phrases/idioms in the sentence (multi-word expressions that should be learned together, like "hay manera de" = "is there a way to", "tener que" = "to have to", etc.)
3. Individual vocabulary words (focus on content words - nouns, verbs, adjectives, adverbs - skip very common words like "el", "la", "y", "de", "en", "a", "que", "es", "un", "una", and skip words that are already part of a phrase above)

IMPORTANT for translations: When a word has common synonyms in Spanish, provide a disambiguating translation that distinguishes it from similar words. For example:
- "meter" → "to put (into enclosed space)" not just "to put"
- "poner" → "to put (place on surface)" not just "to put"
- "coger" → "to grab/catch" not just "to take"
- "tomar" → "to take (consume/accept)" not just "to take"
- "saber" → "to know (facts/how to)" not just "to know"
- "conocer" → "to know (be familiar with)" not just "to know"

Respond in JSON only:
{
  "original_sentence": "the original Spanish sentence",
  "translation": "full English translation",
  "phrases": [
    { "spanish": "multi-word phrase", "english": "disambiguating translation", "base_form": "dictionary form if different" }
  ],
  "words": [
    { "spanish": "word as it appears", "english": "disambiguating translation", "base_form": "dictionary form if different" }
  ]
}`;
}

export async function analyzeSentence(sentence: string): Promise<SentenceAnalysis> {
  const isSingleWord = sentence.trim().split(/\s+/).length === 1;

  const prompt = isSingleWord
    ? buildSingleWordPrompt(sentence)
    : buildSentencePrompt(sentence);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = getTextFromResponse(message);
  const analysis = JSON.parse(extractJsonFromResponse(text));

  return {
    original_sentence: analysis.original_sentence,
    translation: analysis.translation,
    phrases: analysis.phrases || [],
    words: analysis.words || [],
    is_verb: analysis.is_verb || false,
    infinitive: analysis.infinitive || null,
    conjugations: analysis.conjugations || null,
  };
}
