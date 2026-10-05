/**
 * Fills a development database with a believable community: spaces, people, threads, an open
 * election, an open community vote, moderation history, appeals, a legal notice and a canary.
 *
 *   npm run seed:demo -w apps/api          (refuses to run twice; pass --reset to wipe demo data first)
 *
 * Every demo account has the password "voidspace-demo". Never run this against a real database.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { adminRemoveContent, logAdminAction } from '../services/admin';
import { banUser, markReversed, removeContent, restoreContent } from '../services/moderation';
import { castCommunityBallot, castElectionVote, finalizeCommunityVote, startCommunityVote, startElection } from '../services/governance';

const PASSWORD = 'voidspace-demo';
const DAY = 86_400_000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000);

const PEOPLE = ['mara', 'joss', 'tilde', 'okoro', 'pell', 'quill', 'reeve', 'sable', 'tamsin', 'umber', 'vex', 'wren', 'yarrow', 'zeph'];

async function wipe() {
  const users = await prisma.user.findMany({ where: { OR: [{ username: { in: [...PEOPLE, 'root'] } }] }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const spaces = await prisma.space.findMany({ where: { creatorId: { in: ids } }, select: { id: true } });
  const spaceIds = spaces.map((s) => s.id);
  const posts = await prisma.post.findMany({ where: { spaceId: { in: spaceIds } }, select: { id: true } });
  const postIds = posts.map((p) => p.id);
  const sp = { spaceId: { in: spaceIds } };
  await prisma.report.deleteMany({ where: { OR: [sp, { reporterId: { in: ids } }] } });
  await prisma.appeal.deleteMany({ where: sp });
  await prisma.modAction.deleteMany({ where: sp });
  await prisma.ban.deleteMany({ where: sp });
  await prisma.communityBallot.deleteMany({ where: { voteId: { in: (await prisma.communityVote.findMany({ where: sp, select: { id: true } })).map((v) => v.id) } } });
  await prisma.communityVote.deleteMany({ where: sp });
  await prisma.electionVote.deleteMany({ where: { electionId: { in: (await prisma.modElection.findMany({ where: sp, select: { id: true } })).map((e) => e.id) } } });
  await prisma.modElection.deleteMany({ where: sp });
  await prisma.savedComment.deleteMany({ where: { commentId: { in: (await prisma.comment.findMany({ where: { postId: { in: postIds } }, select: { id: true } })).map((c) => c.id) } } });
  await prisma.comment.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.vote.deleteMany({ where: { targetId: { in: postIds } } });
  await prisma.savedPost.deleteMany({ where: { postId: { in: postIds } } });
  await prisma.post.deleteMany({ where: { id: { in: postIds } } });
  await prisma.flair.deleteMany({ where: sp });
  await prisma.subscription.deleteMany({ where: { OR: [sp, { userId: { in: ids } }] } });
  await prisma.moderator.deleteMany({ where: { OR: [sp, { userId: { in: ids } }] } });
  await prisma.space.deleteMany({ where: { id: { in: spaceIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.upload.deleteMany({ where: { userId: { in: ids } } });
  await prisma.authToken.deleteMany({ where: { userId: { in: ids } } });
  await prisma.vote.deleteMany({ where: { userId: { in: ids } } });
  await prisma.savedPost.deleteMany({ where: { userId: { in: ids } } });
  await prisma.adminAction.deleteMany({ where: { adminId: { in: ids } } });
  await prisma.legalNotice.deleteMany({});
  await prisma.transparencyCanary.deleteMany({});
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  if (process.argv.includes('--reset')) { console.log('Removing earlier demo data...'); await wipe(); }
  if (await prisma.user.findUnique({ where: { username: 'mara' } })) {
    console.log('Demo data is already there. Run with --reset to start over.');
    return;
  }
  console.log('Seeding demo community...');
  const hash = await bcrypt.hash(PASSWORD, 10);

  const user: Record<string, { id: string }> = {};
  for (const [i, name] of [...PEOPLE, 'root'].entries()) {
    user[name] = await prisma.user.create({
      data: {
        username: name, email: `${name}@example.test`, passwordHash: hash, isOver18: true, isAdmin: name === 'root',
        emailVerifiedAt: new Date(), createdAt: ago(75 - i * 2),
        bio: name === 'root' ? 'Site admin. Every action I take is on the transparency page.' : undefined,
      },
    });
  }

  const makeSpace = async (name: string, displayName: string, description: string, founder: string, rules: string[], extra: { isNsfw?: boolean } = {}) => {
    const space = await prisma.space.create({ data: { name, displayName, description, rules, creatorId: user[founder].id, createdAt: ago(60), ...extra } });
    await prisma.moderator.create({ data: { userId: user[founder].id, spaceId: space.id, addedBy: user[founder].id, isFounder: true, permissions: { all: true } } });
    return space;
  };
  const gardening = await makeSpace('gardening', 'Gardening', 'Soil, seeds and the slow work of growing things.', 'mara', ['Be kind to beginners.', 'No sales posts or referral links.', 'Photos of your own plants only.']);
  const localnews = await makeSpace('localnews', 'Local News', 'Neighbourhood news and discussion.', 'joss', ['Link to a source.', 'No personal attacks.']);
  const retro = await makeSpace('retrogames', 'Retro Games', 'Cartridges, consoles and the games that came on them.', 'tilde', ['Stay on topic.', 'Spoiler tags for anything under 20 years old.']);
  const meta = await makeSpace('meta', 'Meta', 'About Voidspace itself: feedback, questions, ideas.', 'root', ['Be constructive.']);
  const spaces = [gardening, localnews, retro, meta];

  const join = async (space: { id: string }, names: string[]) => {
    for (const n of names) await prisma.subscription.create({ data: { userId: user[n].id, spaceId: space.id, createdAt: ago(40) } });
    await prisma.space.update({ where: { id: space.id }, data: { subscriberCount: await prisma.subscription.count({ where: { spaceId: space.id } }) } });
  };
  await join(gardening, PEOPLE);
  await join(localnews, PEOPLE.slice(0, 9));
  await join(retro, PEOPLE.slice(2, 12));
  await join(meta, [...PEOPLE.slice(0, 6), 'root']);

  type PostSeed = { space: typeof gardening; by: string; title: string; content: string; score: number; days: number; type?: string; url?: string; nsfw?: boolean };
  const posts: Record<string, { id: string }> = {};
  const addPost = async (key: string, p: PostSeed) => {
    posts[key] = await prisma.post.create({ data: { spaceId: p.space.id, authorId: user[p.by].id, title: p.title, content: p.content, postType: p.type ?? 'text', url: p.url, voteScore: p.score, isNsfw: p.nsfw ?? false, createdAt: ago(p.days) } });
  };
  await addPost('tomato', { space: gardening, by: 'wren', title: 'My tomatoes split every August. What am I doing wrong?', content: 'Three seasons running, the fruit cracks right before it ripens. I water every morning. Soil is a clay loam, full sun.\n\nI have tried mulching. Any ideas before I give up on them?', score: 64, days: 9 });
  await addPost('compost', { space: gardening, by: 'wren', title: 'Hot composting in a small garden: what I learned in a year', content: '## The short version\n\n- Turn it weekly in summer.\n- Brown to green is about 3 to 1 by volume.\n- A thermometer is worth the money.\n\nHappy to answer questions.', score: 71, days: 20 });
  await addPost('frost', { space: gardening, by: 'okoro', title: 'First frost is forecast for Thursday', content: 'Cover your tender plants tonight. Old bedsheets work fine.', score: 38, days: 3 });
  await addPost('seeds', { space: gardening, by: 'pell', title: 'Seed swap thread, autumn edition', content: 'Post what you have and what you want. Please ship only within your own country.', score: 22, days: 6 });
  await addPost('spam', { space: gardening, by: 'zeph', title: 'BEST FERTILISER DEAL, click now', content: 'Buy at my-store dot example, use code GROW.', score: -4, days: 2 });
  await addPost('bridge', { space: localnews, by: 'joss', title: 'Council approves the Mill Street bridge repair', content: 'Work begins in March. The bridge will be closed to cars for about four months; foot traffic stays open.', score: 41, days: 4, type: 'link', url: 'https://example.com/mill-street-bridge' });
  await addPost('market', { space: localnews, by: 'tamsin', title: 'Saturday market is moving to the library car park', content: 'Same hours, more parking.', score: 17, days: 5 });
  await addPost('zelda', { space: retro, by: 'tilde', title: 'Finished the original Zelda with no sword upgrades', content: 'Do not recommend. Took 31 hours. Here is the route I used.', score: 53, days: 7 });
  await addPost('cart', { space: retro, by: 'quill', title: 'How do I clean a corroded cartridge connector?', content: 'Found one at a flea market. The pins are green.', score: 19, days: 8 });
  await addPost('welcome', { space: meta, by: 'root', title: 'Welcome to Voidspace. Read this first.', content: 'Moderators here are elected, moderation is logged in public, and decisions can be appealed.\n\nThe [transparency page](/transparency) shows what admins do. Ask anything below.', score: 88, days: 30 });
  await addPost('feedback', { space: meta, by: 'mara', title: 'Feature request: let spaces pin two posts', content: 'One pinned slot is tight when there is a weekly thread plus the rules.', score: 12, days: 2 });

  const addComment = async (post: string, by: string, content: string, score: number, days: number, parent?: { id: string; depthLevel: number }) => {
    const c = await prisma.comment.create({ data: { postId: posts[post].id, authorId: user[by].id, content, voteScore: score, depthLevel: parent ? parent.depthLevel + 1 : 0, parentCommentId: parent?.id, createdAt: ago(days) } });
    await prisma.post.update({ where: { id: posts[post].id }, data: { commentCount: { increment: 1 } } });
    return c;
  };
  const c1 = await addComment('tomato', 'mara', 'Cracking is almost always uneven watering. A dry spell and then a big drink makes the fruit swell faster than the skin can stretch.', 32, 9);
  const c2 = await addComment('tomato', 'wren', 'That fits. I water daily, but August is when I go on holiday for a week.', 6, 8, c1);
  await addComment('tomato', 'okoro', 'Try a drip line on a timer. Fixed this for me completely.', 14, 8, c2);
  await addComment('tomato', 'pell', 'Pick them at first blush and ripen them indoors. Less cracking, no loss of flavour.', 21, 8);
  await addComment('compost', 'quill', 'How do you handle the smell in July?', 4, 19);
  await addComment('frost', 'tamsin', 'Thank you. I would have forgotten the basil.', 5, 3);
  const bad = await addComment('frost', 'zeph', 'You are all idiots, nobody needs a frost warning, this is a waste of a post.', -8, 3);
  await addComment('bridge', 'tamsin', 'Four months is optimistic. The last repair took eight.', 11, 4);
  await addComment('zelda', 'quill', 'Thirty-one hours is nothing. Try it blindfolded.', 9, 7);
  await addComment('welcome', 'mara', 'Glad to be here. The mod log is the feature that sold me.', 15, 29);

  // ---- Moderation history
  await removeContent(user.mara.id, 'post', posts.spam.id, 'Advertising. Rule 2: no sales posts or referral links.');
  const removal = await removeContent(user.mara.id, 'comment', bad.id, 'Personal attack on other members. Be kind to beginners.');
  await banUser(user.mara.id, gardening.id, user.zeph.id, 'Repeated spam and abuse after a warning.', 7);
  // an earlier removal that was appealed and reversed
  await addPost('bridgeold', { space: localnews, by: 'umber', title: 'Is the bridge closing really needed?', content: 'Asking questions about the cost estimate.', score: 3, days: 12 });
  const reversed = await removeContent(user.joss.id, 'post', posts.bridgeold.id, 'Off topic.');
  await prisma.appeal.create({ data: { userId: user.umber.id, spaceId: localnews.id, modActionId: reversed.action.id, reason: 'The post is about a local news item and cites the council document. It is not off topic.', status: 'pending' } });
  await restoreContent(user.joss.id, 'post', posts.bridgeold.id, 'Restored: it was on topic.', {});
  await markReversed(reversed.action.id, user.joss.id);
  await prisma.appeal.updateMany({ where: { modActionId: reversed.action.id }, data: { status: 'approved', reviewedBy: user.joss.id, reviewerNotes: 'Reviewed again. It is on topic; reversed.', resolvedAt: new Date() } });

  // a pending appeal in gardening (escalates, since mara is the only mod)
  await prisma.appeal.create({ data: { userId: user.zeph.id, spaceId: gardening.id, modActionId: removal.action.id, reason: 'I was having a bad day and I apologise. I was not attacking anyone in particular and have not repeated it.', status: 'escalated', escalatedAt: new Date() } });

  // pending reports for the queue
  await prisma.report.create({ data: { reporterId: user.okoro.id, spaceId: gardening.id, targetType: 'post', targetId: posts.seeds.id, category: 'rule_violation', reason: 'Asks people to ship seeds, which can break import rules.', status: 'pending' } });
  await prisma.report.create({ data: { reporterId: user.reeve.id, spaceId: gardening.id, targetType: 'comment', targetId: (await prisma.comment.findFirstOrThrow({ where: { postId: posts.tomato.id, authorId: user.pell.id } })).id, category: 'spam', reason: 'Looks like it is leading toward a sales pitch.', status: 'pending' } });

  // ---- Governance: wren stands for moderator of gardening (alignment ~100+ from the posts above)
  const election = await startElection({ spaceName: 'gardening', type: 'add_mod', requesterId: user.wren.id });
  console.log('  election opened for wren in v/gardening');
  // pull the dates forward so voting is open and a few ballots are in
  await prisma.modElection.update({ where: { id: election.id }, data: { electionStart: ago(1), electionEnd: new Date(Date.now() + 6 * DAY) } });
  for (const [n, v] of [['okoro', true], ['pell', true], ['quill', true], ['reeve', false], ['sable', true]] as const) await castElectionVote(election.id, user[n].id, v);

  const cv = await startCommunityVote({ spaceName: 'gardening', proposerId: user.okoro.id, voteType: 'change_rules', title: 'Allow seed-swap posts with a monthly cap', proposal: 'Seed swaps are popular and harmless. Allow one swap thread per month, run by a moderator, and keep the ban on sales.', payload: { rules: ['Be kind to beginners.', 'No sales posts or referral links.', 'Photos of your own plants only.', 'One seed-swap thread per month, run by a moderator.'] } });
  await prisma.communityVote.update({ where: { id: cv.id }, data: { votingStartsAt: ago(0, 2), endsAt: new Date(Date.now() + 7 * DAY) } });
  for (const [n, v] of [['mara', true], ['pell', true], ['tamsin', false], ['umber', true]] as const) await castCommunityBallot(cv.id, user[n].id, v);
  await startCommunityVote({ spaceName: 'retrogames', proposerId: user.quill.id, voteType: 'enable_ads', title: 'Run one banner ad to pay for a server', proposal: 'A single non-animated banner on the sidebar, nothing in the feed.' });

  // a finished vote, so the result view has something to show
  const done = await startCommunityVote({ spaceName: 'localnews', proposerId: user.tamsin.id, voteType: 'change_rules', title: 'Require a source link on every news post', proposal: 'Posts about local events must link to where the information came from.', payload: { rules: ['Link to a source.', 'No personal attacks.', 'Every news post needs a source link.'] } });
  await prisma.communityVote.update({ where: { id: done.id }, data: { votingStartsAt: ago(8), endsAt: new Date(Date.now() + DAY) } });
  for (const [n, v] of [['joss', true], ['okoro', true], ['pell', true], ['quill', true], ['reeve', true], ['sable', false], ['tilde', true]] as const) await castCommunityBallot(done.id, user[n].id, v);
  await prisma.communityVote.update({ where: { id: done.id }, data: { endsAt: ago(1) } });
  await finalizeCommunityVote(done.id);

  // ---- Admin / transparency
  await adminRemoveContent(user.root.id, 'post', (await prisma.post.create({ data: { spaceId: meta.id, authorId: user.zeph.id, title: 'Free movie downloads here', content: 'Link to pirated films.', postType: 'text', createdAt: ago(5) } })).id, 'Links to pirated films, reported twice. Removed and the account warned.');
  await logAdminAction(user.root.id, 'dismiss_report', user.vex.id, 'user', 'Reviewed the report about this account. It was a disagreement, not a violation.');
  await prisma.legalNotice.create({ data: { noticeType: 'dmca', jurisdiction: 'United States', dateReceived: ago(18), actionTaken: 'Removed the one link named in the notice and told the poster, who did not counter-notify.', publicSummary: 'A takedown request about a link in a Retro Games comment.' } });
  await prisma.transparencyCanary.create({ data: { statement: 'As of today, Voidspace has not received any secret court orders, gag orders, or requests for user data from any government.', validUntil: new Date(Date.now() + 26 * DAY), createdAt: ago(4) } });

  // keep stored alignment in step with the votes above
  for (const u of Object.values(user)) {
    const [p, c] = await Promise.all([
      prisma.post.aggregate({ where: { authorId: u.id, removed: false }, _sum: { voteScore: true } }),
      prisma.comment.aggregate({ where: { authorId: u.id, removed: false }, _sum: { voteScore: true } }),
    ]);
    await prisma.user.update({ where: { id: u.id }, data: { alignment: (p._sum.voteScore ?? 0) + (c._sum.voteScore ?? 0) } });
  }

  console.log(`Done. ${spaces.length} spaces, ${PEOPLE.length + 1} accounts. Sign in as mara (founder of v/gardening), wren (candidate), zeph (banned, appealing) or root (admin). Password: ${PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
