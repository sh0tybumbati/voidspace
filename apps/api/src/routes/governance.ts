import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../middleware/auth';
import { handler, notFound } from '../lib/http';
import {
  COMMUNITY_VOTE_TYPES, RULES, candidateEligibility, castCommunityBallot, castElectionVote, closeDueGovernance, communityPhase,
  electionPhase, respondToNomination, startCommunityVote, startElection, voterEligibility,
} from '../services/governance';

const router = Router();

/** A ballot is "for"/"against" or a boolean. */
const ballotSchema = z.object({ vote: z.union([z.boolean(), z.enum(['for', 'against'])]) }).transform((b) => ({ vote: b.vote === true || b.vote === 'for' }));

async function space(name: string) {
  const s = await prisma.space.findUnique({ where: { name: name.toLowerCase() } });
  if (!s || s.deletedAt) throw notFound('Space not found.');
  return s;
}

/**
 * GET /api/spaces/:name/governance
 * Everything the governance page needs: moderators, open and recent elections and votes, how moderation has
 * gone, the rules, and (when signed in) what the viewer can do. Tallies stay hidden until voting closes.
 */
router.get('/spaces/:name/governance', optionalAuthMiddleware, handler<AuthRequest>(async (req, res) => {
  const sp = await space(req.params.name);
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
    elections: elections.map((e) => {
      const phase = electionPhase(e, now);
      const closed = phase === 'closed' || e.status !== 'active';
      return {
        id: e.id, type: e.electionType, status: e.status, phase, candidate: e.candidate.username, nominator: e.nominator?.username ?? null,
        justification: e.justification, accepted: Boolean(e.acceptedAt), votingStartsAt: e.electionStart, votingEndsAt: e.electionEnd,
        requiredApproval: e.requiredApproval, requiredTurnout: RULES.election.turnout, subscribersAtStart: e.subscribersAtStart,
        votesFor: closed ? e.votesFor : null, votesAgainst: closed ? e.votesAgainst : null, ballotsCast: e.votesFor + e.votesAgainst,
        myVote: myE.has(e.id) ? (myE.get(e.id) ? 'for' : 'against') : null, isCandidate: me === e.candidateId,
      };
    }),
    votes: votes.map((v) => {
      const phase = communityPhase(v, now);
      const closed = phase === 'closed' || v.status !== 'active';
      return {
        id: v.id, type: v.voteType, title: v.title, proposal: v.proposal, status: v.status, phase, proposer: v.proposer?.username ?? null,
        payload: v.payload, votingStartsAt: v.votingStartsAt, votingEndsAt: v.endsAt, requiredApproval: v.requiredApproval, requiredTurnout: v.requiredTurnout,
        subscribersAtStart: v.subscribersAtStart, votesFor: closed ? v.votesFor : null, votesAgainst: closed ? v.votesAgainst : null, ballotsCast: v.votesFor + v.votesAgainst,
        result: v.result, myVote: myB.has(v.id) ? (myB.get(v.id) ? 'for' : 'against') : null,
      };
    }),
    moderation: {
      actionsLast30Days: actions30d,
      appeals: Object.fromEntries(appealGroups.map((g) => [g.status, g._count])),
    },
    eligibility,
  });
}));

const electionSchema = z.object({
  type: z.enum(['add_mod', 'remove_mod']),
  candidate: z.string().trim().min(1).max(50).optional(),
  justification: z.string().trim().max(3000).optional(),
});

/** POST /api/spaces/:name/elections: stand for moderator, nominate someone, or propose removing a moderator */
router.post('/spaces/:name/elections', authMiddleware, handler<AuthRequest>(async (req, res) => {
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

router.post('/elections/:id/vote', authMiddleware, handler<AuthRequest>(async (req, res) => {
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
router.post('/spaces/:name/votes', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const body = communitySchema.parse(req.body);
  const vote = await startCommunityVote({ spaceName: req.params.name, proposerId: req.userId!, ...body });
  res.status(201).json({ message: 'Vote started', vote: { id: vote.id, votingStartsAt: vote.votingStartsAt, votingEndsAt: vote.endsAt } });
}));

router.post('/votes/:id/ballot', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const { vote } = ballotSchema.parse(req.body);
  await castCommunityBallot(req.params.id, req.userId!, vote);
  res.json({ message: 'Your vote was recorded', vote: vote ? 'for' : 'against' });
}));

export default router;
