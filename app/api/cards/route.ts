import { NextRequest, NextResponse } from 'next/server';
import { getAllCards, getCardsByDeck, getDueCards, getStudyAheadCards, createCard, deleteCard, updateCard } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deckId = searchParams.get('deckId');
  const due = searchParams.get('due');
  const studyAhead = searchParams.get('studyAhead');
  const limit = searchParams.get('limit');

  if (due === 'true') {
    const cards = await getDueCards(deckId || undefined);
    return NextResponse.json(cards);
  }

  if (studyAhead === 'true') {
    const cards = await getStudyAheadCards(deckId || undefined, limit ? parseInt(limit) : 20);
    return NextResponse.json(cards);
  }

  if (deckId) {
    const cards = await getCardsByDeck(deckId);
    return NextResponse.json(cards);
  }

  const cards = await getAllCards();
  return NextResponse.json(cards);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.deck_id || !body.spanish_word || !body.translation) {
    return NextResponse.json(
      { error: 'deck_id, spanish_word, and translation are required' },
      { status: 400 }
    );
  }

  const card = await createCard({
    deck_id: body.deck_id,
    spanish_word: body.spanish_word,
    translation: body.translation,
    context_sentence: body.context_sentence || null,
    cloze_sentence: body.cloze_sentence || null,
  });

  return NextResponse.json(card);
}

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  const updates = await request.json();
  const card = await updateCard(id, updates);

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  return NextResponse.json(card);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  await deleteCard(id);
  return NextResponse.json({ success: true });
}
