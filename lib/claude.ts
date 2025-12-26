import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface TranslationResult {
  spanish_word: string;
  translation: string;
  context_sentence: string;
  cloze_sentence: string;
}

/**
 * Translate a Spanish word and generate a context sentence using Claude
 */
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

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extract the text content
  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse the JSON response
  const responseText = textContent.text.trim();

  // Handle case where response might be wrapped in markdown code blocks
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, responseText];
  const jsonStr = jsonMatch[1] || responseText;

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      spanish_word: spanishWord.toLowerCase().trim(),
      translation: parsed.translation,
      context_sentence: parsed.context_sentence,
      cloze_sentence: parsed.cloze_sentence,
    };
  } catch {
    throw new Error(`Failed to parse Claude response: ${responseText}`);
  }
}

/**
 * Batch translate multiple words
 */
export async function translateWords(words: string[]): Promise<TranslationResult[]> {
  const results = await Promise.all(words.map((word) => translateWord(word)));
  return results;
}
