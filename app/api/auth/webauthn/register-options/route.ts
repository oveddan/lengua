import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { neon } from '@neondatabase/serverless';
import { v4 as uuidv4 } from 'uuid';
import { getCredentialsByUserId, saveChallenge, getRpConfig } from '@/lib/webauthn';

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const dbSql = neon(process.env.DATABASE_URL!);
  const sessions = await dbSql`SELECT * FROM sessions WHERE token = ${sessionToken} AND expires_at > NOW()`;
  if (sessions.length === 0) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const userId = sessions[0].user_id as string;
  const users = await dbSql`SELECT * FROM users WHERE id = ${userId}`;
  if (users.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const user = users[0];
  const existingCredentials = await getCredentialsByUserId(userId);
  const origin = request.headers.get('origin') || request.nextUrl.origin;
  const { rpName, rpID } = getRpConfig(origin);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.username as string,
    userID: new TextEncoder().encode(userId),
    attestationType: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'required',
    },
    excludeCredentials: existingCredentials.map(c => ({
      id: c.credential_id,
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
  });

  const challengeId = uuidv4();
  await saveChallenge(challengeId, options.challenge, userId);

  return NextResponse.json({ options, challengeId });
}
