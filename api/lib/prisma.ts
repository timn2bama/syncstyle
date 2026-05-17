import pkg from '@prisma/client';
const { PrismaClient } = pkg;

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not defined in the environment!');
}

const globalForPrisma = global as unknown as { prisma: any };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
