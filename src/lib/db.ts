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

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createSoftDeleteExtension> | undefined
}

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  })
  const base = new PrismaClientBase({ adapter })
  return createSoftDeleteExtension(base)
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
