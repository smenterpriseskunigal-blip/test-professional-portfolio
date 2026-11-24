import { PrismaClient } from '@prisma/client'

// One Prisma client per server process (reused across hot reloads in dev).
// There is deliberately NO fallback store: if the database is unreachable the request fails loudly
// and the real error is logged, instead of silently reading/writing somewhere else.
const g = globalThis as unknown as { __prisma?: PrismaClient }

export const db: PrismaClient =
  g.__prisma ?? (g.__prisma = new PrismaClient({ log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'] }))
