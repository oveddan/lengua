import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export { anthropic };

export const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

export const DISAMBIGUATING_TRANSLATION_INSTRUCTIONS = `IMPORTANT for translations: When a word has common synonyms in Spanish, provide a disambiguating translation that distinguishes it from similar words. For example:
- "meter" → "to put (into enclosed space)" not just "to put"
- "poner" → "to put (place on surface)" not just "to put"
- "coger" → "to grab/catch" not just "to take"
- "tomar" → "to take (consume/accept)" not just "to take"
- "saber" → "to know (facts/how to)" not just "to know"
- "conocer" → "to know (be familiar with)" not just "to know"`;

export function extractJsonFromResponse(text: string): string {
  let jsonStr = text.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '');
    jsonStr = jsonStr.replace(/\n?```$/, '');
  }

  // Find JSON boundaries
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }

  return jsonStr.trim();
}

export function getTextFromResponse(message: Anthropic.Message): string {
  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }
  return textContent.text;
}

export async function callClaudeJson<T>(prompt: string, maxTokens: number = 1000): Promise<T> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = getTextFromResponse(message);
  return JSON.parse(extractJsonFromResponse(text));
}
