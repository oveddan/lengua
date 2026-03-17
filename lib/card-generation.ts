import { callClaudeJson } from './claude-helpers';

export interface SelectedWord {
  spanish: string;
  english: string;
  base_form: string;
  extraSentences: number;
}

export interface GeneratedCard {
  spanish_word: string;
  translation: string;
  context_sentence: string;
  cloze_sentence: string;
}

export function generateCloze(originalSentence: string, spanishWord: string): string {
  const escaped = spanishWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return originalSentence.replace(
    new RegExp(`(^|[\\s¿¡])${escaped}([\\s.,!?;:]|$)`, 'gi'),
    `$1{{c1::${spanishWord}}}$2`
  );
}

export async function generateExtraSentences(
  baseForm: string,
  english: string,
  spanishWord: string,
  count: number,
  userContext?: string,
): Promise<Array<{ spanish: string; cloze: string }>> {
  const contextHint = userContext
    ? `\n- IMPORTANT: The user is learning this word in the context of: "${userContext}". Generate sentences relevant to this context.`
    : '';

  const prompt = `Generate ${count} additional Spanish sentences using the word "${baseForm}" (${english}).

Requirements:
- Beginner to intermediate level
- Natural, everyday usage${contextHint}

Respond in JSON only:
{
  "sentences": [
    { "spanish": "sentence here", "cloze": "sentence with {{c1::${spanishWord}}} format" }
  ]
}`;

  const result = await callClaudeJson<{ sentences: Array<{ spanish: string; cloze: string }> }>(prompt, 500);
  return result.sentences;
}

export async function generateCards(
  originalSentence: string,
  selectedWords: SelectedWord[],
  options?: { skipOriginal?: boolean; userContext?: string },
): Promise<GeneratedCard[]> {
  const cards: GeneratedCard[] = [];

  for (const word of selectedWords) {
    const baseForm = word.base_form || word.spanish;

    // Original sentence card (skip for lookups where original is explanatory text)
    if (!options?.skipOriginal) {
      const cloze = generateCloze(originalSentence, word.spanish);
      cards.push({
        spanish_word: baseForm,
        translation: word.english,
        context_sentence: originalSentence,
        cloze_sentence: cloze,
      });
    }

    // Generate extra sentences if requested
    if (word.extraSentences > 0) {
      const sentences = await generateExtraSentences(
        baseForm,
        word.english,
        word.spanish,
        word.extraSentences,
        options?.userContext,
      );

      for (const extra of sentences) {
        cards.push({
          spanish_word: baseForm,
          translation: word.english,
          context_sentence: extra.spanish,
          cloze_sentence: extra.cloze,
        });
      }
    }
  }

  return cards;
}
