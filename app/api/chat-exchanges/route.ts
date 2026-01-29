import { NextRequest, NextResponse } from 'next/server';
import { getChatExchangesBySession, deleteChatExchange } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const exchanges = await getChatExchangesBySession(sessionId);
  return NextResponse.json({ exchanges });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  await deleteChatExchange(id);
  return NextResponse.json({ success: true });
}
