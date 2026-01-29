import { NextRequest, NextResponse } from 'next/server';
import { createAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  const validUsername = process.env.AUTH_USERNAME;
  const validPassword = process.env.AUTH_PASSWORD;

  if (!validUsername || !validPassword) {
    return NextResponse.json(
      { error: 'Authentication not configured' },
      { status: 500 }
    );
  }

  if (username === validUsername && password === validPassword) {
    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', await createAuthCookie(username));
    return response;
  }

  return NextResponse.json(
    { error: 'Invalid username or password' },
    { status: 401 }
  );
}
