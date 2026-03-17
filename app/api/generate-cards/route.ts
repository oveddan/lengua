import { NextRequest, NextResponse } from 'next/server';
import { generateCards, SelectedWord } from '@/lib/card-generation';

export async function POST(request: NextRequest) {
  const { originalSentence, selectedWords, skipOriginal, userContext } = await request.json() as {
    originalSentence: string;
    selectedWords: SelectedWord[];
    skipOriginal?: boolean;
    userContext?: string;
  };

  if (!originalSentence || !selectedWords || selectedWords.length === 0) {
    return NextResponse.json({ error: 'originalSentence and selectedWords are required' }, { status: 400 });
  }

  const cards = await generateCards(originalSentence, selectedWords, { skipOriginal, userContext });

  return NextResponse.json({ cards });
}
