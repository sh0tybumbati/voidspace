/** Make an existing account a site admin:  npm run make-admin -w apps/api -- <username> */
import 'dotenv/config';
import { prisma } from '../db';

async function main() {
  const username = process.argv[2]?.toLowerCase();
  if (!username) throw new Error('usage: npm run make-admin -w apps/api -- <username>');
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new Error(`No account named "${username}".`);
  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  console.log(`${user.username} is now a site admin.`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
