import { NextRequest, NextResponse } from 'next/server';
import { hasAnyCredentials } from '@/lib/webauthn';

export async function GET(_request: NextRequest) {
  const available = await hasAnyCredentials();
  return NextResponse.json({ available });
}
