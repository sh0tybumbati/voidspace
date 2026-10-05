import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { disconnect, makeUser, resetDb, startServer, type TestServer } from './helpers';

let s: TestServer;
let prisma: typeof import('../src/db').prisma;
before(async () => { s = await startServer(); ({ prisma } = await import('../src/db')); await resetDb(); });
after(async () => { await s.close(); await disconnect(); });

describe('tokens are checked against the live account', () => {
  it('a demoted admin loses admin powers immediately, even with an old token', async () => {
    const root = await makeUser(s, 'sroot', { admin: true }); const other = await makeUser(s, 'sother', { admin: true });
    assert.equal((await s.call('GET', '/api/admin/reports', { token: other.token })).status, 200);
    await s.call('PATCH', `/api/admin/users/${other.id}`, { token: root.token, body: { isAdmin: false, justification: 'Stepping down from admin duties as agreed.' } });
    assert.equal((await s.call('GET', '/api/admin/reports', { token: other.token })).status, 403, 'the old token no longer works as admin');
  });

  it('a banned account is locked out of everything straight away', async () => {
    const root = await makeUser(s, 'sroot2', { admin: true }); const user = await makeUser(s, 'sbanned');
    assert.equal((await s.call('GET', '/api/auth/me', { token: user.token })).status, 200);
    await s.call('PATCH', `/api/admin/users/${user.id}`, { token: root.token, body: { banned: true, justification: 'Banned for repeated, serious abuse of members.' } });
    const me = await s.call('GET', '/api/auth/me', { token: user.token });
    assert.equal(me.status, 403);
    assert.match(me.json.message, /banned/);
    assert.equal((await s.call('GET', '/api/posts', { token: user.token })).status, 200, 'public pages still work, anonymously');
  });

  it('a password change signs out older sessions', async () => {
    const user = await makeUser(s, 'spw');
    assert.equal((await s.call('GET', '/api/auth/me', { token: user.token })).status, 200);
    await prisma.user.update({ where: { id: user.id }, data: { passwordChangedAt: new Date(Date.now() + 5000) } });
    assert.equal((await s.call('GET', '/api/auth/me', { token: user.token })).status, 401);
  });

  it('a deleted account and a forged token are refused', async () => {
    const user = await makeUser(s, 'sgone');
    await prisma.user.delete({ where: { id: user.id } });
    assert.equal((await s.call('GET', '/api/auth/me', { token: user.token })).status, 401);
    assert.equal((await s.call('GET', '/api/auth/me', { token: 'not.a.token' })).status, 401);
  });
});
