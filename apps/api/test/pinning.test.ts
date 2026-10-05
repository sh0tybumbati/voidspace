import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { disconnect, makePost, makeSpace, makeUser, resetDb, startServer, type TestServer, type TestUser } from './helpers';

let s: TestServer;
let prisma: typeof import('../src/db').prisma;
before(async () => { s = await startServer(); ({ prisma } = await import('../src/db')); await resetDb(); });
after(async () => { await s.close(); await disconnect(); });

describe('pinned posts', () => {
  let founder: TestUser; let member: TestUser; let space: { id: string; name: string };
  const posts: { id: string }[] = [];
  const pin = (token: string, body: object) => s.call('POST', '/api/mod/pin-post', { token, body });
  const unpin = (token: string, body: object) => s.call('POST', '/api/mod/unpin-post', { token, body });
  const feed = (token?: string, query = '') => s.call('GET', `/api/spaces/${space.name}/posts${query}`, { token });

  before(async () => {
    founder = await makeUser(s, 'pinfounder'); member = await makeUser(s, 'pinmember');
    space = await makeSpace(s, founder, 'pinspace');
    await s.call('POST', `/api/spaces/${space.name}/subscribe`, { token: member.token });
    for (let i = 1; i <= 4; i++) posts.push(await makePost(s, i === 4 ? founder : member, space.id, `Post ${i}`));
  });

  it('only moderators can pin, and pins sit at the top of the first page only', async () => {
    assert.equal((await pin(member.token, { postId: posts[0].id })).status, 403);
    assert.equal((await pin(founder.token, { postId: posts[0].id })).status, 200);
    assert.equal((await pin(founder.token, { postId: posts[0].id })).status, 409, 'already pinned');

    // make the pinned post the oldest and lowest scoring, so only the pin can put it first
    await prisma.post.update({ where: { id: posts[0].id }, data: { voteScore: -5, hotScore: -5, createdAt: new Date(Date.now() - 30 * 86_400_000) } });
    for (const sort of ['hot', 'new', 'top']) {
      const res = await feed(undefined, `?sort=${sort}`);
      assert.equal(res.json.posts[0].id, posts[0].id, `${sort}: pinned first`);
      assert.equal(res.json.posts[0].isPinned, true);
      assert.equal(res.json.posts.filter((p: any) => p.id === posts[0].id).length, 1, 'never listed twice');
    }
    const page2 = await feed(undefined, '?limit=1&page=2');
    assert.ok(!page2.json.posts.some((p: any) => p.isPinned), 'only the first page carries pins');
    assert.equal((await s.call('GET', `/api/spaces/${space.name}/pinned`)).json.posts.length, 1);
  });

  it('logs every pin publicly, with a reason, and tells the author', async () => {
    const log = await s.call('GET', `/api/mod/${space.name}/log`);
    const entry = log.json.actions.find((a: any) => a.actionType === 'pin_post');
    assert.ok(entry, 'the pin is in the public mod log');
    assert.match(entry.reason, /Pinned/);
    const note = await s.call('GET', '/api/notifications', { token: member.token });
    assert.ok(note.json.notifications.some((n: any) => n.type === 'post_pinned' && n.link.endsWith(posts[0].id)));
  });

  it('holds two pins: a third is refused until one is chosen to replace', async () => {
    assert.equal((await pin(founder.token, { postId: posts[1].id, reason: 'Weekly thread, read first.' })).status, 200);
    const full = await pin(founder.token, { postId: posts[2].id });
    assert.equal(full.status, 409);
    assert.equal(full.json.code, 'pins_full');
    assert.match(full.json.message, /Post 1/);
    assert.equal((await pin(founder.token, { postId: posts[2].id, replacePostId: posts[3].id })).status, 400, 'must name a pinned post');

    const swapped = await pin(founder.token, { postId: posts[2].id, replacePostId: posts[0].id });
    assert.equal(swapped.status, 200);
    assert.equal(swapped.json.replacedPostId, posts[0].id);
    const pinned = (await s.call('GET', `/api/spaces/${space.name}/pinned`)).json.posts.map((p: any) => p.title);
    assert.deepEqual(pinned, ['Post 3', 'Post 2'], 'newest pin first');
    const log = (await s.call('GET', `/api/mod/${space.name}/log`)).json.actions.map((a: any) => a.actionType);
    assert.ok(log.includes('unpin_post'), 'the replaced pin is logged as an unpin');
  });

  it('unpinning works and is logged; removed posts lose their pin; removed posts cannot be pinned', async () => {
    assert.equal((await unpin(member.token, { postId: posts[1].id })).status, 403);
    assert.equal((await unpin(founder.token, { postId: posts[3].id })).status, 409, 'not pinned');
    assert.equal((await unpin(founder.token, { postId: posts[1].id, reason: 'Thread is over.' })).status, 200);
    assert.equal((await prisma.post.findUniqueOrThrow({ where: { id: posts[1].id } })).pinnedAt, null);

    assert.equal((await s.call('POST', '/api/mod/remove-post', { token: founder.token, body: { postId: posts[2].id, reason: 'Taking this one down.' } })).status, 200);
    const gone = await prisma.post.findUniqueOrThrow({ where: { id: posts[2].id } });
    assert.equal(gone.isPinned, false, 'removal unpins');
    assert.equal((await s.call('GET', `/api/spaces/${space.name}/pinned`)).json.posts.length, 0);
    assert.equal((await pin(founder.token, { postId: posts[2].id })).status, 400, 'a removed post cannot be pinned');

    await pin(founder.token, { postId: posts[3].id });
    assert.equal((await s.call('DELETE', `/api/posts/${posts[3].id}`, { token: founder.token })).status, 200);
    const left = await prisma.post.findUnique({ where: { id: posts[3].id } });
    assert.ok(!left || (!left.isPinned && left.pinnedAt === null), 'deleting your own post leaves nothing pinned');
    assert.equal((await s.call('GET', `/api/spaces/${space.name}/pinned`)).json.posts.length, 0);
  });
});

describe('private space post listing', () => {
  it('does not leak a private space\'s posts through /api/spaces/:name/posts', async () => {
    const owner = await makeUser(s, 'leakowner'); const outsider = await makeUser(s, 'leakoutsider');
    const space = await makeSpace(s, owner, 'leakspace');
    await makePost(s, owner, space.id, 'Members only chatter');
    assert.equal((await s.call('GET', `/api/spaces/${space.name}/posts`)).status, 200, 'public: fine');

    await prisma.space.update({ where: { id: space.id }, data: { isPrivate: true } });
    for (const token of [undefined, outsider.token]) {
      const r = await s.call('GET', `/api/spaces/${space.name}/posts`, { token });
      assert.equal(r.status, 403);
      assert.equal(r.json.code, 'private_space');
      assert.equal((await s.call('GET', `/api/spaces/${space.name}/pinned`, { token })).status, 404);
    }
    assert.equal((await s.call('GET', `/api/spaces/${space.name}/posts`, { token: owner.token })).json.posts.length, 1);

    await prisma.space.update({ where: { id: space.id }, data: { deletedAt: new Date() } });
    assert.equal((await s.call('GET', `/api/spaces/${space.name}/posts`, { token: owner.token })).status, 404);
  });
});
