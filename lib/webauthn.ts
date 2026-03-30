import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export interface WebAuthnCredential {
  credential_id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
  created_at: string;
}

export async function initWebAuthnTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      credential_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      public_key TEXT NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      transports TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      id TEXT PRIMARY KEY,
      challenge TEXT NOT NULL,
      user_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

export async function saveChallenge(id: string, challenge: string, userId?: string) {
  // Clean up old challenges (older than 5 minutes)
  await sql`DELETE FROM webauthn_challenges WHERE created_at < NOW() - INTERVAL '5 minutes'`;
  await sql`
    INSERT INTO webauthn_challenges (id, challenge, user_id)
    VALUES (${id}, ${challenge}, ${userId || null})
  `;
}

export async function getAndDeleteChallenge(id: string): Promise<{ challenge: string; user_id: string | null } | null> {
  const rows = await sql`
    DELETE FROM webauthn_challenges WHERE id = ${id}
    RETURNING challenge, user_id
  `;
  return (rows[0] as { challenge: string; user_id: string | null }) || null;
}

export async function saveCredential(
  credentialId: string,
  userId: string,
  publicKey: string,
  counter: number,
  transports?: string[],
) {
  await sql`
    INSERT INTO webauthn_credentials (credential_id, user_id, public_key, counter, transports)
    VALUES (${credentialId}, ${userId}, ${publicKey}, ${counter}, ${transports ? JSON.stringify(transports) : null})
  `;
}

export async function getCredentialsByUserId(userId: string): Promise<WebAuthnCredential[]> {
  const rows = await sql`SELECT * FROM webauthn_credentials WHERE user_id = ${userId}`;
  return rows as WebAuthnCredential[];
}

export async function getCredentialById(credentialId: string): Promise<WebAuthnCredential | null> {
  const rows = await sql`SELECT * FROM webauthn_credentials WHERE credential_id = ${credentialId}`;
  return (rows[0] as WebAuthnCredential) || null;
}

export async function getAllCredentials(): Promise<WebAuthnCredential[]> {
  const rows = await sql`SELECT * FROM webauthn_credentials`;
  return rows as WebAuthnCredential[];
}

export async function updateCredentialCounter(credentialId: string, counter: number) {
  await sql`UPDATE webauthn_credentials SET counter = ${counter} WHERE credential_id = ${credentialId}`;
}

export async function hasCredentials(userId: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM webauthn_credentials WHERE user_id = ${userId} LIMIT 1`;
  return rows.length > 0;
}

export async function hasAnyCredentials(): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM webauthn_credentials LIMIT 1`;
  return rows.length > 0;
}

export function getRpConfig(origin: string) {
  const url = new URL(origin);
  return {
    rpName: 'Spanish Flashcards',
    rpID: url.hostname,
    origin,
  };
}
