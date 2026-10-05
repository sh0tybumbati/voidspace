import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { disconnect, makePost, makeSpace, makeUser, resetDb, startServer, type TestServer, type TestUser } from './helpers';

process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'voidspace-account-uploads-'));   // before the app mounts /uploads

let s: TestServer;
let prisma: typeof import('../src/db').prisma;
let outbox: typeof import('../src/lib/mailer').outbox;
before(async () => { s = await startServer(); ({ prisma } = await import('../src/db')); ({ outbox } = await import('../src/lib/mailer')); await resetDb(); });
after(async () => { await s.close(); await disconnect(); });

const PASSWORD = 'Passw0rd!test-9';
const del = (u: TestUser, body: object = { password: PASSWORD }) => s.call('POST', '/api/account/delete', { token: u.token, body });
const png = (w: number) => sharp({ create: { width: w, height: 80, channels: 3, background: '#aa3366' } }).png().toBuffer();
const upload = (u: TestUser, data: Buffer) => fetch(`${s.base}/api/uploads`, { method: 'POST', headers: { 'content-type': 'image/png', authorization: `Bearer ${u.token}` }, body: data as any }).then((r) => r.json() as Promise<any>);

describe('data export', () => {
  it('gives the caller their own data and nothing else', async () => {
    const me = await makeUser(s, 'exporter'); const other = await makeUser(s, 'exportbystander');
    const space = await makeSpace(s, me, 'exportspace');
    const post = await makePost(s, me, space.id, 'My exported post');
    await makePost(s, other, space.id, 'Somebody else secret post');
    await s.call('POST', `/api/comments`, { token: me.token, body: { postId: post.id, content: 'My exported comment' } });

    assert.equal((await s.call('GET', '/api/account/export')).status, 401);
    const res = await s.call('GET', '/api/account/export', { token: me.token });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition') ?? '', /attachment; filename="voidspace-exporter-export\.json"/);
    const text = JSON.stringify(res.json);
    assert.equal(res.json.account.username, 'exporter');
    assert.equal(res.json.account.email, 'exporter@example.test');
    assert.deepEqual(res.json.posts.map((p: any) => p.title), ['My exported post']);
    assert.deepEqual(res.json.comments.map((c: any) => c.content), ['My exported comment']);
    assert.ok(res.json.moderatorRoles.some((m: any) => m.space.name === 'exportspace' && m.isFounder));
    assert.ok(!text.includes('Somebody else secret post'), 'other people\'s content is not included');
    assert.ok(!/passwordHash|password_hash|\$2[aby]\$/.test(text), 'no password hash');
  });
});

describe('account deletion', () => {
  it('needs the right password, and a blocker stops it with the reason', async () => {
    const founder = await makeUser(s, 'delfounder'); const member = await makeUser(s, 'delmember');
    const space = await makeSpace(s, founder, 'delspace');
    await s.call('POST', `/api/spaces/${space.name}/subscribe`, { token: member.token });

    assert.equal((await del(founder, { password: 'not-the-password' })).status, 403);
    assert.equal((await del(founder, {})).status, 400);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: founder.id } })).deletedAt, null, 'a wrong password changes nothing');

    const check = await s.call('GET', '/api/account/deletion-check', { token: founder.token });
    assert.equal(check.json.blockers.length, 1);
    assert.match(check.json.blockers[0], /only moderator of v\/delspace/);
    const blocked = await del(founder);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.json.code, 'deletion_blocked');

    const admin = await makeUser(s, 'deladmin', { admin: true });
    assert.match((await del(admin)).json.message, /site admin/);
  });

  it('a founder whose space has nobody else takes the space with them', async () => {
    const solo = await makeUser(s, 'delsolo'); const space = await makeSpace(s, solo, 'solospace');
    const check = await s.call('GET', '/api/account/deletion-check', { token: solo.token });
    assert.deepEqual(check.json.willClose, ['solospace']);
    assert.equal((await del(solo)).status, 200);
    assert.ok((await prisma.space.findUniqueOrThrow({ where: { id: space.id } })).deletedAt);
    assert.equal((await s.call('GET', '/api/spaces/solospace')).status, 404);
  });

  it('anonymises the account but keeps the conversation and the public record intact', async () => {
    const mod = await makeUser(s, 'keepmod'); const leaver = await makeUser(s, 'keepleaver', { ageDays: 40 }); const other = await makeUser(s, 'keepother');
    const space = await makeSpace(s, mod, 'keepspace');
    await s.call('POST', `/api/spaces/${space.name}/subscribe`, { token: leaver.token });
    await s.call('POST', `/api/spaces/${space.name}/subscribe`, { token: other.token });
    const before = (await prisma.space.findUniqueOrThrow({ where: { id: space.id } })).subscriberCount;
    const post = await makePost(s, leaver, space.id, 'A post that stays');
    const theirs = (await s.call('POST', '/api/comments', { token: leaver.token, body: { postId: post.id, content: 'I said this' } })).json.comment;
    const reply = (await s.call('POST', '/api/comments', { token: other.token, body: { postId: post.id, content: 'A reply to it', parentCommentId: theirs.id } })).json.comment;
    await s.call('POST', `/api/posts/${post.id}/save`, { token: leaver.token });
    await s.call('POST', `/api/posts/${post.id}/vote`, { token: leaver.token, body: { voteValue: 1 } });
    const removal = await s.call('POST', '/api/mod/remove-comment', { token: mod.token, body: { commentId: theirs.id, reason: 'Removed for testing the log.' } });
    assert.ok([200, 201].includes(removal.status), JSON.stringify(removal.json));
    outbox.length = 0;

    assert.equal((await del(leaver)).status, 200);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: leaver.id } });
    assert.match(row.username, /^deleted_[0-9a-f]{8}$/);
    assert.equal(row.email, `${row.username}@deleted.invalid`);
    assert.equal(row.bio, null);
    assert.ok(row.deletedAt);
    assert.ok(!row.passwordHash.startsWith('$2'), 'the hash is gone and cannot match anything');

    assert.equal((await s.call('GET', '/api/auth/me', { token: leaver.token })).status, 401, 'the old session is dead');
    assert.equal((await s.call('POST', '/api/auth/login', { body: { username: 'keepleaver', password: PASSWORD } })).status, 401, 'the old name no longer signs in');
    assert.equal((await s.call('POST', '/api/auth/register', { body: { username: 'keepleaver2', email: 'keepleaver@example.test', password: PASSWORD } })).status, 201, 'the email address is free again');
    assert.equal((await s.call('POST', '/api/auth/register', { body: { username: 'deleted_abc123', email: 'sneaky@example.test', password: PASSWORD } })).status, 400, 'tombstone names are reserved');

    const thread = (await s.call('GET', `/api/posts/${post.id}`)).json.post;
    assert.equal(thread.title, 'A post that stays');
    assert.equal(thread.author.username, row.username);
    assert.equal((await prisma.comment.findUniqueOrThrow({ where: { id: reply.id } })).parentCommentId, theirs.id, 'the reply still hangs off the comment');
    assert.equal((await prisma.space.findUniqueOrThrow({ where: { id: space.id } })).subscriberCount, before - 1);
    assert.equal(await prisma.savedPost.count({ where: { userId: leaver.id } }), 0);
    assert.equal(await prisma.vote.count({ where: { userId: leaver.id } }), 0);
    assert.equal(await prisma.modAction.count({ where: { spaceId: space.id } }), 1, 'the public mod log still has the removal');
    assert.equal((await s.call('GET', `/api/users/${row.username}`)).status, 404);
    assert.equal((await s.call('GET', '/api/search?q=keepleaver&type=users')).json.users.length, 1, 'only the new account, not the deleted one');

    const mail = outbox.find((m) => m.to === 'keepleaver@example.test');
    assert.ok(mail && /deleted/i.test(mail.subject), 'the old address is told');
  });

  it('with deleteContent, text and uploaded images go too, and elections as a candidate are withdrawn', async () => {
    const founder = await makeUser(s, 'wipefounder', { ageDays: 90 }); const wiper = await makeUser(s, 'wipewiper', { ageDays: 60 });
    const space = await makeSpace(s, founder, 'wipespace');
    await s.call('POST', `/api/spaces/${space.name}/subscribe`, { token: wiper.token });
    const img = await upload(wiper, await png(111));
    const post = (await s.call('POST', '/api/posts', { token: wiper.token, body: { spaceId: space.id, title: 'A picture to wipe', postType: 'image', url: img.url } })).json.post;
    const comment = (await s.call('POST', '/api/comments', { token: wiper.token, body: { postId: post.id, content: 'Words to wipe' } })).json.comment;
    assert.equal((await fetch(s.base + img.url)).status, 200);

    const mp = await makePost(s, wiper, space.id, 'Alignment post'); await prisma.post.update({ where: { id: mp.id }, data: { voteScore: 150 } });
    const stand = await s.call('POST', `/api/spaces/${space.name}/elections`, { token: wiper.token, body: { type: 'add_mod' } });
    assert.equal(stand.status, 201, JSON.stringify(stand.json));

    assert.equal((await del(wiper, { password: PASSWORD, deleteContent: true })).status, 200);

    assert.equal((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).title, '[deleted]');
    assert.equal((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).url, null);
    assert.equal((await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).content, '[deleted by author]');
    assert.equal(await prisma.upload.count({ where: { userId: wiper.id } }), 0);
    assert.equal((await fetch(s.base + img.url)).status, 404, 'the file itself is gone');
    assert.equal((await prisma.modElection.findUniqueOrThrow({ where: { id: stand.json.election.id } })).status, 'withdrawn');
  });
});
