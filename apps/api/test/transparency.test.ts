import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { disconnect, makePost, makeSpace, makeUser, resetDb, startServer, type TestServer, type TestUser } from './helpers';

let s: TestServer;
let prisma: typeof import('../src/db').prisma;
let admin: TestUser, user: TestUser, other: TestUser;

before(async () => {
  s = await startServer(); ({ prisma } = await import('../src/db')); await resetDb();
  admin = await makeUser(s, 'tadmin', { admin: true }); user = await makeUser(s, 'tuser'); other = await makeUser(s, 'tother');
});
after(async () => { await s.close(); await disconnect(); });

describe('admin actions are justified and public', () => {
  it('banning or promoting needs a justification of at least 20 characters', async () => {
    const path = `/api/admin/users/${user.id}`;
    assert.equal((await s.call('PATCH', path, { token: user.token, body: { banned: true, justification: 'x'.repeat(30) } })).status, 403, 'admins only');
    assert.equal((await s.call('PATCH', path, { token: admin.token, body: { banned: true } })).status, 400, 'no justification');
    assert.equal((await s.call('PATCH', path, { token: admin.token, body: { banned: true, justification: 'too short' } })).status, 400);
    assert.equal((await s.call('PATCH', path, { token: admin.token, body: { justification: 'x'.repeat(30) } })).status, 400, 'nothing to change');
    assert.equal((await s.call('PATCH', `/api/admin/users/${admin.id}`, { token: admin.token, body: { banned: true, justification: 'Banning myself for no reason.' } })).status, 400, 'not yourself');
  });

  it('a justified change is applied and appears in the public feed', async () => {
    const res = await s.call('PATCH', `/api/admin/users/${user.id}`, { token: admin.token, body: { banned: true, justification: 'Repeated posting of illegal material, see report 12.' } });
    assert.equal(res.status, 200);
    assert.equal(res.json.user.banned, true);
    const feed = await s.call('GET', '/api/transparency/admin-actions');
    assert.equal(feed.status, 200, 'public, no sign-in');
    assert.equal(feed.json.actions[0].admin, 'tadmin');
    assert.equal(feed.json.actions[0].actionType, 'ban_user');
    assert.match(feed.json.actions[0].justification, /illegal material/);
    // unchanged values are not logged again
    await s.call('PATCH', `/api/admin/users/${user.id}`, { token: admin.token, body: { banned: true, justification: 'Banning someone who is already banned.' } });
    assert.equal((await s.call('GET', '/api/transparency/admin-actions')).json.pagination.totalCount, 1);
    const login = await s.call('POST', '/api/auth/login', { body: { username: 'tuser', password: 'Passw0rd!test-9' } });
    assert.equal(login.status, 403, 'a banned account cannot sign in');
  });

  it('admins can remove illegal content site-wide, in public, and resolve site-level reports', async () => {
    const owner = await makeUser(s, 'towner'); const space = await makeSpace(s, owner, 'tspace'); const post = await makePost(s, other, space.id, 'bad post');
    await s.call('POST', '/api/reports', { token: owner.token, body: { targetType: 'post', targetId: post.id, category: 'illegal' } });
    const queue = await s.call('GET', '/api/admin/reports', { token: admin.token });
    assert.equal(queue.json.reports.length, 1);
    assert.equal((await s.call('GET', '/api/admin/reports', { token: owner.token })).status, 403);
    assert.equal((await s.call('POST', '/api/admin/reports/resolve', { token: admin.token, body: { targetType: 'post', targetId: post.id, action: 'remove', justification: 'short' } })).status, 400);
    const ok = await s.call('POST', '/api/admin/reports/resolve', { token: admin.token, body: { targetType: 'post', targetId: post.id, action: 'remove', justification: 'Confirmed illegal content; removed under site policy.' } });
    assert.equal(ok.status, 200);
    assert.equal((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).removed, true);
    assert.equal(await prisma.notification.count({ where: { userId: other.id, type: 'content_removed_admin' } }), 1);
    const feed = (await s.call('GET', '/api/transparency/admin-actions')).json.actions.map((a: any) => a.actionType);
    assert.ok(feed.includes('remove_post'));
  });
});

describe('legal notices and the canary', () => {
  it('only admins can publish a legal notice; everyone can read them', async () => {
    const body = { noticeType: 'dmca', jurisdiction: 'US', dateReceived: '2026-09-01', actionTaken: 'Removed the listed post after review.', publicSummary: 'A DMCA request about one post.' };
    assert.equal((await s.call('POST', '/api/admin/legal-notices', { token: user.token, body })).status, 403, 'a banned user cannot act');
    assert.equal((await s.call('POST', '/api/admin/legal-notices', { token: other.token, body })).status, 403);
    assert.equal((await s.call('POST', '/api/admin/legal-notices', { token: admin.token, body: { ...body, noticeType: 'rumour' } })).status, 400);
    assert.equal((await s.call('POST', '/api/admin/legal-notices', { token: admin.token, body })).status, 201);
    const list = await s.call('GET', '/api/transparency/legal-notices');
    assert.equal(list.json.notices.length, 1);
    assert.equal(list.json.notices[0].noticeType, 'dmca');
  });

  it('the canary is none, then valid, then expired', async () => {
    assert.equal((await s.call('GET', '/api/transparency/canary')).json.status, 'none');
    const tomorrow = new Date(Date.now() + 86_400_000 * 30).toISOString();
    assert.equal((await s.call('POST', '/api/admin/canary', { token: admin.token, body: { statement: 'short', validUntil: tomorrow } })).status, 400);
    assert.equal((await s.call('POST', '/api/admin/canary', { token: admin.token, body: { statement: 'We have received no secret orders and have not been gagged.', validUntil: new Date(Date.now() - 1000).toISOString() } })).status, 400, 'must be in the future');
    assert.equal((await s.call('POST', '/api/admin/canary', { token: admin.token, body: { statement: 'We have received no secret orders and have not been gagged.', validUntil: new Date(Date.now() + 900 * 86_400_000).toISOString() } })).status, 400, 'renew within a year');
    assert.equal((await s.call('POST', '/api/admin/canary', { token: admin.token, body: { statement: 'We have received no secret orders and have not been gagged.', validUntil: tomorrow } })).status, 201);
    const c = (await s.call('GET', '/api/transparency/canary')).json;
    assert.equal(c.status, 'valid');
    assert.ok(c.daysLeft >= 29);
    await prisma.transparencyCanary.updateMany({ data: { validUntil: new Date(Date.now() - 86_400_000) } });
    assert.equal((await s.call('GET', '/api/transparency/canary')).json.status, 'expired');
    const sum = await s.call('GET', '/api/transparency/summary');
    assert.equal(sum.json.canary.status, 'expired');
    assert.equal(sum.json.legalNotices, 1);
    assert.ok(sum.json.last30Days.adminActions >= 3);
  });

  it('recent moderator actions are public across all spaces', async () => {
    const mod = await makeUser(s, 'tmod'); const space = await makeSpace(s, mod, 'tmodspace'); const p = await makePost(s, other, space.id, 'x');
    await s.call('POST', '/api/mod/remove-post', { token: mod.token, body: { postId: p.id, reason: 'Removed as an example.' } });
    const feed = await s.call('GET', '/api/transparency/mod-actions');
    assert.equal(feed.json.actions[0].space, 'tmodspace');
  });
});
