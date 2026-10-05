import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { disconnect, makePost, makeSpace, makeUser, resetDb, startServer, type TestServer } from './helpers';

let s: TestServer;
before(async () => { s = await startServer(); await resetDb(); });
after(async () => { await s.close(); await disconnect(); });

/** Read server-sent events until `want` named events have arrived (or time runs out). */
async function readEvents(res: Response, want: string[], ms = 4000): Promise<{ event: string; data: any }[]> {
  const reader = res.body!.getReader(); const dec = new TextDecoder();
  const got: { event: string; data: any }[] = []; let buf = '';
  const deadline = Date.now() + ms;
  let pending: Promise<ReadableStreamReadResult<Uint8Array>> | null = null;   // never start a second read while one is outstanding
  while (Date.now() < deadline && !want.every((w) => got.some((g) => g.event === w))) {
    pending ??= reader.read();
    const r = await Promise.race([pending, new Promise<null>((resolve) => setTimeout(() => resolve(null), 300))]);
    if (!r) continue;
    pending = null;
    if (r.done) break;
    buf += dec.decode(r.value, { stream: true });
    let i; while ((i = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = /event: (.*)/.exec(block)?.[1]; const data = /data: (.*)/.exec(block)?.[1];
      if (ev && data) got.push({ event: ev, data: JSON.parse(data) });
    }
  }
  await reader.cancel().catch(() => undefined);
  return got;
}

describe('notifications', () => {
  it('replying to someone notifies them, and they can read and clear them', async () => {
    const author = await makeUser(s, 'nauthor'); const reader = await makeUser(s, 'nreader');
    const space = await makeSpace(s, author, 'notifyspace'); const post = await makePost(s, author, space.id, 'Hello');
    await s.call('POST', '/api/comments', { token: reader.token, body: { postId: post.id, content: 'First!' } });
    const top = (await s.call('GET', '/api/comments/posts/' + post.id + '/comments')).json.comments[0];
    await s.call('POST', '/api/comments', { token: author.token, body: { postId: post.id, parentCommentId: top.id, content: 'Thanks for reading' } });
    await s.call('POST', '/api/comments', { token: author.token, body: { postId: post.id, content: 'talking to myself' } });

    const mine = await s.call('GET', '/api/notifications', { token: author.token });
    assert.equal(mine.json.unreadCount, 1, 'a comment on your own post, from someone else');
    assert.equal(mine.json.notifications[0].type, 'post_reply');
    assert.match(mine.json.notifications[0].link, new RegExp(`/v/notifyspace/${post.id}#comment-`));
    const theirs = await s.call('GET', '/api/notifications', { token: reader.token });
    assert.equal(theirs.json.notifications[0].type, 'comment_reply');
    assert.equal((await s.call('GET', '/api/notifications')).status, 401);

    assert.equal((await s.call('POST', '/api/notifications/read', { token: author.token, body: {} })).status, 400);
    assert.equal((await s.call('POST', '/api/notifications/read', { token: reader.token, body: { ids: [mine.json.notifications[0].id] } })).json.marked, 0, 'cannot touch other people\'s notifications');
    assert.equal((await s.call('POST', '/api/notifications/read', { token: author.token, body: { ids: [mine.json.notifications[0].id] } })).json.marked, 1);
    assert.equal((await s.call('GET', '/api/notifications/unread-count', { token: author.token })).json.count, 0);
    assert.equal((await s.call('POST', '/api/notifications/read', { token: reader.token, body: { all: true } })).json.marked, 1);
  });
});

describe('live stream', () => {
  it('delivers a user\'s notifications and a thread\'s new comments, with single-use tickets', async () => {
    const author = await makeUser(s, 'sauthor'); const other = await makeUser(s, 'sother1');
    const space = await makeSpace(s, author, 'streamspace'); const post = await makePost(s, author, space.id, 'Live thread');

    const ticket = (await s.call('POST', '/api/stream/ticket', { token: author.token })).json.ticket;
    assert.equal((await s.call('POST', '/api/stream/ticket')).status, 401);
    const stream = await fetch(`${s.base}/api/stream?ticket=${ticket}&channels=post:${post.id}`);
    assert.equal(stream.status, 200);
    assert.match(stream.headers.get('content-type') ?? '', /text\/event-stream/);

    const events = readEvents(stream, ['ready', 'notification', 'comment']);
    await new Promise((r) => setTimeout(r, 300));
    await s.call('POST', '/api/comments', { token: other.token, body: { postId: post.id, content: 'A live reply' } });
    const got = await events;
    assert.ok(got.some((e) => e.event === 'ready'));
    const note = got.find((e) => e.event === 'notification');
    assert.equal(note?.data.type, 'post_reply');
    assert.ok(got.find((e) => e.event === 'comment'), 'the thread channel gets the comment');
    assert.equal(got.find((e) => e.event === 'comment')?.data.author, 'sother1');

    assert.equal((await fetch(`${s.base}/api/stream?ticket=${ticket}`)).status, 401, 'a ticket works once');
  });

  it('anonymous visitors can watch a thread; other people\'s notifications never leak', async () => {
    const a = await makeUser(s, 'wauthor'); const b = await makeUser(s, 'wother'); const c = await makeUser(s, 'wthird');
    const space = await makeSpace(s, a, 'watchspace'); const post = await makePost(s, a, space.id, 'Watch me');
    const watch = await fetch(`${s.base}/api/stream?channels=post:${post.id}`);
    const events = readEvents(watch, ['ready', 'comment'], 2500);
    await new Promise((r) => setTimeout(r, 300));
    await s.call('POST', '/api/comments', { token: b.token, body: { postId: post.id, content: 'hello watchers' } });
    const got = await events;
    assert.ok(got.some((e) => e.event === 'comment'));
    assert.ok(!got.some((e) => e.event === 'notification'), 'anonymous watchers see no private events');

    const tCticket = (await s.call('POST', '/api/stream/ticket', { token: c.token })).json.ticket;
    const mine = await fetch(`${s.base}/api/stream?ticket=${tCticket}`);
    const mineEvents = readEvents(mine, ['notification'], 1500);
    await s.call('POST', '/api/comments', { token: b.token, body: { postId: post.id, content: 'this notifies the author, not c' } });
    assert.ok(!(await mineEvents).some((e) => e.event === 'notification'));
  });

  it('rejects bad requests', async () => {
    assert.equal((await fetch(`${s.base}/api/stream`)).status, 400, 'needs a ticket or channel');
    assert.equal((await fetch(`${s.base}/api/stream?channels=user:123`)).status, 400, 'private channels cannot be requested directly');
    assert.equal((await fetch(`${s.base}/api/stream?channels=${Array.from({ length: 11 }, (_, i) => `post:00000000-0000-4000-8000-${String(i).padStart(12, '0')}`).join(',')}`)).status, 400);
  });
});
