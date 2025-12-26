import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface SelectedWord {
  spanish: string;
  english: string;
  base_form: string;
  extraSentences: number; // 0, 1, 2, or 3 (0 means just original sentence)
}

export async function POST(request: NextRequest) {
  const { originalSentence, selectedWords } = await request.json() as {
    originalSentence: string;
    selectedWords: SelectedWord[];
  };

  if (!originalSentence || !selectedWords || selectedWords.length === 0) {
    return NextResponse.json({ error: 'originalSentence and selectedWords are required' }, { status: 400 });
  }

  const cards = [];

  for (const word of selectedWords) {
    const baseForm = word.base_form || word.spanish;

    // Create cloze from original sentence - escape special regex chars and handle Spanish word boundaries
    const escaped = word.spanish.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cloze = originalSentence.replace(
      new RegExp(`(^|[\\s¿¡])${escaped}([\\s.,!?;:]|$)`, 'gi'),
      `$1{{c1::${word.spanish}}}$2`
    );

    // Original sentence card
    cards.push({
      spanish_word: baseForm,
      translation: word.english,
      context_sentence: originalSentence,
      cloze_sentence: cloze,
    });

    // Generate extra sentences if requested
    if (word.extraSentences > 0) {
      const extraPrompt = `Generate ${word.extraSentences} additional Spanish sentences using the word "${baseForm}" (${word.english}).

Requirements:
- Beginner to intermediate level
- Different contexts from: "${originalSentence}"
- Natural, everyday usage

Respond in JSON only:
{
  "sentences": [
    { "spanish": "sentence here", "cloze": "sentence with {{c1::${word.spanish}}} format" }
  ]
}`;

      const extraMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: extraPrompt }],
      });

      const extraText = extraMessage.content.find((block) => block.type === 'text');
      if (extraText && extraText.type === 'text') {
        // Extract JSON from markdown code blocks if present
        let extraJsonStr = extraText.text;
        const extraMatch = extraText.text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (extraMatch && extraMatch[1]) {
          extraJsonStr = extraMatch[1];
        }
        const extraJson = JSON.parse(extraJsonStr.trim());

        for (const extra of extraJson.sentences) {
          cards.push({
            spanish_word: baseForm,
            translation: word.english,
            context_sentence: extra.spanish,
            cloze_sentence: extra.cloze,
          });
        }
      }
    }
  }

  return NextResponse.json({ cards });
}
