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

// Helper functions for card spacing (copied from review page, should eventually be in lib/)
function getBaseWord(word: string): string {
  const base = word.split('(')[0].trim().toLowerCase();
  return base.split(' ').slice(0, 3).join(' ');
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

interface CardLike {
  id: string;
  spanish_word: string;
}

function shuffleWithSpacing(cards: CardLike[]): CardLike[] {
  if (cards.length <= 1) return cards;

  // Group cards by base word
  const groups = new Map<string, CardLike[]>();
  for (const card of cards) {
    const base = getBaseWord(card.spanish_word);
    if (!groups.has(base)) {
      groups.set(base, []);
    }
    groups.get(base)!.push(card);
  }

  // Shuffle within each group
  const groupArrays: CardLike[][] = [];
  for (const [, groupCards] of groups) {
    groupArrays.push(shuffleArray(groupCards));
  }

  // Sort groups by size (largest first for better spacing)
  groupArrays.sort((a, b) => b.length - a.length);

  // Build result by interleaving groups
  const result: CardLike[] = [];
  const groupIndices = groupArrays.map(() => 0);

  while (result.length < cards.length) {
    let bestGroup = -1;
    let bestScore = -1;

    for (let g = 0; g < groupArrays.length; g++) {
      if (groupIndices[g] >= groupArrays[g].length) continue;

      const candidate = groupArrays[g][groupIndices[g]];
      const candidateBase = getBaseWord(candidate.spanish_word);

      // Calculate score based on distance from last card of same group
      let minDistance = result.length + 1;
      for (let i = result.length - 1; i >= 0 && i >= result.length - 5; i--) {
        if (getBaseWord(result[i].spanish_word) === candidateBase) {
          minDistance = result.length - i;
          break;
        }
      }

      if (minDistance > bestScore) {
        bestScore = minDistance;
        bestGroup = g;
      }
    }

    if (bestGroup >= 0) {
      result.push(groupArrays[bestGroup][groupIndices[bestGroup]]);
      groupIndices[bestGroup]++;
    }
  }

  return result;
}

// POST: Create a new review session
export async function POST(request: NextRequest) {
  // Clean up old sessions
  cleanupOldReviewSessions();

  const body = await request.json();
  const deckId = body.deckId || null;
  const studyAhead = body.studyAhead === true;

  // Get cards based on mode
  let cards;
  if (studyAhead) {
    cards = getStudyAheadCards(deckId || undefined, 20);
  } else {
    cards = getDueCards(deckId || undefined);
  }

  if (cards.length === 0) {
    return NextResponse.json({ error: 'No cards available' }, { status: 404 });
  }

  // Shuffle with spacing to spread related cards apart
  const shuffledCards = shuffleWithSpacing(cards);
  const cardIds = shuffledCards.map(c => c.id);

  // Create session
  const session = createReviewSession(cardIds, deckId || undefined, studyAhead);

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

  const session = getReviewSession(id);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const cardIds = JSON.parse(session.card_order) as string[];
  const cards = cardIds.map(id => getCard(id)).filter(Boolean);

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
    updateReviewSessionIndex(id, body.currentIndex);
  }

  const session = getReviewSession(id);
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

  deleteReviewSession(id);
  return NextResponse.json({ success: true });
}
