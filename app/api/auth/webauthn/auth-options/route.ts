import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { v4 as uuidv4 } from 'uuid';
import { getAllCredentials, saveChallenge, getRpConfig } from '@/lib/webauthn';

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin') || request.nextUrl.origin;
  const { rpID } = getRpConfig(origin);

  const credentials = await getAllCredentials();

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: credentials.map(c => ({
      id: c.credential_id,
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
  });

  const challengeId = uuidv4();
  await saveChallenge(challengeId, options.challenge);

  return NextResponse.json({ options, challengeId });
}
