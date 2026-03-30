import { NextResponse } from 'next/server';
import { initWebAuthnTable } from '@/lib/webauthn';

export async function POST() {
  await initWebAuthnTable();
  return NextResponse.json({ success: true });
}
