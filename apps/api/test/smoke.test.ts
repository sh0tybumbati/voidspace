import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { disconnect, makePost, makeSpace, makeUser, resetDb, startServer, type TestServer } from './helpers';

describe('existing behaviour (smoke)', () => {
  let s: TestServer;
  before(async () => { s = await startServer(); await resetDb(); });
  after(async () => { await s.close(); await disconnect(); });

  it('health and unknown endpoints', async () => {
    assert.equal((await s.call('GET', '/health')).status, 200);
    const missing = await s.call('GET', '/api/nope');
    assert.equal(missing.status, 404);
  });

  it('register, sign in, and read yourself', async () => {
    const u = await makeUser(s, 'alice');
    const me = await s.call('GET', '/api/auth/me', { token: u.token });
    assert.equal(me.status, 200);
    assert.equal(me.json.user.username, 'alice');
    assert.equal((await s.call('GET', '/api/auth/me')).status, 401);
    const dup = await s.call('POST', '/api/auth/register', { body: { username: 'alice', email: 'x@example.test', password: 'Passw0rd!test-9' } });
    assert.ok(dup.status >= 400 && dup.status < 500, 'duplicate usernames are refused');
    const bad = await s.call('POST', '/api/auth/login', { body: { username: 'alice', password: 'wrong' } });
    assert.equal(bad.status, 401);
  });

  it('spaces, posts, comments, votes and saves', async () => {
    const owner = await makeUser(s, 'bob');
    const space = await makeSpace(s, owner, 'gardening');
    const post = await makePost(s, owner, space.id, 'Tomatoes');
    const feed = await s.call('GET', `/api/posts/spaces/${space.name}/posts`);
    assert.equal(feed.json.posts.length, 1);

    const reader = await makeUser(s, 'carol');
    const comment = await s.call('POST', '/api/comments', { token: reader.token, body: { postId: post.id, content: 'nice' } });
    assert.equal(comment.status, 201);
    const vote = await s.call('POST', `/api/posts/${post.id}/vote`, { token: reader.token, body: { voteValue: '1' } });
    assert.equal(vote.status, 200);
    const saved = await s.call('POST', `/api/posts/${post.id}/save`, { token: reader.token });
    assert.ok(saved.status < 300);
    const thread = await s.call('GET', `/api/comments/posts/${post.id}/comments`);
    assert.equal(thread.json.comments.length, 1);
    const search = await s.call('GET', '/api/search?q=tomatoes');
    assert.equal(search.status, 200);
  });

  it('moderators can remove content, with a reason, and it lands in the public log', async () => {
    const mod = await makeUser(s, 'dave');
    const space = await makeSpace(s, mod, 'cooking');
    const author = await makeUser(s, 'erin');
    const post = await makePost(s, author, space.id, 'Spam');
    const tooShort = await s.call('POST', '/api/mod/remove-post', { token: mod.token, body: { postId: post.id, reason: 'no' } });
    assert.equal(tooShort.status, 400);
    const removed = await s.call('POST', '/api/mod/remove-post', { token: mod.token, body: { postId: post.id, reason: 'This is spam, please stop.' } });
    assert.equal(removed.status, 200);
    const log = await s.call('GET', `/api/mod/${space.name}/log`);
    assert.equal(log.json.actions.length, 1);
    const outsider = await s.call('POST', '/api/mod/remove-post', { token: author.token, body: { postId: post.id, reason: 'Trying to remove my own.' } });
    assert.equal(outsider.status, 403);
  });
});
