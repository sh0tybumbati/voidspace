import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { disconnect, makePost, makeSpace, makeUser, resetDb, startServer, type TestServer } from './helpers';

let s: TestServer;
let prisma: typeof import('../src/db').prisma;
before(async () => { s = await startServer(); ({ prisma } = await import('../src/db')); await resetDb(); });
after(async () => { await s.close(); await disconnect(); });

describe('private and deleted spaces', () => {
  it('a private space is invisible to outsiders everywhere, and open to its members', async () => {
    const owner = await makeUser(s, 'vowner'); const member = await makeUser(s, 'vmember'); const outsider = await makeUser(s, 'voutsider');
    const space = await makeSpace(s, owner, 'secretclub'); const post = await makePost(s, owner, space.id, 'Members only banter');
    await s.call('POST', `/api/spaces/${space.name}/subscribe`, { token: member.token });
    await prisma.space.update({ where: { id: space.id }, data: { isPrivate: true } });

    for (const who of [undefined, outsider.token]) {
      const g = await s.call('GET', `/api/spaces/${space.name}`, { token: who });
      assert.equal(g.status, 403);
      assert.equal(g.json.code, 'private_space');
      assert.equal(g.json.space.isPrivate, true);
      assert.equal((await s.call('GET', `/api/posts/spaces/${space.name}/posts`, { token: who })).status, 403);
      assert.equal((await s.call('GET', `/api/posts/${post.id}`, { token: who })).status, 404, 'the post does not even confirm it exists');
      assert.equal((await s.call('GET', '/api/posts?feed=new', { token: who })).json.posts.length, 0, 'not in the front page');
      assert.equal((await s.call('GET', '/api/search?q=banter', { token: who })).json.posts.length, 0, 'not in search');
      assert.equal((await s.call('GET', '/api/search?q=secretclub', { token: who })).json.spaces.length, 0);
      assert.ok(!(await s.call('GET', '/api/spaces', { token: who })).json.spaces.some((x: any) => x.name === 'secretclub'));
    }
    assert.equal((await s.call('POST', `/api/spaces/${space.name}/subscribe`, { token: outsider.token })).status, 403, 'closed to new members');
    assert.equal((await s.call('POST', '/api/posts', { token: outsider.token, body: { spaceId: space.id, title: 'sneaky', postType: 'text', content: 'hi' } })).status, 404);

    for (const who of [member.token, owner.token]) {
      assert.equal((await s.call('GET', `/api/spaces/${space.name}`, { token: who })).status, 200);
      assert.equal((await s.call('GET', `/api/posts/spaces/${space.name}/posts`, { token: who })).json.posts.length, 1);
      assert.equal((await s.call('GET', `/api/posts/${post.id}`, { token: who })).status, 200);
      assert.equal((await s.call('GET', '/api/search?q=banter', { token: who })).json.posts.length, 1);
    }
  });

  it('a deleted space disappears for everyone, owners included', async () => {
    const owner = await makeUser(s, 'downer'); const space = await makeSpace(s, owner, 'goneforever'); const post = await makePost(s, owner, space.id, 'Farewell');
    await prisma.space.update({ where: { id: space.id }, data: { deletedAt: new Date() } });
    assert.equal((await s.call('GET', `/api/spaces/${space.name}`, { token: owner.token })).status, 404);
    assert.equal((await s.call('GET', `/api/posts/${post.id}`)).status, 404);
    assert.equal((await s.call('GET', '/api/search?q=goneforever')).json.spaces.length, 0);
    assert.equal((await s.call('POST', `/api/spaces/${space.name}/subscribe`, { token: owner.token })).status, 404);
    assert.equal((await s.call('POST', '/api/posts', { token: owner.token, body: { spaceId: space.id, title: 'ghost', postType: 'text', content: 'x' } })).status, 404);
  });

  it('public spaces are unaffected', async () => {
    const owner = await makeUser(s, 'powner'); const space = await makeSpace(s, owner, 'openhouse'); await makePost(s, owner, space.id, 'Welcome all');
    assert.equal((await s.call('GET', `/api/spaces/${space.name}`)).status, 200);
    assert.ok((await s.call('GET', '/api/posts?feed=new')).json.posts.some((p: any) => p.title === 'Welcome all'));
    assert.equal((await s.call('GET', '/api/search?q=welcome')).json.posts.length, 1);
  });
});
