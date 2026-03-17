import { NextRequest, NextResponse } from 'next/server';
import { analyzeSentence } from '@/lib/sentence-analyzer';

export async function POST(request: NextRequest) {
  const { sentence } = await request.json();

  if (!sentence || typeof sentence !== 'string') {
    return NextResponse.json({ error: 'sentence is required' }, { status: 400 });
  }

  const analysis = await analyzeSentence(sentence);

  return NextResponse.json(analysis);
}
