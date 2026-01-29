const AUTH_SECRET = process.env.AUTH_SECRET || 'development-secret-change-in-production';

// Convert string to Uint8Array
function stringToArrayBuffer(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert ArrayBuffer to hex string
function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Base64 encode (works in both Node and Edge)
function base64Encode(str: string): string {
  if (typeof btoa !== 'undefined') {
    return btoa(str);
  }
  return Buffer.from(str).toString('base64');
}

// Base64 decode (works in both Node and Edge)
function base64Decode(str: string): string {
  if (typeof atob !== 'undefined') {
    return atob(str);
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

async function getKey(): Promise<CryptoKey> {
  const keyData = stringToArrayBuffer(AUTH_SECRET);
  return crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signToken(payload: Record<string, unknown>): Promise<string> {
  const data = JSON.stringify(payload);
  const key = await getKey();
  const dataBuffer = stringToArrayBuffer(data);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    dataBuffer.buffer as ArrayBuffer
  );
  const signatureHex = arrayBufferToHex(signature);
  return base64Encode(data) + '.' + signatureHex;
}

export async function verifyToken(token: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedData, signature] = parts;
  const data = base64Decode(encodedData);
  const key = await getKey();
  const dataBuffer = stringToArrayBuffer(data);

  const expectedSignature = await crypto.subtle.sign(
    'HMAC',
    key,
    dataBuffer.buffer as ArrayBuffer
  );
  const expectedSignatureHex = arrayBufferToHex(expectedSignature);

  if (signature !== expectedSignatureHex) return null;

  return JSON.parse(data);
}

export async function createAuthCookie(username: string): Promise<string> {
  const token = await signToken({ username, timestamp: Date.now() });
  return `auth=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`; // 7 days
}

export function clearAuthCookie(): string {
  return 'auth=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0';
}
