import { NextRequest, NextResponse } from 'next/server';
import { chatAssist } from '@/lib/chat-assistant';

export async function POST(request: NextRequest) {
  const { input, sessionId } = await request.json();

  if (!input || typeof input !== 'string') {
    return NextResponse.json({ error: 'input is required' }, { status: 400 });
  }

  const result = await chatAssist(input, sessionId);

  return NextResponse.json(result);
}
