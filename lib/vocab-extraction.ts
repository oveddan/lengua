import { callClaudeJson, DISAMBIGUATING_TRANSLATION_INSTRUCTIONS } from './claude-helpers';

export interface VocabExtractionResult {
  skippable: boolean;
  skip_reason: string | null;
  vocab: Array<{ spanish: string; english: string; base_form?: string }>;
  spanish_sentences: string[];
}

export async function extractVocab(question: string, title?: string): Promise<VocabExtractionResult> {
  const prompt = `You are a Mexican Spanish vocabulary extractor for a language learner. Given a question that someone asked about Spanish, extract the Spanish vocabulary they would want to study.

Title: "${title || ''}"
Question: "${question}"

Instructions:
- Extract all Spanish words/phrases the learner would want to study from this question
- For "How do you say X?" questions: provide the Spanish translation(s) of X
- For "Translate 'Spanish text'" questions: extract key vocabulary from the Spanish text
- For "What does X mean?" questions: return X with its English meaning
- For multi-part questions, extract vocabulary from ALL parts
- Use Mexican Spanish forms where relevant
- If the question is purely about grammar rules, writing style, or is too vague to extract specific vocabulary, mark it as skippable
- Also extract any Spanish sentences found verbatim in the question text

${DISAMBIGUATING_TRANSLATION_INSTRUCTIONS}

Respond in JSON only:
{
  "skippable": false,
  "skip_reason": null,
  "vocab": [
    { "spanish": "word or phrase", "english": "disambiguating translation", "base_form": "dictionary form if different" }
  ],
  "spanish_sentences": ["any Spanish sentences found verbatim in the question"]
}

If skippable:
{
  "skippable": true,
  "skip_reason": "Brief reason why this can't produce vocabulary cards",
  "vocab": [],
  "spanish_sentences": []
}`;

  const result = await callClaudeJson<Record<string, unknown>>(prompt);

  return {
    skippable: (result.skippable as boolean) || false,
    skip_reason: (result.skip_reason as string) || null,
    vocab: (result.vocab as VocabExtractionResult['vocab']) || [],
    spanish_sentences: (result.spanish_sentences as string[]) || [],
  };
}
