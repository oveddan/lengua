import { NextRequest, NextResponse } from 'next/server';
import { getCard, updateCard } from '@/lib/db';
import { reviewCard, SimpleQuality } from '@/lib/sm2';

export async function POST(request: NextRequest) {
  const { cardId, quality } = await request.json();

  if (!cardId || !quality) {
    return NextResponse.json(
      { error: 'cardId and quality are required' },
      { status: 400 }
    );
  }

  const validQualities: SimpleQuality[] = ['again', 'hard', 'good', 'easy'];
  if (!validQualities.includes(quality)) {
    return NextResponse.json(
      { error: 'quality must be one of: again, hard, good, easy' },
      { status: 400 }
    );
  }

  const card = getCard(cardId);
  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  const sm2Result = reviewCard(card, quality as SimpleQuality);
  const updatedCard = updateCard(cardId, sm2Result);

  return NextResponse.json(updatedCard);
}
