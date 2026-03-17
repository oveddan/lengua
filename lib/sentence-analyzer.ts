import { callClaudeJson, DISAMBIGUATING_TRANSLATION_INSTRUCTIONS } from './claude-helpers';

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

${DISAMBIGUATING_TRANSLATION_INSTRUCTIONS}

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

${DISAMBIGUATING_TRANSLATION_INSTRUCTIONS}

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

  const analysis = await callClaudeJson<Record<string, unknown>>(prompt);

  return {
    original_sentence: analysis.original_sentence as string,
    translation: analysis.translation as string,
    phrases: (analysis.phrases as SentenceAnalysis['phrases']) || [],
    words: (analysis.words as SentenceAnalysis['words']) || [],
    is_verb: (analysis.is_verb as boolean) || false,
    infinitive: (analysis.infinitive as string) || null,
    conjugations: (analysis.conjugations as SentenceAnalysis['conjugations']) || null,
  };
}
