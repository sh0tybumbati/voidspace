import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { disconnect, makePost, makeSpace, makeUser, resetDb, startServer, type TestServer, type TestUser } from './helpers';

let s: TestServer;
let prisma: typeof import('../src/db').prisma;
let gov: typeof import('../src/services/governance');

before(async () => { s = await startServer(); ({ prisma } = await import('../src/db')); gov = await import('../src/services/governance'); await resetDb(); });
after(async () => { await s.close(); await disconnect(); });

describe('voting rules (pure)', () => {
  const base = { subscribers: 100, requiredApproval: 0.6, requiredTurnout: 0.1 };
  it('passes exactly at the thresholds and fails just under', () => {
    assert.equal(gov.evaluate({ ...base, votesFor: 6, votesAgainst: 4 }).passed, true, '60% approval, 10% turnout');
    assert.equal(gov.evaluate({ ...base, votesFor: 59, votesAgainst: 41 }).passed, false, '59% approval');
    assert.equal(gov.evaluate({ ...base, votesFor: 9, votesAgainst: 0 }).passed, false, '9% turnout');
    assert.equal(gov.evaluate({ ...base, votesFor: 0, votesAgainst: 0 }).passed, false, 'no votes');
  });
  it('founder removal needs 75%', () => {
    const founder = { ...base, requiredApproval: 0.75, subscribers: 4 };
    assert.equal(gov.evaluate({ ...founder, votesFor: 3, votesAgainst: 1 }).passed, true);
    assert.equal(gov.evaluate({ ...founder, votesFor: 7, votesAgainst: 3, subscribers: 10 }).passed, false);
  });
  it('turnout is measured against the subscribers when the vote began, never divided by zero', () => {
    assert.equal(gov.evaluate({ ...base, subscribers: 0, votesFor: 1, votesAgainst: 0 }).turnout, 1);
  });
  it('phases follow the dates', () => {
    const start = new Date('2026-01-04'); const end = new Date('2026-01-11');
    const item = { status: 'active', votingStartsAt: start, endsAt: end };
    assert.equal(gov.phaseOf(item, new Date('2026-01-02')), 'nomination');
    assert.equal(gov.phaseOf(item, new Date('2026-01-05')), 'voting');
    assert.equal(gov.phaseOf(item, new Date('2026-01-12')), 'closed');
    assert.equal(gov.phaseOf({ ...item, status: 'passed' }, new Date('2026-01-05')), 'closed');
  });
});

describe('moderator elections', () => {
  let founder: TestUser, newbie: TestUser, noAlign: TestUser, outsider: TestUser;
  let space: { id: string; name: string };
  const voters: TestUser[] = [];
  const nameOf = (u: TestUser) => u.username;

  const eligible = async (name: string, ageDays = 45) => {
    const u = await makeUser(s, name, { ageDays });
    const p = await makePost(s, u, space.id, `${name} post`);
    await prisma.post.update({ where: { id: p.id }, data: { voteScore: 150 } });
    return u;
  };
  const subscribe = (u: TestUser) => s.call('POST', `/api/spaces/${space.name}/subscribe`, { token: u.token });
  /** Move an election's clock: 'voting' puts us inside the voting window, 'ended' just past it. */
  const travel = async (id: string, to: 'voting' | 'ended') => {
    const day = 86_400_000; const now = Date.now();
    await prisma.modElection.update({ where: { id }, data: to === 'voting' ? { electionStart: new Date(now - day), electionEnd: new Date(now + 6 * day) } : { electionStart: new Date(now - 8 * day), electionEnd: new Date(now - day) } });
  };
  const stand = (u: TestUser, body: object = { type: 'add_mod' }) => s.call('POST', `/api/spaces/${space.name}/elections`, { token: u.token, body });
  const gview = (u?: TestUser) => s.call('GET', `/api/spaces/${space.name}/governance`, { token: u?.token });
  const vote = (id: string, u: TestUser, v: string) => s.call('POST', `/api/elections/${id}/vote`, { token: u.token, body: { vote: v } });

  before(async () => {
    founder = await makeUser(s, 'gfounder', { ageDays: 90 });
    space = await makeSpace(s, founder, 'govspace');
    const fp = await makePost(s, founder, space.id, 'founder post'); await prisma.post.update({ where: { id: fp.id }, data: { voteScore: 200 } });
    newbie = await makeUser(s, 'gnewbie', { ageDays: 1 });
    noAlign = await makeUser(s, 'gnoalign', { ageDays: 40 });
    outsider = await makeUser(s, 'goutsider', { ageDays: 40 });
    for (let i = 1; i <= 12; i++) { const v = await makeUser(s, `gvoter${i}`, { ageDays: 5 }); await subscribe(v); voters.push(v); }
  });

  it('refuses candidates who are too new or have too little alignment, and says why', async () => {
    const a = await stand(newbie);
    assert.equal(a.status, 403);
    assert.match(a.json.message, /30 days/);
    assert.equal(a.json.code, 'not_eligible');
    const b = await stand(noAlign);
    assert.equal(b.status, 403);
    assert.match(b.json.message, /100\+ alignment/);
  });

  it('a banned account cannot stand', async () => {
    const bad = await eligible('gbanned');
    await prisma.ban.create({ data: { userId: bad.id, spaceId: space.id, bannedBy: founder.id, reason: 'test ban', isActive: true } });
    assert.equal((await stand(bad)).status, 403);
  });

  it('a passing election: nomination period, hidden tallies, ballot rules, and a new moderator', async () => {
    const cand = await eligible('gcand1');
    const res = await stand(cand);
    assert.equal(res.status, 201);
    const id = res.json.election.id as string;
    assert.equal((await stand(cand)).status, 409, 'one open election per candidate');

    const early = await gview(cand);
    const e0 = early.json.elections.find((e: any) => e.id === id);
    assert.equal(e0.phase, 'nomination');
    assert.equal(e0.votesFor, null);
    assert.equal((await vote(id, voters[0], 'for')).status, 409, 'voting has not opened');

    await travel(id, 'voting');
    assert.equal((await vote(id, cand, 'for')).status, 403, 'no voting in your own election');
    assert.equal((await vote(id, outsider, 'for')).status, 403, 'not subscribed');
    assert.equal((await vote(id, newbie, 'for')).status, 403);
    for (let i = 0; i < 8; i++) assert.equal((await vote(id, voters[i], 'for')).status, 200);
    for (let i = 8; i < 10; i++) assert.equal((await vote(id, voters[i], 'against')).status, 200);
    assert.equal((await vote(id, voters[9], 'for')).status, 200, 'a vote can be changed while voting is open');
    assert.equal((await vote(id, voters[0], 'maybe')).status, 400);

    const mid = (await gview(voters[0])).json.elections.find((e: any) => e.id === id);
    assert.equal(mid.votesFor, null, 'no live tally while voting');
    assert.equal(mid.ballotsCast, 10);
    assert.equal(mid.myVote, 'for');

    await travel(id, 'ended');
    const after = (await gview(cand)).json;
    const done = after.elections.find((e: any) => e.id === id);
    assert.equal(done.status, 'passed');
    assert.equal(done.votesFor, 9);
    assert.equal(done.votesAgainst, 1);
    assert.ok(after.moderators.some((m: any) => m.username === 'gcand1'));
    const row = await prisma.moderator.findFirstOrThrow({ where: { userId: cand.id, spaceId: space.id } });
    assert.equal(row.isFounder, false);
    assert.equal((await prisma.notification.count({ where: { userId: cand.id, type: 'election_result' } })), 1);
    assert.equal((await vote(id, voters[0], 'against')).status, 409, 'closed');

    // the new moderator really can moderate
    const victim = await makeUser(s, 'gvictim'); const post = await makePost(s, victim, space.id, 'rude post');
    assert.equal((await s.call('POST', '/api/mod/remove-post', { token: cand.token, body: { postId: post.id, reason: 'Breaks rule one, removed.' } })).status, 200);
  });

  it('fails on low turnout, and on low approval', async () => {
    const c2 = await eligible('gcand2');
    const e2 = (await stand(c2)).json.election.id; await travel(e2, 'voting');
    await vote(e2, voters[0], 'for');                       // 1 of 12 subscribers: 8% turnout
    await travel(e2, 'ended'); await gview();
    assert.equal((await prisma.modElection.findUniqueOrThrow({ where: { id: e2 } })).status, 'failed');
    assert.equal(await prisma.moderator.count({ where: { userId: c2.id } }), 0);

    const c3 = await eligible('gcand3');
    const e3 = (await stand(c3)).json.election.id; await travel(e3, 'voting');
    for (let i = 0; i < 5; i++) await vote(e3, voters[i], 'for');
    for (let i = 5; i < 10; i++) await vote(e3, voters[i], 'against');   // 50% approval
    await travel(e3, 'ended'); await gview();
    assert.equal((await prisma.modElection.findUniqueOrThrow({ where: { id: e3 } })).status, 'failed');
  });

  it('a nomination must be accepted by the nominee, or it lapses', async () => {
    const c4 = await eligible('gcand4'); const c5 = await eligible('gcand5');
    const nominator = voters[0]; await prisma.user.update({ where: { id: nominator.id }, data: { createdAt: new Date(Date.now() - 20 * 86_400_000) } });
    const n4 = await stand(nominator, { type: 'add_mod', candidate: nameOf(c4) });
    assert.equal(n4.status, 201);
    const id4 = n4.json.election.id;
    assert.equal(await prisma.notification.count({ where: { userId: c4.id, type: 'nominated' } }), 1);
    assert.equal((await s.call('POST', `/api/elections/${id4}/accept`, { token: voters[1].token })).status, 403, 'only the nominee responds');
    await travel(id4, 'voting');
    assert.equal((await vote(id4, voters[2], 'for')).status, 409, 'cannot vote on an unaccepted nomination');
    await gview();
    assert.equal((await prisma.modElection.findUniqueOrThrow({ where: { id: id4 } })).status, 'withdrawn', 'unaccepted nominations lapse');

    const n5 = await stand(nominator, { type: 'add_mod', candidate: nameOf(c5) });
    const id5 = n5.json.election.id;
    assert.equal((await s.call('POST', `/api/elections/${id5}/decline`, { token: c5.token })).status, 200);
    assert.equal((await prisma.modElection.findUniqueOrThrow({ where: { id: id5 } })).status, 'withdrawn');
    assert.equal((await stand(newbie, { type: 'add_mod', candidate: nameOf(c4) })).status, 403, 'new accounts cannot nominate');
  });

  it('removing a moderator needs a justification; a founder needs 75%; the last moderator stays', async () => {
    const [cand1] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { username: 'gcand1' } })]);
    const proposer = { id: cand1.id, username: 'gcand1', token: (await s.call('POST', '/api/auth/login', { body: { username: 'gcand1', password: 'Passw0rd!test-9' } })).json.token } as TestUser;
    assert.equal((await stand(proposer, { type: 'remove_mod', candidate: 'gfounder' })).status, 400, 'needs a justification');
    assert.equal((await stand(voters[3], { type: 'remove_mod', candidate: 'gfounder', justification: 'x'.repeat(30) })).status, 403, 'proposer must be eligible too');

    const r = await stand(proposer, { type: 'remove_mod', candidate: 'gfounder', justification: 'The founder has been inactive for months.' });
    assert.equal(r.status, 201);
    const rid = r.json.election.id;
    assert.equal((await gview()).json.elections.find((e: any) => e.id === rid).requiredApproval, 0.75);
    await travel(rid, 'voting');
    for (let i = 0; i < 8; i++) await vote(rid, voters[i], 'for');
    for (let i = 8; i < 12; i++) await vote(rid, voters[i], 'against');   // 8/12 = 66.7%
    await travel(rid, 'ended'); await gview();
    assert.equal((await prisma.modElection.findUniqueOrThrow({ where: { id: rid } })).status, 'failed', '67% is not enough for a founder');
    assert.equal(await prisma.moderator.count({ where: { userId: founder.id, spaceId: space.id } }), 1);

    const r2 = await stand(proposer, { type: 'remove_mod', candidate: 'gfounder', justification: 'A second attempt after more discussion.' });
    const rid2 = r2.json.election.id; await travel(rid2, 'voting');
    for (let i = 0; i < 9; i++) await vote(rid2, voters[i], 'for');
    for (let i = 9; i < 12; i++) await vote(rid2, voters[i], 'against');  // 9/12 = 75%
    await travel(rid2, 'ended'); await gview();
    assert.equal((await prisma.modElection.findUniqueOrThrow({ where: { id: rid2 } })).status, 'passed');
    assert.equal(await prisma.moderator.count({ where: { userId: founder.id, spaceId: space.id } }), 0, 'the founder was voted out');

    const other = await eligible('gcand6');
    assert.equal((await stand(other, { type: 'remove_mod', candidate: 'gcand1', justification: 'A reason that is long enough.' })).status, 400, 'a space keeps at least one moderator');
  });
});

describe('community votes', () => {
  let proposer: TestUser; let space: { id: string; name: string };
  const voters: TestUser[] = [];
  const open = (id: string) => s.call('GET', `/api/spaces/${space.name}/governance`).then((r) => r.json.votes.find((v: any) => v.id === id));
  const startVoting = (id: string, ended = false) => { const d = 86_400_000; const n = Date.now(); return prisma.communityVote.update({ where: { id }, data: ended ? { votingStartsAt: new Date(n - 8 * d), endsAt: new Date(n - d) } : { votingStartsAt: new Date(n - d), endsAt: new Date(n + 6 * d) } }); };
  const propose = (u: TestUser, body: object) => s.call('POST', `/api/spaces/${space.name}/votes`, { token: u.token, body });

  before(async () => {
    const owner = await makeUser(s, 'cvowner', { ageDays: 60 });
    space = await makeSpace(s, owner, 'cvspace');
    proposer = await makeUser(s, 'cvproposer', { ageDays: 10 });
    await s.call('POST', `/api/spaces/${space.name}/subscribe`, { token: proposer.token });
    for (let i = 1; i <= 10; i++) { const v = await makeUser(s, `cvvoter${i}`, { ageDays: 5 }); await s.call('POST', `/api/spaces/${space.name}/subscribe`, { token: v.token }); voters.push(v); }
  });

  it('validates proposals and who can make them', async () => {
    const fresh = await makeUser(s, 'cvfresh', { ageDays: 5 }); await s.call('POST', `/api/spaces/${space.name}/subscribe`, { token: fresh.token });
    assert.equal((await propose(fresh, { voteType: 'enable_ads', title: 'Turn on ads', proposal: 'We should enable ads to fund the space.' })).status, 403, 'proposers need a 7-day-old account');
    const outsider = await makeUser(s, 'cvoutsider', { ageDays: 30 });
    assert.equal((await propose(outsider, { voteType: 'enable_ads', title: 'Turn on ads', proposal: 'We should enable ads to fund the space.' })).status, 403, 'and a subscription');
    assert.equal((await propose(proposer, { voteType: 'change_rules', title: 'New rules', proposal: 'A set of replacement rules for the space.' })).status, 400, 'a rules vote needs the rules');
    assert.equal((await propose(proposer, { voteType: 'disable_ads', title: 'Turn off ads', proposal: 'Ads are already off, so this is pointless.' })).status, 400);
    assert.equal((await propose(proposer, { voteType: 'enable_ads', title: 'x', proposal: 'too short' })).status, 400);
  });

  it('a rules change: discussion first, then voting, then it takes effect', async () => {
    const rules = ['Be kind', 'No spam', 'Stay on topic'];
    const res = await propose(proposer, { voteType: 'change_rules', title: 'Replace the rules', proposal: 'Our rules are out of date and unclear.', payload: { rules } });
    assert.equal(res.status, 201);
    const id = res.json.vote.id;
    assert.equal((await propose(proposer, { voteType: 'change_rules', title: 'Replace the rules', proposal: 'Another at the same time, which is not allowed.', payload: { rules } })).status, 409);
    assert.equal((await open(id)).phase, 'discussion');
    assert.equal((await s.call('POST', `/api/votes/${id}/ballot`, { token: voters[0].token, body: { vote: 'for' } })).status, 409, 'discussion period');

    await startVoting(id);
    assert.equal((await open(id)).phase, 'voting');
    for (let i = 0; i < 3; i++) assert.equal((await s.call('POST', `/api/votes/${id}/ballot`, { token: voters[i].token, body: { vote: true } })).status, 200);   // 3 of 11: 27% turnout
    await startVoting(id, true);
    const done = await open(id);
    assert.equal(done.status, 'passed');
    assert.equal(done.votesFor, 3);
    const sp = await prisma.space.findUniqueOrThrow({ where: { id: space.id } });
    assert.deepEqual(sp.rules, rules);
  });

  it('privacy and ads votes change the space; a failed vote changes nothing', async () => {
    const priv = (await propose(proposer, { voteType: 'set_private', title: 'Go private', proposal: 'We want to become a private community.' })).json.vote.id;
    await startVoting(priv);
    for (let i = 0; i < 4; i++) await s.call('POST', `/api/votes/${priv}/ballot`, { token: voters[i].token, body: { vote: 'for' } });
    await startVoting(priv, true); await open(priv);
    assert.equal((await prisma.space.findUniqueOrThrow({ where: { id: space.id } })).isPrivate, true);

    const ads = (await propose(proposer, { voteType: 'enable_ads', title: 'Enable ads', proposal: 'Let the space earn some money from ads.' })).json.vote.id;
    await startVoting(ads);
    for (let i = 0; i < 2; i++) await s.call('POST', `/api/votes/${ads}/ballot`, { token: voters[i].token, body: { vote: 'for' } });
    for (let i = 2; i < 6; i++) await s.call('POST', `/api/votes/${ads}/ballot`, { token: voters[i].token, body: { vote: 'against' } });
    await startVoting(ads, true); await open(ads);
    assert.equal((await prisma.communityVote.findUniqueOrThrow({ where: { id: ads } })).status, 'failed');
    assert.equal((await prisma.space.findUniqueOrThrow({ where: { id: space.id } })).adEnabled, false);
  });
});
