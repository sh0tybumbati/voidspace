import bcrypt from 'bcryptjs';
import { prisma } from '../db';


async function main() {
  console.log('🌱 Seeding test data...');

  // Create test users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: 'alice' },
      update: {},
      create: {
        username: 'alice',
        email: 'alice@example.com',
        passwordHash: hashedPassword,
      },
    }),
    prisma.user.upsert({
      where: { username: 'bob' },
      update: {},
      create: {
        username: 'bob',
        email: 'bob@example.com',
        passwordHash: hashedPassword,
      },
    }),
    prisma.user.upsert({
      where: { username: 'charlie' },
      update: {},
      create: {
        username: 'charlie',
        email: 'charlie@example.com',
        passwordHash: hashedPassword,
      },
    }),
  ]);

  console.log('✓ Created 3 test users (alice, bob, charlie)');
  console.log('  Password for all: password123');

  // Create test spaces
  const techSpace = await prisma.space.upsert({
    where: { name: 'technology' },
    update: {},
    create: {
      name: 'technology',
      displayName: 'Technology',
      description: 'A space for discussing the latest in tech, gadgets, and software',
      creatorId: users[0].id, // alice
      rules: [
        'Be respectful and constructive',
        'No spam or self-promotion',
        'Stay on topic',
      ],
      subscriberCount: 0,
      isNsfw: false,
      nsfwType: 'none',
      adEnabled: false,
    },
  });

  // Make alice a founder moderator
  await prisma.moderator.upsert({
    where: {
      userId_spaceId: {
        userId: users[0].id,
        spaceId: techSpace.id,
      },
    },
    update: {},
    create: {
      userId: users[0].id,
      spaceId: techSpace.id,
      addedBy: users[0].id,
      isFounder: true,
      permissions: { all: true },
    },
  });

  const gamingSpace = await prisma.space.upsert({
    where: { name: 'gaming' },
    update: {},
    create: {
      name: 'gaming',
      displayName: 'Gaming',
      description: 'Everything about video games - news, reviews, and discussions',
      creatorId: users[1].id, // bob
      rules: [
        'No spoilers without warning',
        'Be kind to fellow gamers',
        'Platform wars are not allowed',
      ],
      subscriberCount: 0,
      isNsfw: false,
      nsfwType: 'none',
      adEnabled: false,
    },
  });

  // Make bob a founder moderator
  await prisma.moderator.upsert({
    where: {
      userId_spaceId: {
        userId: users[1].id,
        spaceId: gamingSpace.id,
      },
    },
    update: {},
    create: {
      userId: users[1].id,
      spaceId: gamingSpace.id,
      addedBy: users[1].id,
      isFounder: true,
      permissions: { all: true },
    },
  });

  console.log('✓ Created 2 test spaces (technology, gaming)');

  // Create test posts
  const posts = await Promise.all([
    prisma.post.create({
      data: {
        title: 'What are your thoughts on the latest AI developments?',
        content: 'The recent advances in AI have been incredible. What do you think will be the next big breakthrough?',
        postType: 'text',
        authorId: users[0].id,
        spaceId: techSpace.id,
        voteScore: 5,
        commentCount: 0,
        isNsfw: false,
        hotScore: 0.5,
      },
    }),
    prisma.post.create({
      data: {
        title: 'Just finished Elden Ring - What a masterpiece!',
        content: 'After 120 hours, I finally completed Elden Ring. This game is absolutely incredible. The world design, boss fights, and exploration are top-notch. Highly recommend!',
        postType: 'text',
        authorId: users[1].id,
        spaceId: gamingSpace.id,
        voteScore: 12,
        commentCount: 0,
        isNsfw: false,
        hotScore: 0.8,
      },
    }),
    prisma.post.create({
      data: {
        title: 'New programming language announcement',
        content: 'Check out this new systems programming language that focuses on memory safety without garbage collection.',
        postType: 'text',
        authorId: users[2].id,
        spaceId: techSpace.id,
        voteScore: 8,
        commentCount: 0,
        isNsfw: false,
        hotScore: 0.6,
      },
    }),
    prisma.post.create({
      data: {
        title: 'Looking for co-op game recommendations',
        content: 'My friend and I are looking for a good co-op game to play together. We enjoyed It Takes Two and Portal 2. Any suggestions?',
        postType: 'text',
        authorId: users[2].id,
        spaceId: gamingSpace.id,
        voteScore: 3,
        commentCount: 0,
        isNsfw: false,
        hotScore: 0.4,
      },
    }),
  ]);

  console.log('✓ Created 4 test posts');

  // Create some comments
  await Promise.all([
    prisma.comment.create({
      data: {
        content: 'I think multimodal AI is going to be huge. The ability to understand and generate across text, images, and video will unlock so many use cases.',
        authorId: users[1].id,
        postId: posts[0].id,
        voteScore: 2,
        depthLevel: 0,
      },
    }),
    prisma.comment.create({
      data: {
        content: 'Agreed! Elden Ring is probably my game of the decade. FromSoftware really outdid themselves.',
        authorId: users[0].id,
        postId: posts[1].id,
        voteScore: 5,
        depthLevel: 0,
      },
    }),
    prisma.comment.create({
      data: {
        content: 'Have you tried A Way Out? It\'s from the same developers as It Takes Two and it\'s also fantastic for co-op!',
        authorId: users[0].id,
        postId: posts[3].id,
        voteScore: 1,
        depthLevel: 0,
      },
    }),
  ]);

  // Update comment counts
  await prisma.post.update({
    where: { id: posts[0].id },
    data: { commentCount: 1 },
  });
  await prisma.post.update({
    where: { id: posts[1].id },
    data: { commentCount: 1 },
  });
  await prisma.post.update({
    where: { id: posts[3].id },
    data: { commentCount: 1 },
  });

  console.log('✓ Created 3 test comments');

  console.log('\n✨ Test data seeded successfully!');
  console.log('\nTest accounts:');
  console.log('  - alice (founder of v/technology)');
  console.log('  - bob (founder of v/gaming)');
  console.log('  - charlie');
  console.log('\nPassword for all accounts: password123');
}

main()
  .catch((e) => {
    console.error('Error seeding test data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
