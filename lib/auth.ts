import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const sql = neon(process.env.DATABASE_URL!);

export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface Session {
  token: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getUser(username: string): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE username = ${username}`;
  return (rows[0] as User) || null;
}

export async function createUser(username: string, password: string): Promise<User> {
  const id = uuidv4();
  const password_hash = await hashPassword(password);
  const rows = await sql`
    INSERT INTO users (id, username, password_hash) VALUES (${id}, ${username}, ${password_hash})
    RETURNING *
  `;
  return rows[0] as User;
}

export async function createSession(userId: string): Promise<Session> {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await sql`
    INSERT INTO sessions (token, user_id, expires_at) VALUES (${token}, ${userId}, ${expiresAt})
    RETURNING *
  `;
  return rows[0] as Session;
}

export async function validateSession(token: string): Promise<Session | null> {
  const rows = await sql`SELECT * FROM sessions WHERE token = ${token} AND expires_at > NOW()`;
  return (rows[0] as Session) || null;
}

export async function deleteSession(token: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}
