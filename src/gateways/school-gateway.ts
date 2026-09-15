import type { DeactivationVerdict } from '@/domain/school-deactivation'
import { classifySchoolDeactivation } from '@/domain/school-deactivation'
import { db } from '@/lib/db'
import { SCHOOL_CONFIG_DEFAULTS } from '@/lib/school-config-defaults'

type SchoolIdentity = {
  name: string
  slug: string
  address?: string
  postCode?: string
  city?: string
}

/**
 * `School` n'est pas dans `modelsWithIsActive` : le filtre `isActive` est donc
 * explicite ici. Les lectures de contexte et le sélecteur le posent ; la surface
 * d'administration ne le pose pas, faute de quoi une école désactivée serait
 * introuvable, donc irréactivable.
 */
export const schoolGateway = {
  findActiveById: (id: string) =>
    db.school.findFirst({
      where: { id, isActive: true },
      select: { id: true, name: true, slug: true },
    }),

  listActive: () =>
    db.school.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      // Départage explicite : le repli du contexte doit être déterministe même
      // lorsque plusieurs écoles partagent un createdAt issu d'un backfill.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),

  /** Administration — sans filtre `isActive`, sinon la réactivation est inatteignable. */
  listAll: () =>
    db.school.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        postCode: true,
        city: true,
        isActive: true,
        createdAt: true,
        _count: { select: { members: true, families: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),

  /** Administration — sans filtre `isActive`, pour la même raison que `listAll`. */
  findById: (id: string) =>
    db.school.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        postCode: true,
        city: true,
        isActive: true,
      },
    }),

  // Le `select` gagne `name` et `slug` pour la page publique et le flux ICS (#326) ; les
  // appelants préexistants (`create-school.ts`, `update-school.ts`) ne lisaient que `id`
  // et `isActive` pour détecter un slug déjà pris.
  findBySlug: (slug: string) =>
    db.school.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, isActive: true },
    }),

  /**
   * L'école et ses réglages par défaut dans la même transaction : une école créée
   * depuis l'interface arrivait sans aucune ligne `Config`, donc sans thème ni
   * capacité de classe modifiables.
   */
  create: (data: SchoolIdentity) =>
    db.$transaction(async (tx) => {
      const school = await tx.school.create({ data })
      await tx.config.createMany({
        data: SCHOOL_CONFIG_DEFAULTS.map((config) => ({ ...config, schoolId: school.id })),
      })
      return school
    }),

  update: (id: string, data: SchoolIdentity) => db.school.update({ where: { id }, data }),

  reactivate: (id: string) => db.school.update({ where: { id }, data: { isActive: true } }),

  /**
   * Désactivation, verdict et écriture dans une seule transaction.
   *
   * `SELECT ... FOR UPDATE` verrouille les lignes actives : deux désactivations
   * concurrentes voient chacune l'autre école encore active si elles ne sont pas
   * sérialisées, et la plateforme se retrouve sans école active — état dont on ne
   * sort plus, puisque `getSchoolContext()` renvoie alors `null` pour tout le monde,
   * `/dashboard/schools` compris.
   *
   * Les blocages métier sont comptés dans la même transaction, sous le même verrou,
   * afin qu'ils ne puissent pas apparaître entre le contrôle et l'écriture.
   */
  deactivate: (id: string): Promise<DeactivationVerdict | { status: 'alreadyInactive' }> =>
    db.$transaction(async (tx) => {
      const activeSchools = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "School" WHERE "isActive" = true ORDER BY "id" FOR UPDATE`

      // Sous le verrou, l'école visée n'est plus active : une désactivation
      // concurrente est passée avant celle-ci.
      if (!activeSchools.some((school) => school.id === id)) {
        return { status: 'alreadyInactive' } as const
      }

      const [pendingEnrollments, pendingTransactions, pendingInvitations] = await Promise.all([
        tx.enrollment.count({ where: { schoolId: id, status: { in: ['PENDING', 'ACTIVE'] } } }),
        tx.paymentTransaction.count({ where: { schoolId: id, status: 'PENDING' } }),
        tx.invitation.count({ where: { schoolId: id, usedAt: null } }),
      ])

      const verdict = classifySchoolDeactivation(activeSchools.length, {
        pendingEnrollments,
        pendingTransactions,
        pendingInvitations,
      })
      if (verdict.status !== 'OK') return verdict

      await tx.school.update({ where: { id }, data: { isActive: false } })
      return verdict
    }),
}
