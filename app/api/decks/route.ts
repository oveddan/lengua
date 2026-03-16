import { NextRequest, NextResponse } from 'next/server';
import { getAllDecks, createDeck, deleteDeck, getStats } from '@/lib/db';

export async function GET() {
  const decks = await getAllDecks();
  const stats = await getStats();
  return NextResponse.json({ decks, stats });
}

export async function POST(request: NextRequest) {
  const { name } = await request.json();

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const deck = await createDeck(name.trim());
  return NextResponse.json(deck);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  await deleteDeck(id);
  return NextResponse.json({ success: true });
}
