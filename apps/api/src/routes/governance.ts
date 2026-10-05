import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authMiddleware, optionalAuthMiddleware, AuthRequest, verifiedMiddleware } from '../middleware/auth';
import { handler, notFound } from '../lib/http';
import { canViewSpace } from '../lib/visibility';
import {
  COMMUNITY_VOTE_TYPES, RULES, candidateEligibility, castCommunityBallot, castElectionVote, closeDueGovernance, communityPhase,
  electionPhase, respondToNomination, startCommunityVote, startElection, voterEligibility,
} from '../services/governance';

const router = Router();

/** A ballot is "for"/"against" or a boolean. */
const ballotSchema = z.object({ vote: z.union([z.boolean(), z.enum(['for', 'against'])]) }).transform((b) => ({ vote: b.vote === true || b.vote === 'for' }));

/** The space, or a 404 if it is deleted or private and the viewer is not in it. */
async function space(name: string, viewerId?: string) {
  const s = await prisma.space.findUnique({ where: { name: name.toLowerCase() } });
  if (!s || !(await canViewSpace(s, viewerId))) throw notFound('Space not found.');
  return s;
}

type ElectionRow = Awaited<ReturnType<typeof prisma.modElection.findMany<{ include: { candidate: { select: { username: true } }; nominator: { select: { username: true } } } }>>>[number];
type VoteRow = Awaited<ReturnType<typeof prisma.communityVote.findMany<{ include: { proposer: { select: { username: true } } } }>>>[number];

/** Tallies stay hidden until voting has closed. */
function electionView(e: ElectionRow, now: Date, me?: string, myVote?: boolean) {
  const phase = electionPhase(e, now);
  const closed = phase === 'closed' || e.status !== 'active';
  return {
    id: e.id, type: e.electionType, status: e.status, phase, candidate: e.candidate.username, nominator: e.nominator?.username ?? null,
    justification: e.justification, accepted: Boolean(e.acceptedAt), votingStartsAt: e.electionStart, votingEndsAt: e.electionEnd,
    requiredApproval: e.requiredApproval, requiredTurnout: RULES.election.turnout, subscribersAtStart: e.subscribersAtStart,
    votesFor: closed ? e.votesFor : null, votesAgainst: closed ? e.votesAgainst : null, ballotsCast: e.votesFor + e.votesAgainst,
    myVote: myVote === undefined ? null : myVote ? 'for' : 'against', isCandidate: me === e.candidateId,
  };
}

function voteView(v: VoteRow, now: Date, myVote?: boolean) {
  const phase = communityPhase(v, now);
  const closed = phase === 'closed' || v.status !== 'active';
  return {
    id: v.id, type: v.voteType, title: v.title, proposal: v.proposal, status: v.status, phase, proposer: v.proposer?.username ?? null,
    payload: v.payload, votingStartsAt: v.votingStartsAt, votingEndsAt: v.endsAt, requiredApproval: v.requiredApproval, requiredTurnout: v.requiredTurnout,
    subscribersAtStart: v.subscribersAtStart, votesFor: closed ? v.votesFor : null, votesAgainst: closed ? v.votesAgainst : null, ballotsCast: v.votesFor + v.votesAgainst,
    result: v.result, myVote: myVote === undefined ? null : myVote ? 'for' : 'against',
  };
}

/**
 * GET /api/spaces/:name/governance
 * Everything the governance page needs: moderators, open and recent elections and votes, how moderation has
 * gone, the rules, and (when signed in) what the viewer can do. Tallies stay hidden until voting closes.
 */
router.get('/spaces/:name/governance', optionalAuthMiddleware, handler<AuthRequest>(async (req, res) => {
  const sp = await space(req.params.name, req.userId);
  const now = new Date();
  await closeDueGovernance(now, sp.id);
  const me = req.userId;

  const [mods, elections, votes, ballots, appealGroups, actions30d] = await Promise.all([
    prisma.moderator.findMany({ where: { spaceId: sp.id }, orderBy: { addedAt: 'asc' }, include: { user: { select: { username: true } } } }),
    prisma.modElection.findMany({ where: { spaceId: sp.id }, orderBy: { nominationDate: 'desc' }, take: 20, include: { candidate: { select: { username: true } }, nominator: { select: { username: true } } } }),
    prisma.communityVote.findMany({ where: { spaceId: sp.id }, orderBy: { createdAt: 'desc' }, take: 20, include: { proposer: { select: { username: true } } } }),
    me ? Promise.all([prisma.electionVote.findMany({ where: { userId: me, election: { spaceId: sp.id } } }), prisma.communityBallot.findMany({ where: { userId: me, voteRef: { spaceId: sp.id } } })]) : Promise.resolve([[], []] as const),
    prisma.appeal.groupBy({ by: ['status'], where: { spaceId: sp.id }, _count: true }),
    prisma.modAction.count({ where: { spaceId: sp.id, createdAt: { gt: new Date(now.getTime() - 30 * 86_400_000) } } }),
  ]);
  const [myElectionVotes, myBallots] = ballots as readonly [{ electionId: string; vote: boolean }[], { voteId: string; vote: boolean }[]];
  const myE = new Map(myElectionVotes.map((v) => [v.electionId, v.vote]));
  const myB = new Map(myBallots.map((v) => [v.voteId, v.vote]));

  let eligibility: unknown = null;
  if (me) {
    const user = await prisma.user.findUnique({ where: { id: me } });
    if (user) eligibility = { stand: await candidateEligibility(user, sp, now), vote: await voterEligibility(user, sp, now), propose: await voterEligibility(user, sp, now, true) };
  }

  res.json({
    space: { name: sp.name, displayName: sp.displayName, subscriberCount: sp.subscriberCount, isPrivate: sp.isPrivate, adEnabled: sp.adEnabled },
    rules: RULES,
    moderators: mods.map((m) => ({ username: m.user.username, isFounder: m.isFounder, addedAt: m.addedAt })),
    elections: elections.map((e) => electionView(e, now, me, myE.get(e.id))),
    votes: votes.map((v) => voteView(v, now, myB.get(v.id))),
    moderation: {
      actionsLast30Days: actions30d,
      appeals: Object.fromEntries(appealGroups.map((g) => [g.status, g._count])),
    },
    eligibility,
  });
}));

const historyQuery = z.object({
  kind: z.enum(['all', 'elections', 'votes']).default('all'),
  outcome: z.enum(['all', 'passed', 'failed']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(15),
});

/**
 * GET /api/spaces/:name/governance/history
 * Every finished election and community vote in the space, newest first, with the final tallies and a
 * summary. Open decisions are not here (their tallies are still hidden).
 */
router.get('/spaces/:name/governance/history', optionalAuthMiddleware, handler<AuthRequest>(async (req, res) => {
  const q = historyQuery.parse(req.query);
  const sp = await space(req.params.name, req.userId);
  const now = new Date();
  await closeDueGovernance(now, sp.id);

  const [elections, votes] = await Promise.all([
    q.kind === 'votes' ? [] : prisma.modElection.findMany({ where: { spaceId: sp.id, status: { not: 'active' } }, take: 500, include: { candidate: { select: { username: true } }, nominator: { select: { username: true } } } }),
    q.kind === 'elections' ? [] : prisma.communityVote.findMany({ where: { spaceId: sp.id, status: { not: 'active' } }, take: 500, include: { proposer: { select: { username: true } } } }),
  ]);

  type Item = { kind: 'election' | 'vote'; at: Date; status: string; turnout: number; view: ReturnType<typeof electionView> | ReturnType<typeof voteView> };
  const turnoutOf = (f: number, a: number, subs: number) => (f + a) / Math.max(1, subs);
  const items: Item[] = [
    ...elections.map((e): Item => ({ kind: 'election', at: e.electionEnd, status: e.status, turnout: turnoutOf(e.votesFor, e.votesAgainst, e.subscribersAtStart), view: electionView(e, now) })),
    ...votes.map((v): Item => ({ kind: 'vote', at: v.endsAt, status: v.status, turnout: turnoutOf(v.votesFor, v.votesAgainst, v.subscribersAtStart), view: voteView(v, now) })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const decided = items.filter((i) => i.status === 'passed' || i.status === 'failed');
  const matching = items.filter((i) => q.outcome === 'all' || i.status === q.outcome);
  const start = (q.page - 1) * q.limit;
  res.json({
    space: { name: sp.name, displayName: sp.displayName },
    summary: {
      total: items.length,
      passed: decided.filter((i) => i.status === 'passed').length,
      failed: decided.filter((i) => i.status === 'failed').length,
      withdrawn: items.length - decided.length,
      averageTurnout: decided.length ? decided.reduce((n, i) => n + i.turnout, 0) / decided.length : null,
      elections: items.filter((i) => i.kind === 'election').length,
      votes: items.filter((i) => i.kind === 'vote').length,
    },
    items: matching.slice(start, start + q.limit).map((i) => ({ kind: i.kind, closedAt: i.at, turnout: i.turnout, ...i.view })),
    pagination: { page: q.page, limit: q.limit, totalCount: matching.length, totalPages: Math.max(1, Math.ceil(matching.length / q.limit)) },
  });
}));

const electionSchema = z.object({
  type: z.enum(['add_mod', 'remove_mod']),
  candidate: z.string().trim().min(1).max(50).optional(),
  justification: z.string().trim().max(3000).optional(),
});

/** POST /api/spaces/:name/elections: stand for moderator, nominate someone, or propose removing a moderator */
router.post('/spaces/:name/elections', authMiddleware, verifiedMiddleware, handler<AuthRequest>(async (req, res) => {
  const body = electionSchema.parse(req.body);
  const election = await startElection({ spaceName: req.params.name, type: body.type, requesterId: req.userId!, candidateUsername: body.candidate, justification: body.justification });
  res.status(201).json({ message: 'Election started', election: { id: election.id, votingStartsAt: election.electionStart, votingEndsAt: election.electionEnd } });
}));

router.post('/elections/:id/accept', authMiddleware, handler<AuthRequest>(async (req, res) => {
  await respondToNomination(req.params.id, req.userId!, true);
  res.json({ message: 'Nomination accepted' });
}));

router.post('/elections/:id/decline', authMiddleware, handler<AuthRequest>(async (req, res) => {
  await respondToNomination(req.params.id, req.userId!, false);
  res.json({ message: 'Nomination declined' });
}));

router.post('/elections/:id/vote', authMiddleware, verifiedMiddleware, handler<AuthRequest>(async (req, res) => {
  const { vote } = ballotSchema.parse(req.body);
  await castElectionVote(req.params.id, req.userId!, vote);
  res.json({ message: 'Your vote was recorded', vote: vote ? 'for' : 'against' });
}));

const communitySchema = z.object({
  voteType: z.enum(COMMUNITY_VOTE_TYPES),
  title: z.string().trim().min(5).max(150),
  proposal: z.string().trim().min(20, 'Please describe the proposal in at least 20 characters.').max(5000),
  payload: z.object({ rules: z.array(z.string()).optional() }).optional(),
});

/** POST /api/spaces/:name/votes: propose a community-wide decision (ads, rules, privacy, deleting the space) */
router.post('/spaces/:name/votes', authMiddleware, verifiedMiddleware, handler<AuthRequest>(async (req, res) => {
  const body = communitySchema.parse(req.body);
  const vote = await startCommunityVote({ spaceName: req.params.name, proposerId: req.userId!, ...body });
  res.status(201).json({ message: 'Vote started', vote: { id: vote.id, votingStartsAt: vote.votingStartsAt, votingEndsAt: vote.endsAt } });
}));

router.post('/votes/:id/ballot', authMiddleware, verifiedMiddleware, handler<AuthRequest>(async (req, res) => {
  const { vote } = ballotSchema.parse(req.body);
  await castCommunityBallot(req.params.id, req.userId!, vote);
  res.json({ message: 'Your vote was recorded', vote: vote ? 'for' : 'against' });
}));

export default router;
