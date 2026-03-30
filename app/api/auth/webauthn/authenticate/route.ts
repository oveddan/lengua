import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getAndDeleteChallenge, getCredentialById, updateCredentialCounter, getRpConfig } from '@/lib/webauthn';
import { createSession } from '@/lib/auth';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

export async function POST(request: NextRequest) {
  const { challengeId, credential } = await request.json();

  const stored = await getAndDeleteChallenge(challengeId);
  if (!stored) {
    return NextResponse.json({ error: 'Challenge expired or invalid' }, { status: 400 });
  }

  const dbCredential = await getCredentialById(credential.id);
  if (!dbCredential) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 400 });
  }

  const origin = request.headers.get('origin') || request.nextUrl.origin;
  const { rpID } = getRpConfig(origin);

  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: stored.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: dbCredential.credential_id,
      publicKey: isoBase64URL.toBuffer(dbCredential.public_key),
      counter: dbCredential.counter,
      transports: dbCredential.transports ? JSON.parse(dbCredential.transports) : undefined,
    },
  });

  if (!verification.verified) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  await updateCredentialCounter(dbCredential.credential_id, verification.authenticationInfo.newCounter);

  const session = await createSession(dbCredential.user_id);

  const response = NextResponse.json({ success: true });
  response.cookies.set('session', session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
