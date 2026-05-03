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
  'Page',
])

function hasIsActive(model: string | undefined): boolean {
  return model !== undefined && modelsWithIsActive.has(model)
}

type ExtendedClient = ReturnType<typeof createSoftDeleteExtension>

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedClient | undefined
}

function createClient(): ExtendedClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }
  const adapter = new PrismaPg({ connectionString })
  const base = new PrismaClientBase({ adapter })
  return createSoftDeleteExtension(base)
}

function getClient(): ExtendedClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient()
  }
  return globalForPrisma.prisma
}

export const db = new Proxy({} as ExtendedClient, {
  get(_, prop) {
    return Reflect.get(getClient(), prop)
  },
})
