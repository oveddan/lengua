import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getAndDeleteChallenge, saveCredential, getRpConfig } from '@/lib/webauthn';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

export async function POST(request: NextRequest) {
  const { challengeId, credential } = await request.json();

  const stored = await getAndDeleteChallenge(challengeId);
  if (!stored) {
    return NextResponse.json({ error: 'Challenge expired or invalid' }, { status: 400 });
  }

  const origin = request.headers.get('origin') || request.nextUrl.origin;
  const { rpID } = getRpConfig(origin);

  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: stored.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  const { credential: regCredential, credentialBackedUp } = verification.registrationInfo;

  await saveCredential(
    regCredential.id,
    stored.user_id!,
    isoBase64URL.fromBuffer(regCredential.publicKey),
    regCredential.counter,
    credential.response.transports,
  );

  return NextResponse.json({ success: true, backedUp: credentialBackedUp });
}
