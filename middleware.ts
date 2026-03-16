import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for login page, auth API, static assets
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get('session')?.value;

  if (!sessionToken) {
    return redirectToLogin(request);
  }

  // Validate session against DB
  const dbSql = neon(process.env.DATABASE_URL!);
  const rows = await dbSql`SELECT * FROM sessions WHERE token = ${sessionToken} AND expires_at > NOW()`;

  if (rows.length === 0) {
    const response = redirectToLogin(request);
    response.cookies.delete('session');
    return response;
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
