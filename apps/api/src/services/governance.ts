import type { CommunityVote, ModElection, Prisma, Space, User } from '@prisma/client';
import { prisma } from '../db';
import { HttpError, badRequest, conflict, forbidden, notFound } from '../lib/http';
import { calculateSpaceAlignment } from './alignment';
import { DEFAULT_MOD_PERMISSIONS } from './moderation';
import { notify, notifyModerators } from './notify';

const DAY = 86_400_000;

/** The governance rules from the Voidspace plan, in one place. */
export const RULES = {
  /** Standing for moderator, or proposing a removal */
  candidate: { accountAgeDays: 30, minSpaceAlignment: 100 },
  election: { nominationDays: 3, votingDays: 7, approval: 0.6, founderRemovalApproval: 0.75, turnout: 0.1 },
  community: { discussionDays: 3, votingDays: 7, approval: 0.6, turnout: 0.15, proposerAccountAgeDays: 7 },
  /** To cast a ballot: subscribed to the space, and not a brand-new account (stops vote stuffing) */
  voter: { accountAgeDays: 3 },
} as const;

export const COMMUNITY_VOTE_TYPES = ['enable_ads', 'disable_ads', 'change_rules', 'set_private', 'set_public', 'delete_space'] as const;
export type CommunityVoteType = (typeof COMMUNITY_VOTE_TYPES)[number];

export interface Eligibility { ok: boolean; reasons: string[] }

export interface Outcome { passed: boolean; approval: number; turnout: number; total: number }

/** Did a vote pass? Pure, so the arithmetic is tested on its own. */
export function evaluate(input: { votesFor: number; votesAgainst: number; subscribers: number; requiredApproval: number; requiredTurnout: number }): Outcome {
  const total = input.votesFor + input.votesAgainst;
  const approval = total ? input.votesFor / total : 0;
  const turnout = total / Math.max(1, input.subscribers);
  return { passed: total > 0 && approval >= input.requiredApproval && turnout >= input.requiredTurnout, approval, turnout, total };
}

export type Phase = 'nomination' | 'discussion' | 'voting' | 'closed';

export function phaseOf(item: { status: string; votingStartsAt: Date; endsAt: Date }, now: Date): Phase {
  if (item.status !== 'active') return 'closed';
  if (now < item.votingStartsAt) return 'nomination';
  return now < item.endsAt ? 'voting' : 'closed';
}

const asVoteWindow = (e: ModElection) => ({ status: e.status, votingStartsAt: e.electionStart, endsAt: e.electionEnd });

export const electionPhase = (e: ModElection, now = new Date()): Phase => phaseOf(asVoteWindow(e), now);
export const communityPhase = (v: CommunityVote, now = new Date()): Phase => {
  const p = phaseOf({ status: v.status, votingStartsAt: v.votingStartsAt, endsAt: v.endsAt }, now);
  return p === 'nomination' ? 'discussion' : p;
};

async function hasActiveBan(userId: string, spaceId: string, now: Date): Promise<boolean> {
  const ban = await prisma.ban.findFirst({
    where: { userId, isActive: true, OR: [{ spaceId: null }, { spaceId }], AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] },
  });
  return Boolean(ban);
}

const ageDays = (user: Pick<User, 'createdAt'>, now: Date) => (now.getTime() - user.createdAt.getTime()) / DAY;

/** May this user stand for moderator here (or propose removing one)? */
export async function candidateEligibility(user: User, space: Space, now = new Date()): Promise<Eligibility> {
  const reasons: string[] = [];
  const age = ageDays(user, now);
  if (age < RULES.candidate.accountAgeDays) reasons.push(`The account must be at least ${RULES.candidate.accountAgeDays} days old (this one is ${Math.floor(age)}).`);
  const alignment = await calculateSpaceAlignment(user.id, space.id);
  if (alignment < RULES.candidate.minSpaceAlignment) reasons.push(`It takes ${RULES.candidate.minSpaceAlignment}+ alignment in this space (this account has ${alignment}).`);
  if (await hasActiveBan(user.id, space.id, now)) reasons.push('Accounts with an active ban cannot take part.');
  return { ok: reasons.length === 0, reasons };
}

/** May this user cast a ballot (or, with `proposing`, start a community vote)? */
export async function voterEligibility(user: User, space: Space, now = new Date(), proposing = false): Promise<Eligibility> {
  const reasons: string[] = [];
  const need = proposing ? RULES.community.proposerAccountAgeDays : RULES.voter.accountAgeDays;
  if (ageDays(user, now) < need) reasons.push(`The account must be at least ${need} days old.`);
  const sub = await prisma.subscription.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: space.id } } });
  if (!sub) reasons.push('Join the space to take part.');
  if (await hasActiveBan(user.id, space.id, now)) reasons.push('Accounts with an active ban cannot take part.');
  return { ok: reasons.length === 0, reasons };
}

async function getSpace(name: string): Promise<Space> {
  const space = await prisma.space.findUnique({ where: { name: name.toLowerCase() } });
  if (!space || space.deletedAt) throw notFound('Space not found.');
  return space;
}

async function getUserById(id: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('User not found.');
  return user;
}

// ---------------------------------------------------------------------------------------------
// Moderator elections
// ---------------------------------------------------------------------------------------------

export async function startElection(input: { spaceName: string; type: 'add_mod' | 'remove_mod'; requesterId: string; candidateUsername?: string; justification?: string }, now = new Date()) {
  const space = await getSpace(input.spaceName);
  const requester = await getUserById(input.requesterId);

  const candidate = input.candidateUsername
    ? await prisma.user.findUnique({ where: { username: input.candidateUsername.toLowerCase() } })
    : requester;
  if (!candidate) throw notFound('That user was not found.');

  const existing = await prisma.modElection.findFirst({ where: { spaceId: space.id, candidateId: candidate.id, electionType: input.type, status: 'active' } });
  if (existing) throw conflict('There is already an open election for that.');

  const candidateModRow = await prisma.moderator.findUnique({ where: { userId_spaceId: { userId: candidate.id, spaceId: space.id } } });
  let requiredApproval: number = RULES.election.approval;

  if (input.type === 'add_mod') {
    if (candidateModRow) throw badRequest('That user is already a moderator.');
    const ok = await candidateEligibility(candidate, space, now);
    if (!ok.ok) throw new HttpError(403, `${candidate.id === requester.id ? 'You are' : `${candidate.username} is`} not eligible to stand: ${ok.reasons.join(' ')}`, 'not_eligible');
    if (candidate.id !== requester.id) {
      const nominator = await voterEligibility(requester, space, now, true);
      if (!nominator.ok) throw forbidden(`You cannot nominate: ${nominator.reasons.join(' ')}`);
    }
  } else {
    if (!candidateModRow) throw badRequest('That user is not a moderator of this space.');
    if (!input.justification || input.justification.trim().length < 20) throw badRequest('A removal proposal needs a justification of at least 20 characters.');
    const proposer = await candidateEligibility(requester, space, now);
    if (!proposer.ok) throw new HttpError(403, `You cannot propose a removal: ${proposer.reasons.join(' ')}`, 'not_eligible');
    const modCount = await prisma.moderator.count({ where: { spaceId: space.id } });
    if (modCount <= 1) throw badRequest('A space must keep at least one moderator.');
    if (candidateModRow.isFounder) requiredApproval = RULES.election.founderRemovalApproval;
  }

  const start = new Date(now.getTime() + RULES.election.nominationDays * DAY);
  const end = new Date(start.getTime() + RULES.election.votingDays * DAY);
  const selfNominated = candidate.id === requester.id;
  const election = await prisma.modElection.create({
    data: {
      spaceId: space.id, candidateId: candidate.id, electionType: input.type, nominatorId: requester.id,
      justification: input.justification?.trim() || null, electionStart: start, electionEnd: end,
      subscribersAtStart: space.subscriberCount, requiredApproval,
      acceptedAt: input.type === 'add_mod' ? (selfNominated ? now : null) : now,
    },
  });

  if (input.type === 'add_mod' && !selfNominated) {
    await notify(candidate.id, { type: 'nominated', title: `You were nominated as a moderator of v/${space.name}`, body: 'Accept the nomination before voting opens, or decline it.', link: `/v/${space.name}/governance` });
  }
  if (input.type === 'remove_mod') {
    await notify(candidate.id, { type: 'removal_proposed', title: `A vote to remove you as moderator of v/${space.name} was proposed`, body: input.justification, link: `/v/${space.name}/governance` });
  }
  await notifyModerators(space.id, { type: 'election_started', title: `${input.type === 'add_mod' ? 'Moderator election' : 'Moderator removal vote'} in v/${space.name}`, body: `${candidate.username}: voting opens ${start.toDateString()}`, link: `/v/${space.name}/governance` }, candidate.id);
  return election;
}

export async function respondToNomination(electionId: string, userId: string, accept: boolean, now = new Date()) {
  const e = await prisma.modElection.findUnique({ where: { id: electionId }, include: { space: true } });
  if (!e) throw notFound('Election not found.');
  if (e.candidateId !== userId) throw forbidden('Only the nominee can respond to a nomination.');
  if (e.status !== 'active' || e.electionType !== 'add_mod' || e.acceptedAt) throw conflict('There is nothing to respond to.');
  if (now >= e.electionStart) throw conflict('Voting has already opened.');
  if (accept) return prisma.modElection.update({ where: { id: e.id }, data: { acceptedAt: now } });
  return prisma.modElection.update({ where: { id: e.id }, data: { status: 'withdrawn', closedAt: now } });
}

async function recountElection(electionId: string) {
  const [f, a] = await Promise.all([
    prisma.electionVote.count({ where: { electionId, vote: true } }),
    prisma.electionVote.count({ where: { electionId, vote: false } }),
  ]);
  await prisma.modElection.update({ where: { id: electionId }, data: { votesFor: f, votesAgainst: a } });
}

export async function castElectionVote(electionId: string, userId: string, vote: boolean, now = new Date()) {
  const e = await prisma.modElection.findUnique({ where: { id: electionId }, include: { space: true } });
  if (!e) throw notFound('Election not found.');
  if (electionPhase(e, now) !== 'voting') throw conflict(e.status === 'active' && now < e.electionStart ? 'Voting has not opened yet.' : 'Voting is closed.');
  if (e.electionType === 'add_mod' && !e.acceptedAt) throw conflict('The nominee has not accepted yet.');
  if (e.candidateId === userId) throw forbidden('You cannot vote in your own election.');
  const voter = await getUserById(userId);
  const ok = await voterEligibility(voter, e.space, now);
  if (!ok.ok) throw new HttpError(403, ok.reasons.join(' '), 'not_eligible');
  await prisma.electionVote.upsert({ where: { electionId_userId: { electionId, userId } }, create: { electionId, userId, vote }, update: { vote } });
  await recountElection(electionId);
}

export async function finalizeElection(electionId: string, now = new Date()): Promise<ModElection | null> {
  const e = await prisma.modElection.findUnique({ where: { id: electionId }, include: { space: true, candidate: true } });
  if (!e || e.status !== 'active' || now < e.electionStart) return e;

  // A nomination nobody accepted lapses when voting would have opened.
  if (e.electionType === 'add_mod' && !e.acceptedAt) {
    return prisma.modElection.update({ where: { id: e.id }, data: { status: 'withdrawn', closedAt: now } });
  }
  if (now < e.electionEnd) return e;

  await recountElection(e.id);
  const fresh = (await prisma.modElection.findUnique({ where: { id: e.id } }))!;
  const outcome = evaluate({ votesFor: fresh.votesFor, votesAgainst: fresh.votesAgainst, subscribers: e.subscribersAtStart, requiredApproval: e.requiredApproval, requiredTurnout: RULES.election.turnout });

  if (outcome.passed) {
    if (e.electionType === 'add_mod') {
      await prisma.moderator.upsert({
        where: { userId_spaceId: { userId: e.candidateId, spaceId: e.spaceId } },
        create: { userId: e.candidateId, spaceId: e.spaceId, addedBy: e.nominatorId ?? e.candidateId, permissions: DEFAULT_MOD_PERMISSIONS },
        update: {},
      });
    } else {
      const remaining = await prisma.moderator.count({ where: { spaceId: e.spaceId, userId: { not: e.candidateId } } });
      if (remaining > 0) await prisma.moderator.deleteMany({ where: { userId: e.candidateId, spaceId: e.spaceId } });
    }
  }
  const closed = await prisma.modElection.update({ where: { id: e.id }, data: { status: outcome.passed ? 'passed' : 'failed', closedAt: now } });

  const pct = Math.round(outcome.approval * 100);
  const summary = `${pct}% approval, ${Math.round(outcome.turnout * 100)}% turnout (needed ${Math.round(e.requiredApproval * 100)}% and ${Math.round(RULES.election.turnout * 100)}%).`;
  await notify(e.candidateId, {
    type: 'election_result',
    title: e.electionType === 'add_mod' ? (outcome.passed ? `You are now a moderator of v/${e.space.name}` : `You were not elected in v/${e.space.name}`) : (outcome.passed ? `You were removed as moderator of v/${e.space.name}` : `The vote to remove you in v/${e.space.name} failed`),
    body: summary, link: `/v/${e.space.name}/governance`,
  });
  await notifyModerators(e.spaceId, { type: 'election_result', title: `Election result in v/${e.space.name}: ${e.candidate.username} ${outcome.passed ? 'passed' : 'failed'}`, body: summary, link: `/v/${e.space.name}/governance` }, e.candidateId);
  return closed;
}

// ---------------------------------------------------------------------------------------------
// Community votes
// ---------------------------------------------------------------------------------------------

export async function startCommunityVote(input: { spaceName: string; proposerId: string; voteType: CommunityVoteType; title: string; proposal: string; payload?: { rules?: string[] } }, now = new Date()) {
  const space = await getSpace(input.spaceName);
  const proposer = await getUserById(input.proposerId);
  const ok = await voterEligibility(proposer, space, now, true);
  if (!ok.ok) throw new HttpError(403, `You cannot start a vote: ${ok.reasons.join(' ')}`, 'not_eligible');

  if (input.voteType === 'change_rules') {
    const rules = input.payload?.rules;
    if (!Array.isArray(rules) || !rules.length || rules.length > 20 || rules.some((r) => typeof r !== 'string' || !r.trim() || r.length > 300)) {
      throw badRequest('A rules vote needs a list of 1 to 20 rules, each up to 300 characters.');
    }
  }
  if (input.voteType === 'enable_ads' && space.adEnabled) throw badRequest('Ads are already enabled.');
  if (input.voteType === 'disable_ads' && !space.adEnabled) throw badRequest('Ads are already disabled.');
  if (input.voteType === 'set_private' && space.isPrivate) throw badRequest('The space is already private.');
  if (input.voteType === 'set_public' && !space.isPrivate) throw badRequest('The space is already public.');
  if (await prisma.communityVote.findFirst({ where: { spaceId: space.id, voteType: input.voteType, status: 'active' } })) throw conflict('There is already an open vote on that.');

  const starts = new Date(now.getTime() + RULES.community.discussionDays * DAY);
  const vote = await prisma.communityVote.create({
    data: {
      spaceId: space.id, voteType: input.voteType, title: input.title, proposal: input.proposal, proposerId: proposer.id,
      payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
      votingStartsAt: starts, endsAt: new Date(starts.getTime() + RULES.community.votingDays * DAY),
      subscribersAtStart: space.subscriberCount, requiredApproval: RULES.community.approval, requiredTurnout: RULES.community.turnout,
    },
  });
  await notifyModerators(space.id, { type: 'community_vote_started', title: `New community vote in v/${space.name}`, body: input.title, link: `/v/${space.name}/governance` }, proposer.id);
  return vote;
}

async function recountVote(voteId: string) {
  const [f, a] = await Promise.all([
    prisma.communityBallot.count({ where: { voteId, vote: true } }),
    prisma.communityBallot.count({ where: { voteId, vote: false } }),
  ]);
  await prisma.communityVote.update({ where: { id: voteId }, data: { votesFor: f, votesAgainst: a } });
}

export async function castCommunityBallot(voteId: string, userId: string, vote: boolean, now = new Date()) {
  const v = await prisma.communityVote.findUnique({ where: { id: voteId }, include: { space: true } });
  if (!v) throw notFound('Vote not found.');
  const phase = communityPhase(v, now);
  if (phase === 'discussion') throw conflict('Voting has not opened yet. The discussion period is still running.');
  if (phase === 'closed') throw conflict('Voting is closed.');
  const voter = await getUserById(userId);
  const ok = await voterEligibility(voter, v.space, now);
  if (!ok.ok) throw new HttpError(403, ok.reasons.join(' '), 'not_eligible');
  await prisma.communityBallot.upsert({ where: { voteId_userId: { voteId, userId } }, create: { voteId, userId, vote }, update: { vote } });
  await recountVote(voteId);
}

export async function finalizeCommunityVote(voteId: string, now = new Date()): Promise<CommunityVote | null> {
  const v = await prisma.communityVote.findUnique({ where: { id: voteId }, include: { space: true } });
  if (!v || v.status !== 'active' || now < v.endsAt) return v;

  await recountVote(v.id);
  const fresh = (await prisma.communityVote.findUnique({ where: { id: v.id } }))!;
  const outcome = evaluate({ votesFor: fresh.votesFor, votesAgainst: fresh.votesAgainst, subscribers: v.subscribersAtStart, requiredApproval: v.requiredApproval, requiredTurnout: v.requiredTurnout });

  if (outcome.passed) {
    const data: Prisma.SpaceUpdateInput = {};
    if (v.voteType === 'enable_ads') data.adEnabled = true;
    if (v.voteType === 'disable_ads') data.adEnabled = false;
    if (v.voteType === 'set_private') data.isPrivate = true;
    if (v.voteType === 'set_public') data.isPrivate = false;
    if (v.voteType === 'delete_space') data.deletedAt = now;
    if (v.voteType === 'change_rules') data.rules = (v.payload as { rules?: string[] } | null)?.rules ?? [];
    await prisma.space.update({ where: { id: v.spaceId }, data });
  }
  const closed = await prisma.communityVote.update({
    where: { id: v.id },
    data: { status: outcome.passed ? 'passed' : 'failed', closedAt: now, result: { approval: outcome.approval, turnout: outcome.turnout, total: outcome.total } },
  });
  await notifyModerators(v.spaceId, { type: 'community_vote_result', title: `Community vote ${outcome.passed ? 'passed' : 'failed'} in v/${v.space.name}`, body: `${v.title}: ${Math.round(outcome.approval * 100)}% approval, ${Math.round(outcome.turnout * 100)}% turnout.`, link: `/v/${v.space.name}/governance` });
  return closed;
}

/** Close everything that is due. Runs on a timer and whenever someone looks at a governance page. */
export async function closeDueGovernance(now = new Date(), spaceId?: string): Promise<{ elections: number; votes: number }> {
  const scope = spaceId ? { spaceId } : {};
  const elections = await prisma.modElection.findMany({ where: { ...scope, status: 'active', electionStart: { lte: now } }, select: { id: true } });
  let closedElections = 0;
  for (const e of elections) { const r = await finalizeElection(e.id, now); if (r && r.status !== 'active') closedElections++; }
  const votes = await prisma.communityVote.findMany({ where: { ...scope, status: 'active', endsAt: { lte: now } }, select: { id: true } });
  let closedVotes = 0;
  for (const v of votes) { const r = await finalizeCommunityVote(v.id, now); if (r && r.status !== 'active') closedVotes++; }
  return { elections: closedElections, votes: closedVotes };
}
