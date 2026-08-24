import { PrismaPg } from '@prisma/adapter-pg'
import type { PrismaClient } from '@/generated/prisma/client'
import { PrismaClient as PrismaClientBase } from '@/generated/prisma/client'
import { findTenantViolation, reportTenantViolation, tenantGuardMode } from '@/lib/tenant-guard'

// `School` en est volontairement absent : forcer `isActive: true` empêcherait le CRUD
// super-admin de retrouver une école désactivée, donc de la réactiver. Le filtre est
// explicite là où il est voulu (contexte d'école, switcher, sélecteur d'écoles).
const modelsWithIsActive: Record<string, true> = {
  User: true,
  Family: true,
  Person: true,
  Student: true,
  PhoneNumber: true,
  Config: true,
  Level: true,
  Period: true,
  ClassPeriod: true,
  Enrollment: true,
  Payment: true,
  Plan: true,
}

function hasIsActive(model: string | undefined): boolean {
  return model !== undefined && modelsWithIsActive[model] === true
}

function withSoftDelete(client: PrismaClient) {
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

function createRawClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClientBase({ adapter })
}

// Les deux extensions n'enveloppent que des requêtes et n'ajoutent aucune méthode :
// la surface reste celle de PrismaClient, que l'inférence ne sait pas unifier.
function asPrismaClient(extended: unknown): PrismaClient {
  return extended as PrismaClient
}

/**
 * Client sans garde tenant, avec le seul soft-delete. Réservé aux exceptions nommées
 * de `src/lib/db-unscoped.ts` : jamais destiné au code applicatif.
 */
export function createUnguardedClient(): PrismaClient {
  return asPrismaClient(withSoftDelete(createRawClient()))
}

/**
 * Ni garde tenant, ni soft-delete. Réservé aux exceptions nommées de
 * `src/lib/db-unscoped.ts` qui doivent voir les lignes archivées : compter les
 * références avant une suppression définitive en fait partie — une famille archivée
 * contraint toujours la clé étrangère.
 */
export function createUnguardedArchivedClient(): PrismaClient {
  return createRawClient()
}

/**
 * Garde tenant. Appliqué par-dessus le soft-delete quand il y en a un : il observe
 * donc les arguments tels que l'application les a écrits. Portée exacte dans
 * `src/lib/tenant-guard.ts` — racine des requêtes uniquement, les écritures
 * imbriquées étant couvertes par les clés étrangères composites.
 */
function withTenantGuard(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const violation = findTenantViolation(model, operation, args)
          if (violation) {
            reportTenantViolation(violation, tenantGuardMode())
          }
          return query(args)
        },
      },
    },
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaArchived: PrismaClient | undefined
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = asPrismaClient(
      withTenantGuard(asPrismaClient(withSoftDelete(createRawClient())))
    )
  }
  return globalForPrisma.prisma
}

/**
 * Lève le seul filtre de soft-delete, **en gardant la garde tenant**. Les écrans
 * d'administration qui doivent lire ou réactiver une ligne archivée passent par ici ;
 * une lecture non scopée y est signalée comme partout ailleurs.
 */
function getArchivedClient(): PrismaClient {
  if (!globalForPrisma.prismaArchived) {
    globalForPrisma.prismaArchived = asPrismaClient(withTenantGuard(createRawClient()))
  }
  return globalForPrisma.prismaArchived
}

export const db = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return Reflect.get(getClient(), prop)
  },
})

export const dbArchived = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return Reflect.get(getArchivedClient(), prop)
  },
})
