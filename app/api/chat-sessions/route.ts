import { NextRequest, NextResponse } from 'next/server';
import {
  getAllChatSessions,
  createChatSession,
  deleteChatSession,
  updateChatSession,
  getChatExchangesBySession,
} from '@/lib/db';

export async function GET() {
  const sessions = await getAllChatSessions();
  // Include exchange count for each session
  const sessionsWithStats = await Promise.all(
    sessions.map(async session => ({
      ...session,
      exchangeCount: (await getChatExchangesBySession(session.id)).length,
    }))
  );
  return NextResponse.json({ sessions: sessionsWithStats });
}

export async function POST(request: NextRequest) {
  const { name } = await request.json();
  const session = await createChatSession(name?.trim() || undefined);
  return NextResponse.json(session);
}

export async function PATCH(request: NextRequest) {
  const { id, name } = await request.json();

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  const session = await updateChatSession(id, { name: name?.trim() || null });
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  await deleteChatSession(id);
  return NextResponse.json({ success: true });
}
