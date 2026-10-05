import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { disconnect, makePost, makeSpace, makeUser, resetDb, startServer, type TestServer, type TestUser } from './helpers';

let s: TestServer;
let prisma: typeof import('../src/db').prisma;
const unread = (userId: string, type: string) => prisma.notification.count({ where: { userId, type } });

async function addMod(user: TestUser, spaceId: string, by: TestUser) {
  await prisma.moderator.create({ data: { userId: user.id, spaceId, addedBy: by.id, permissions: { remove_posts: true, remove_comments: true, ban_users: true } } });
}

before(async () => { s = await startServer(); ({ prisma } = await import('../src/db')); await resetDb(); });
after(async () => { await s.close(); await disconnect(); });

describe('reports and the mod queue', () => {
  let founder: TestUser, author: TestUser, r1: TestUser, r2: TestUser, space: { id: string; name: string }, post: { id: string };

  before(async () => {
    founder = await makeUser(s, 'founder1'); author = await makeUser(s, 'author1'); r1 = await makeUser(s, 'reporter1'); r2 = await makeUser(s, 'reporter2');
    space = await makeSpace(s, founder, 'reportspace'); post = await makePost(s, author, space.id, 'Buy cheap watches');
  });

  it('validates who can report what', async () => {
    const body = { targetType: 'post', targetId: post.id, category: 'spam' };
    assert.equal((await s.call('POST', '/api/reports', { body })).status, 401);
    assert.equal((await s.call('POST', '/api/reports', { token: r1.token, body: { ...body, category: 'nonsense' } })).status, 400);
    assert.equal((await s.call('POST', '/api/reports', { token: author.token, body })).status, 400, 'no self-reports');
    assert.equal((await s.call('POST', '/api/reports', { token: r1.token, body: { ...body, targetId: '00000000-0000-4000-8000-000000000000' } })).status, 404);
  });

  it('reports reach the moderators once, are grouped in the queue, and cannot be duplicated', async () => {
    const body = { targetType: 'post', targetId: post.id, category: 'spam', reason: 'It is an advert' };
    assert.equal((await s.call('POST', '/api/reports', { token: r1.token, body })).status, 201);
    assert.equal((await s.call('POST', '/api/reports', { token: r1.token, body })).status, 409);
    assert.equal((await s.call('POST', '/api/reports', { token: r2.token, body: { ...body, category: 'harassment' } })).status, 201);
    assert.equal(await unread(founder.id, 'report_filed'), 1, 'moderators hear about a target once, not per report');

    assert.equal((await s.call('GET', `/api/mod/spaces/${space.name}/reports`, { token: r1.token })).status, 403, 'only mods see the queue');
    const queue = await s.call('GET', `/api/mod/spaces/${space.name}/reports`, { token: founder.token });
    assert.equal(queue.json.items.length, 1);
    assert.equal(queue.json.items[0].count, 2);
    assert.deepEqual(queue.json.items[0].categories.sort(), ['harassment', 'spam']);
    assert.equal(queue.json.items[0].target.title, 'Buy cheap watches');
  });

  it('removing from the queue needs a public reason, logs it, and tells everyone', async () => {
    const body = { targetType: 'post', targetId: post.id, action: 'remove' };
    assert.equal((await s.call('POST', '/api/mod/reports/resolve', { token: r1.token, body: { ...body, reason: 'a long enough reason' } })).status, 403);
    assert.equal((await s.call('POST', '/api/mod/reports/resolve', { token: founder.token, body: { ...body, reason: 'short' } })).status, 400);
    const ok = await s.call('POST', '/api/mod/reports/resolve', { token: founder.token, body: { ...body, reason: 'Spam advertising, against the rules.' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.resolved, 2);

    const row = await prisma.post.findUnique({ where: { id: post.id } });
    assert.equal(row?.removed, true);
    assert.equal(await unread(author.id, 'content_removed'), 1, 'author is told, with an appeal link');
    assert.equal(await unread(r1.id, 'report_resolved'), 1);
    assert.equal(await unread(r2.id, 'report_resolved'), 1);
    const log = await s.call('GET', `/api/mod/${space.name}/log`);
    assert.ok(log.json.actions.some((a: any) => a.actionType === 'remove_post'));
    assert.equal((await s.call('GET', `/api/mod/spaces/${space.name}/reports?status=resolved`, { token: founder.token })).json.items.length, 1);
    assert.equal((await s.call('GET', `/api/mod/spaces/${space.name}/reports`, { token: founder.token })).json.items.length, 0);
  });

  it('dismissing leaves the content up and says so', async () => {
    const p2 = await makePost(s, author, space.id, 'A fine post');
    await s.call('POST', '/api/reports', { token: r1.token, body: { targetType: 'post', targetId: p2.id, category: 'other' } });
    const res = await s.call('POST', '/api/mod/reports/resolve', { token: founder.token, body: { targetType: 'post', targetId: p2.id, action: 'dismiss', note: 'Fine as it is' } });
    assert.equal(res.status, 200);
    assert.equal((await prisma.post.findUnique({ where: { id: p2.id } }))?.removed, false);
  });

  it('illegal content and user reports also go to the site admins', async () => {
    const admin = await makeUser(s, 'siteadmin1', { admin: true });
    const p3 = await makePost(s, author, space.id, 'Questionable');
    await s.call('POST', '/api/reports', { token: r1.token, body: { targetType: 'post', targetId: p3.id, category: 'illegal' } });
    assert.equal(await unread(admin.id, 'report_filed'), 1);
    await s.call('POST', '/api/reports', { token: r2.token, body: { targetType: 'user', targetId: author.id, category: 'harassment' } });
    assert.equal(await unread(admin.id, 'report_filed'), 2);
    assert.equal((await s.call('GET', '/api/reports/mine', { token: r1.token })).json.reports.length, 3);
  });
});

describe('appeals', () => {
  it('a single-moderator space sends appeals straight to the admins, who decide publicly', async () => {
    const founder = await makeUser(s, 'solo'); const author = await makeUser(s, 'appellant1'); const admin = await makeUser(s, 'admin2', { admin: true });
    const space = await makeSpace(s, founder, 'solospace'); const post = await makePost(s, author, space.id, 'Mine');
    await s.call('POST', '/api/mod/remove-post', { token: founder.token, body: { postId: post.id, reason: 'Removed for testing purposes.' } });
    const action = await prisma.modAction.findFirstOrThrow({ where: { targetId: post.id } });

    assert.equal((await s.call('POST', '/api/appeals', { token: founder.token, body: { modActionId: action.id, reason: 'x'.repeat(30) } })).status, 403, 'only the affected user');
    assert.equal((await s.call('POST', '/api/appeals', { token: author.token, body: { modActionId: action.id, reason: 'too short' } })).status, 400);
    const appeal = await s.call('POST', '/api/appeals', { token: author.token, body: { modActionId: action.id, reason: 'This was not against any rule, please look again.' } });
    assert.equal(appeal.status, 201);
    assert.equal(appeal.json.appeal.status, 'escalated', 'no other moderator exists');
    assert.equal(await unread(admin.id, 'appeal_escalated'), 1);
    assert.equal((await s.call('POST', '/api/appeals', { token: author.token, body: { modActionId: action.id, reason: 'Trying a second time, again.' } })).status, 409);

    assert.equal((await s.call('POST', `/api/appeals/admin/${appeal.json.appeal.id}/resolve`, { token: author.token, body: { decision: 'approve', justification: 'x'.repeat(30) } })).status, 403);
    assert.equal((await s.call('POST', `/api/appeals/admin/${appeal.json.appeal.id}/resolve`, { token: admin.token, body: { decision: 'approve', justification: 'short' } })).status, 400);
    const ok = await s.call('POST', `/api/appeals/admin/${appeal.json.appeal.id}/resolve`, { token: admin.token, body: { decision: 'approve', justification: 'The post followed every rule of the space.' } });
    assert.equal(ok.status, 200);
    assert.equal((await prisma.post.findUnique({ where: { id: post.id } }))?.removed, false, 'content is back');
    assert.ok((await prisma.modAction.findUnique({ where: { id: action.id } }))?.reversedAt, 'the original action shows as reversed');
    const adminLog = await prisma.adminAction.findMany({ where: { targetId: appeal.json.appeal.id } });
    assert.equal(adminLog.length, 1, 'admin decisions are recorded for the public log');
    assert.match(adminLog[0].justification, /followed every rule/);
    assert.equal(await unread(author.id, 'appeal_update'), 1);
  });

  it('the original moderator cannot review; another moderator can approve, deny with an explanation, or escalate', async () => {
    const founder = await makeUser(s, 'founder3'); const second = await makeUser(s, 'second3'); const author = await makeUser(s, 'author3'); const admin = await makeUser(s, 'admin3', { admin: true });
    const space = await makeSpace(s, founder, 'twomods'); await addMod(second, space.id, founder);
    const mkAppeal = async (title: string) => {
      const post = await makePost(s, author, space.id, title);
      await s.call('POST', '/api/mod/remove-post', { token: founder.token, body: { postId: post.id, reason: 'Removed for a good reason.' } });
      const action = await prisma.modAction.findFirstOrThrow({ where: { targetId: post.id } });
      const a = await s.call('POST', '/api/appeals', { token: author.token, body: { modActionId: action.id, reason: 'I believe this was removed by mistake.' } });
      assert.equal(a.json.appeal.status, 'pending');
      return { post, action, id: a.json.appeal.id as string };
    };

    const one = await mkAppeal('first');
    assert.equal(await unread(second.id, 'appeal_filed') >= 1, true, 'the other mod is told');
    assert.equal(await unread(founder.id, 'appeal_filed'), 0, 'the original mod is not');
    const list = await s.call('GET', `/api/mod/spaces/${space.name}/appeals`, { token: founder.token });
    assert.equal(list.json.appeals[0].canReview, false);
    assert.equal((await s.call('GET', `/api/mod/spaces/${space.name}/appeals`, { token: second.token })).json.appeals[0].canReview, true);

    assert.equal((await s.call('POST', `/api/appeals/${one.id}/review`, { token: founder.token, body: { decision: 'approve' } })).status, 403, 'cannot review your own action');
    assert.equal((await s.call('POST', `/api/appeals/${one.id}/review`, { token: author.token, body: { decision: 'approve' } })).status, 403, 'non-mods cannot review');
    assert.equal((await s.call('POST', `/api/appeals/${one.id}/review`, { token: second.token, body: { decision: 'deny' } })).status, 400, 'a denial needs an explanation');
    assert.equal((await s.call('POST', `/api/appeals/${one.id}/review`, { token: second.token, body: { decision: 'approve', notes: 'Agreed, that was a mistake.' } })).status, 200);
    assert.equal((await prisma.post.findUnique({ where: { id: one.post.id } }))?.removed, false);
    assert.ok((await prisma.modAction.findUnique({ where: { id: one.action.id } }))?.reversedAt);
    assert.equal((await s.call('POST', `/api/appeals/${one.id}/review`, { token: second.token, body: { decision: 'approve' } })).status, 409, 'already handled');

    const two = await mkAppeal('second');
    assert.equal((await s.call('POST', `/api/appeals/${two.id}/review`, { token: second.token, body: { decision: 'deny', notes: 'It broke rule three clearly.' } })).status, 200);
    assert.equal((await prisma.post.findUnique({ where: { id: two.post.id } }))?.removed, true, 'a denial keeps the removal');
    assert.equal((await prisma.appeal.findUnique({ where: { id: two.id } }))?.status, 'denied');

    const three = await mkAppeal('third');
    await s.call('POST', `/api/appeals/${three.id}/review`, { token: second.token, body: { decision: 'escalate', notes: 'The founder may be acting out of bias.' } });
    assert.equal((await prisma.appeal.findUnique({ where: { id: three.id } }))?.status, 'escalated');
    const queue = await s.call('GET', '/api/appeals/admin/escalated', { token: admin.token });
    assert.equal(queue.json.appeals.length, 1);
    await s.call('POST', `/api/appeals/admin/${three.id}/resolve`, { token: admin.token, body: { decision: 'deny', justification: 'The removal was consistent with the space rules.' } });
    assert.equal((await prisma.appeal.findUnique({ where: { id: three.id } }))?.status, 'denied');
  });

  it('bans can be appealed and an approved appeal lifts them; old actions cannot be appealed', async () => {
    const founder = await makeUser(s, 'founder4'); const second = await makeUser(s, 'second4'); const banned = await makeUser(s, 'banned4');
    const space = await makeSpace(s, founder, 'bansp'); await addMod(second, space.id, founder);
    const ban = await s.call('POST', '/api/mod/ban-user', { token: founder.token, body: { username: banned.username, spaceName: space.name, reason: 'Repeated rule breaking here.', duration: 7 } });
    assert.equal(ban.status, 200);
    assert.equal(await unread(banned.id, 'banned'), 1);
    const action = await prisma.modAction.findFirstOrThrow({ where: { targetId: banned.id, actionType: 'ban_user' } });

    const appeal = await s.call('POST', '/api/appeals', { token: banned.token, body: { modActionId: action.id, reason: 'I understand the rules now and ask for another chance.' } });
    assert.equal(appeal.status, 201);
    await s.call('POST', `/api/appeals/${appeal.json.appeal.id}/review`, { token: second.token, body: { decision: 'approve', notes: 'Welcome back.' } });
    assert.equal((await prisma.ban.findFirst({ where: { userId: banned.id, spaceId: space.id, isActive: true } })), null, 'the ban is lifted');

    const author = await makeUser(s, 'author4'); const post = await makePost(s, author, space.id, 'Old');
    await s.call('POST', '/api/mod/remove-post', { token: founder.token, body: { postId: post.id, reason: 'Removed a long time ago.' } });
    const old = await prisma.modAction.findFirstOrThrow({ where: { targetId: post.id } });
    await prisma.modAction.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 31 * 86_400_000) } });
    assert.equal((await s.call('POST', '/api/appeals', { token: author.token, body: { modActionId: old.id, reason: 'Appealing very late, but anyway.' } })).status, 400);
    assert.equal((await s.call('GET', '/api/appeals/mine', { token: banned.token })).json.appeals.length, 1);
  });

  it('the author can look up the decision behind removed content, and only the author', async () => {
    const founder = await makeUser(s, 'lookfounder'); const author = await makeUser(s, 'lookauthor'); const other = await makeUser(s, 'lookother');
    const space = await makeSpace(s, founder, 'lookspace'); const post = await makePost(s, author, space.id, 'Looked up');
    await s.call('POST', '/api/mod/remove-post', { token: founder.token, body: { postId: post.id, reason: 'Removed so the lookup has something.' } });
    const found = await s.call('GET', `/api/appeals/target/post/${post.id}`, { token: author.token });
    assert.equal(found.status, 200);
    assert.equal(found.json.canAppeal, true);
    assert.equal(found.json.action.space, 'lookspace');
    assert.equal((await s.call('GET', `/api/appeals/target/post/${post.id}`, { token: other.token })).status, 403);
    const direct = await s.call('GET', `/api/appeals/action/${found.json.action.id}`, { token: author.token });
    assert.equal(direct.json.windowDays, 30);
    await s.call('POST', '/api/appeals', { token: author.token, body: { modActionId: found.json.action.id, reason: 'Please look again at this removal.' } });
    assert.equal((await s.call('GET', `/api/appeals/target/post/${post.id}`, { token: author.token })).json.canAppeal, false, 'already appealed');
  });
});
