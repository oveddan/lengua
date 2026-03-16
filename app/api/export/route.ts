import { NextRequest, NextResponse } from 'next/server';
import { exportToAnki, getExportFileName } from '@/lib/anki-export';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deckId = searchParams.get('deckId') || undefined;
  const format = (searchParams.get('format') as 'basic' | 'cloze') || 'cloze';
  const includeContext = searchParams.get('includeContext') !== 'false';

  const content = await exportToAnki({ deckId, format, includeContext });
  const filename = await getExportFileName(deckId);

  return NextResponse.json({ content, filename });
}
