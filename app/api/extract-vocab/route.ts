import { NextRequest, NextResponse } from 'next/server';
import { extractVocab } from '@/lib/vocab-extraction';

export async function POST(request: NextRequest) {
  const { question, title } = await request.json();

  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  const result = await extractVocab(question, title);

  return NextResponse.json(result);
}
