import { PrismaClient } from '@prisma/client';
import '../config/env.js';
import { createPinnedDatabaseAdapter } from '../config/databaseAdapter.js';

function getVercelDatabaseUrl() {
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('sslaccept', 'strict');
  return url.toString();
}

const adapter = createPinnedDatabaseAdapter();
export const prisma = new PrismaClient({
  ...(adapter ? { adapter } : process.env.VERCEL === '1' ? { datasourceUrl: getVercelDatabaseUrl() } : {}),
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
});

export async function connectDatabase() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
