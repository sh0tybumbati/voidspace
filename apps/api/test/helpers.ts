// Test support. Tests run against a real Postgres database, wiped between files, so this file
// refuses to run unless the database name clearly says it is a test database.
import { config } from 'dotenv';
import { join } from 'node:path';
import type { Server } from 'node:http';

config({ path: join(__dirname, '..', '.env.test') });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret-not-for-production';
process.env.FRONTEND_URL ??= 'http://localhost:3200';

const dbUrl = process.env.DATABASE_URL ?? '';
if (!/\/[^/?]*_test(\?|$)/.test(dbUrl)) {
  throw new Error('Refusing to run tests: DATABASE_URL must point at a database whose name ends in "_test" (see .env.test.example).');
}

export type Call = (method: string, path: string, opts?: { body?: unknown; token?: string; headers?: Record<string, string> }) => Promise<{ status: number; json: any; headers: Headers }>;

export interface TestServer {
  base: string;
  call: Call;
  close: () => Promise<void>;
}

export async function startServer(): Promise<TestServer> {
  const { createApp } = await import('../src/app');
  const app = createApp();
  const server: Server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;
  const call: Call = async (method, path, { body, token, headers = {} } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, json, headers: res.headers };
  };
  return {
    base, call,
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections?.(); }),
  };
}

/** Wipe every table so each test file starts from nothing. */
export async function resetDb(): Promise<void> {
  const { prisma } = await import('../src/db');
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\\_prisma%'`);
  if (rows.length) await prisma.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

export async function disconnect(): Promise<void> {
  const { prisma } = await import('../src/db');
  await prisma.$disconnect();
}

let counter = 0;
export interface TestUser { id: string; username: string; token: string }

/** Register a real user through the API. */
export async function makeUser(s: TestServer, name?: string, opts: { admin?: boolean; ageDays?: number } = {}): Promise<TestUser> {
  const username = (name ?? `user${++counter}`).toLowerCase();
  const reg = await s.call('POST', '/api/auth/register', { body: { username, email: `${username}@example.test`, password: 'Passw0rd!test-9' } });
  if (reg.status >= 300) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.json)}`);
  const { prisma } = await import('../src/db');
  const data: Record<string, unknown> = {};
  if (opts.admin) data.isAdmin = true;
  if (opts.ageDays) data.createdAt = new Date(Date.now() - opts.ageDays * 86_400_000);
  if (Object.keys(data).length) await prisma.user.update({ where: { id: reg.json.user.id }, data });
  // Sign in again so admin status is in the token.
  const login = await s.call('POST', '/api/auth/login', { body: { username, password: 'Passw0rd!test-9' } });
  return { id: reg.json.user.id, username, token: login.json.token };
}

export async function makeSpace(s: TestServer, owner: TestUser, name: string) {
  const res = await s.call('POST', '/api/spaces', { token: owner.token, body: { name, displayName: name.toUpperCase() } });
  if (res.status >= 300) throw new Error(`create space failed: ${res.status} ${JSON.stringify(res.json)}`);
  return res.json.space as { id: string; name: string };
}

export async function makePost(s: TestServer, author: TestUser, spaceId: string, title = 'A post') {
  const res = await s.call('POST', '/api/posts', { token: author.token, body: { spaceId, title, content: 'body text', postType: 'text' } });
  if (res.status >= 300) throw new Error(`create post failed: ${res.status} ${JSON.stringify(res.json)}`);
  return res.json.post as { id: string };
}
