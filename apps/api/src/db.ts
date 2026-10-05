import { PrismaClient } from '@prisma/client';

// One client for the whole process. Several clients each hold their own connection pool.
export const prisma = new PrismaClient();
