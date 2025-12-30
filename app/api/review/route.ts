import { NextRequest, NextResponse } from 'next/server';
import { getCard, updateCard } from '@/lib/db';
import {
  scheduleCard,
  getButtonPreviews,
  AnswerButton,
  DEFAULT_CONFIG,
} from '@/lib/anki-scheduler';

export async function POST(request: NextRequest) {
  const { cardId, quality } = await request.json();

  if (!cardId || !quality) {
    return NextResponse.json(
      { error: 'cardId and quality are required' },
      { status: 400 }
    );
  }

  const validQualities: AnswerButton[] = ['again', 'hard', 'good', 'easy'];
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

  // Use the new Anki scheduler
  const result = scheduleCard(card, quality as AnswerButton, DEFAULT_CONFIG);

  const updatedCard = updateCard(cardId, {
    queue: result.queue,
    learning_step: result.learning_step,
    interval: result.interval,
    ease_factor: result.ease_factor,
    next_review: result.next_review,
    lapses: result.lapses,
  });

  // Return the updated card plus scheduling info for the UI
  return NextResponse.json({
    ...updatedCard,
    scheduledSecs: result.scheduledSecs,
  });
}

// GET endpoint to get button previews for a card
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get('cardId');

  if (!cardId) {
    return NextResponse.json(
      { error: 'cardId is required' },
      { status: 400 }
    );
  }

  const card = getCard(cardId);
  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  const previews = getButtonPreviews(card, DEFAULT_CONFIG);
  return NextResponse.json({ card, previews });
}
