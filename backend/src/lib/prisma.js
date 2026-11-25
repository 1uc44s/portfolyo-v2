// Prisma 7 istemcisi (driver adapter: node-postgres). Tek örnek.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';

/** @param {string} connectionString */
export function createPrismaClient(connectionString = env.DATABASE_URL) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma = createPrismaClient();

/** Readiness kontrolü. */
export async function pingDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}
