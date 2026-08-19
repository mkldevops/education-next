import { PrismaPg } from '@prisma/adapter-pg'
import type { PrismaClient } from '@/generated/prisma/client'
import { PrismaClient as PrismaClientBase } from '@/generated/prisma/client'

function createSoftDeleteExtension(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (hasIsActive(model)) {
            args.where = { ...args.where, isActive: true }
          }
          return query(args)
        },
        async findFirst({ model, args, query }) {
          if (hasIsActive(model)) {
            args.where = { ...args.where, isActive: true }
          }
          return query(args)
        },
        async findUnique({ model, args, query }) {
          if (hasIsActive(model)) {
            args.where = { ...args.where, isActive: true } as typeof args.where
          }
          return query(args)
        },
        async count({ model, args, query }) {
          if (hasIsActive(model)) {
            args.where = { ...args.where, isActive: true }
          }
          return query(args)
        },
      },
    },
  })
}

const modelsWithIsActive = new Set([
  'User',
  'Family',
  'Person',
  'Student',
  'PhoneNumber',
  'Config',
  'Level',
  'Period',
  'ClassPeriod',
  'Enrollment',
  'Payment',
  'Plan',
])

function hasIsActive(model: string | undefined): boolean {
  return model !== undefined && modelsWithIsActive.has(model)
}

type ExtendedClient = ReturnType<typeof createSoftDeleteExtension>

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined
  prisma: ExtendedClient | undefined
}

function getBaseClient(): PrismaClient {
  if (!globalForPrisma.prismaBase) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is required')
    }
    const adapter = new PrismaPg({ connectionString })
    globalForPrisma.prismaBase = new PrismaClientBase({ adapter })
  }
  return globalForPrisma.prismaBase
}

function getClient(): ExtendedClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createSoftDeleteExtension(getBaseClient())
  }
  return globalForPrisma.prisma
}

export const db = new Proxy({} as ExtendedClient, {
  get(_, prop) {
    return Reflect.get(getClient(), prop)
  },
})

/**
 * Bypasses the soft-delete filter. Reserved for reviewed administration paths that
 * must read or restore archived rows, such as super-admin user management.
 */
export const dbArchived = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return Reflect.get(getBaseClient(), prop)
  },
})
