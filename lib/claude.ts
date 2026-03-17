import { callClaudeJson } from './claude-helpers';

export interface TranslationResult {
  spanish_word: string;
  translation: string;
  context_sentence: string;
  cloze_sentence: string;
}

export async function translateWord(spanishWord: string): Promise<TranslationResult> {
  const prompt = `You are a Spanish language learning assistant. Given a Spanish word, provide:
1. The English translation (most common meaning)
2. A natural Spanish sentence using this word in context (beginner to intermediate level)
3. The same sentence with the word replaced by a cloze deletion format {{c1::word}}

Respond in JSON format only, no other text:
{
  "translation": "english translation",
  "context_sentence": "Spanish sentence using the word",
  "cloze_sentence": "Spanish sentence with {{c1::word}} format"
}

Spanish word: ${spanishWord}`;

  const parsed = await callClaudeJson<{ translation: string; context_sentence: string; cloze_sentence: string }>(prompt, 500);

  return {
    spanish_word: spanishWord.toLowerCase().trim(),
    translation: parsed.translation,
    context_sentence: parsed.context_sentence,
    cloze_sentence: parsed.cloze_sentence,
  };
}

export async function translateWords(words: string[]): Promise<TranslationResult[]> {
  return Promise.all(words.map((word) => translateWord(word)));
}
