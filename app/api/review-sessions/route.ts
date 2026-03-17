import { NextRequest, NextResponse } from 'next/server';
import {
  createReviewSession,
  getReviewSession,
  updateReviewSessionIndex,
  deleteReviewSession,
  cleanupOldReviewSessions,
  getDueCards,
  getStudyAheadCards,
  getCard,
} from '@/lib/db';
import { shuffleWithSpacing } from '@/lib/card-spacing';

// POST: Create a new review session
export async function POST(request: NextRequest) {
  // Clean up old sessions
  await cleanupOldReviewSessions();

  const body = await request.json();
  const deckId = body.deckId || null;
  const studyAhead = body.studyAhead === true;

  // Get cards based on mode
  let cards;
  if (studyAhead) {
    cards = await getStudyAheadCards(deckId || undefined, 20);
  } else {
    cards = await getDueCards(deckId || undefined);
  }

  if (cards.length === 0) {
    return NextResponse.json({ error: 'No cards available' }, { status: 404 });
  }

  // Shuffle with spacing to spread related cards apart
  const shuffledCards = shuffleWithSpacing(cards);
  const cardIds = shuffledCards.map(c => c.id);

  // Create session
  const session = await createReviewSession(cardIds, deckId || undefined, studyAhead);

  return NextResponse.json({
    id: session.id,
    totalCards: cardIds.length,
    studyAhead: session.study_ahead === 1,
  });
}

// GET: Get session details
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  const session = await getReviewSession(id);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const cardIds = JSON.parse(session.card_order) as string[];
  const cards = (await Promise.all(cardIds.map(id => getCard(id)))).filter(Boolean);

  return NextResponse.json({
    id: session.id,
    deckId: session.deck_id,
    cards,
    currentIndex: session.current_index,
    studyAhead: session.study_ahead === 1,
    totalCards: cardIds.length,
  });
}

// PATCH: Update session progress
export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  const body = await request.json();

  if (typeof body.currentIndex === 'number') {
    await updateReviewSessionIndex(id, body.currentIndex);
  }

  const session = await getReviewSession(id);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, currentIndex: session.current_index });
}

// DELETE: End a session
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  await deleteReviewSession(id);
  return NextResponse.json({ success: true });
}
