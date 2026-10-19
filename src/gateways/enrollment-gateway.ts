import { OPEN_ENROLLMENT_STATUSES } from '@/domain/enrollment'
import { resolveDebtorFamily } from '@/domain/family-debtor'
import type { EnrollmentStatus, Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { acquireAdvisoryLock } from './advisory-lock'

/** Inscriptions qui valent « déjà dans la période cible » pour la promotion. */
const PROMOTED_ENROLLMENT_STATUSES = [
  'PENDING',
  'ACTIVE',
  'COMPLETED',
] as const satisfies readonly EnrollmentStatus[]

const completedEnrollmentInclude = {
  student: { include: { person: { select: { name: true, lastname: true } } } },
  classAssignments: {
    include: {
      classPeriod: {
        include: {
          level: {
            include: {
              nextLevels: {
                select: { nextLevel: { select: { id: true, name: true, isActive: true } } },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.EnrollmentInclude

/** Forme retournée par `findCompletedByPeriod`, consommée par `promote-students`. */
export type CompletedEnrollment = Prisma.EnrollmentGetPayload<{
  include: typeof completedEnrollmentInclude
}>

export const enrollmentGateway = {
  create: (
    schoolId: string,
    data: {
      studentId: string
      planId: string
      totalAmount: number
      discount?: number
      canLeaveAlone?: boolean
    }
  ) => db.enrollment.create({ data: { ...data, schoolId } }),

  findById: (schoolId: string, id: string) =>
    db.enrollment.findUnique({
      where: { id_schoolId: { id, schoolId } },
      include: {
        student: true,
        plan: true,
        payments: { where: { isActive: true }, select: { amount: true } },
      },
    }),

  updateStatus: (schoolId: string, id: string, status: EnrollmentStatus) =>
    db.enrollment.update({
      where: { id_schoolId: { id, schoolId } },
      data: { status },
    }),

  list: (schoolId: string) =>
    db.enrollment.findMany({
      where: { schoolId, isActive: true },
      include: { student: { include: { person: true } }, plan: true },
      orderBy: { registeredAt: 'desc' },
    }),

  findByStudent: (schoolId: string, studentId: string) =>
    db.enrollment.findMany({
      where: { schoolId, studentId },
      include: { plan: true },
    }),

  /**
   * Élèves déjà porteurs d'une inscription en cours sur cette période, mêmes critères que
   * `findActiveInPeriod` — statut vivant et affectation de la période, fermée ou non.
   *
   * Les affectations closes comptent : `reassignClass` ferme l'affectation d'origine sans
   * toucher au statut, donc les ignorer laisserait croire la période libre et ouvrirait un
   * formulaire que `createEnrollment` refuse avec `duplicateEnrollment`.
   *
   * À ne pas confondre avec `findEnrolledStudentIds`, même requête mais `COMPLETED` compris :
   * la promotion saute les élèves déjà promus, alors qu'ici une inscription terminée laisse la
   * réinscription ouverte, comme pour `findActiveInPeriod`.
   */
  findStudentIdsEnrolledInPeriod: async (
    schoolId: string,
    studentIds: string[],
    periodId: string
  ) => {
    if (studentIds.length === 0) return new Set<string>()

    const rows = await db.enrollment.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        status: { in: [...OPEN_ENROLLMENT_STATUSES] },
        classAssignments: { some: { classPeriod: { periodId } } },
      },
      select: { studentId: true },
    })

    return new Set(rows.map((row) => row.studentId))
  },

  /**
   * Sérialise les inscriptions d'un même élève sur une même période, jusqu'à la fin de `tx`.
   *
   * Aucune contrainte d'unicité ne peut doubler le garde de doublon : la période n'est pas
   * portée par `Enrollment` mais par la classe de l'affectation. Sans ce verrou, deux
   * transactions lisent chacune une période libre et créent deux inscriptions en cours (#316).
   */
  lockStudentInPeriod: async (
    tx: Prisma.TransactionClient,
    schoolId: string,
    studentId: string,
    periodId: string
  ) => {
    const key = `enrollment:${schoolId}:${studentId}:${periodId}`
    await acquireAdvisoryLock(tx, key)
  },

  /**
   * Inscription en cours du même élève sur la période, paiements actifs comptés : un
   * remplacement ne doit jamais effacer une inscription déjà réglée.
   *
   * À lire dans la transaction qui écrit, après `lockStudentInPeriod` : lue avant, elle ne
   * protège pas d'une inscription concurrente.
   */
  findActiveInPeriod: (
    tx: Prisma.TransactionClient,
    schoolId: string,
    studentId: string,
    periodId: string
  ) =>
    tx.enrollment.findFirst({
      where: {
        schoolId,
        studentId,
        status: { in: [...OPEN_ENROLLMENT_STATUSES] },
        classAssignments: { some: { classPeriod: { periodId } } },
      },
      select: {
        id: true,
        status: true,
        _count: { select: { payments: { where: { isActive: true } } } },
      },
    }),

  /**
   * Famille redevable d'une inscription (`resolveDebtorFamily`), à verrouiller avant de
   * toucher son total : c'est la ligne que `recordPayment` tient pendant qu'il répartit un
   * règlement (`readLockedPaidAmount`). `null` quand l'inscription n'existe pas dans cette
   * école ; `familyId` nul quand l'élève n'est rattaché à aucune famille.
   */
  findDebtorFamily: async (tx: Prisma.TransactionClient, schoolId: string, id: string) => {
    const row = await tx.enrollment.findFirst({
      where: { schoolId, id },
      select: {
        student: {
          select: {
            person: {
              select: {
                families: { select: { familyId: true, relationType: true } },
              },
            },
          },
        },
      },
    })
    if (!row) return null

    return { familyId: resolveDebtorFamily(row.student.person.families)?.familyId ?? null }
  },

  /**
   * Paiements actifs d'une inscription ouverte, à relire dans la transaction qui abaisse
   * son total, après `lockFamilyForPayment` : lus avant, ils ne protègent pas d'un
   * encaissement concurrent (#425). `null` quand l'inscription n'est plus ouverte.
   */
  findOpenActivePayments: (tx: Prisma.TransactionClient, schoolId: string, id: string) =>
    tx.enrollment.findFirst({
      where: { schoolId, id, status: { in: [...OPEN_ENROLLMENT_STATUSES] } },
      select: { payments: { where: { isActive: true }, select: { amount: true } } },
    }),

  /** `client` reçoit la transaction qui a relu le déjà-payé sous le verrou de la famille. */
  updateDiscount: (
    schoolId: string,
    id: string,
    discount: number,
    totalAmount: number,
    client: Prisma.TransactionClient = db
  ) =>
    client.enrollment.update({
      where: { id_schoolId: { id, schoolId } },
      data: { discount, totalAmount },
    }),

  /**
   * Inscription ouverte ciblée par l'affectation de formule dashboard
   * (`setEnrollmentPlan`). Statut filtré dans la lecture plutôt que vérifié après coup :
   * une inscription `COMPLETED` ou `CANCELLED` ne se distingue pas d'une inscription
   * inexistante, comme `findOpenForMcp`. Sans ses paiements : ils se relisent sous le
   * verrou de la famille (`findOpenActivePayments`), jamais ici.
   */
  findOpenById: (schoolId: string, id: string) =>
    db.enrollment.findFirst({
      where: { schoolId, id, status: { in: [...OPEN_ENROLLMENT_STATUSES] } },
    }),

  /**
   * Affecte une formule et le total recalculé qui va avec ; la remise ne bouge pas.
   * `client` reçoit la transaction qui a relu le déjà-payé sous le verrou de la famille.
   */
  assignPlan: (
    schoolId: string,
    id: string,
    planId: string,
    totalAmount: number,
    client: Prisma.TransactionClient = db
  ) =>
    client.enrollment.update({
      where: { id_schoolId: { id, schoolId } },
      data: { planId, totalAmount },
    }),

  /**
   * Sonde du `preview_update_enrollment` MCP. Projection étroite : le modèle a besoin de
   * reconnaître l'inscription, pas de lire la fiche de l'élève.
   */
  findOpenForMcp: (schoolId: string, filter: { id: string } | { name: string; lastname: string }) =>
    db.enrollment.findMany({
      where: {
        schoolId,
        status: { in: [...OPEN_ENROLLMENT_STATUSES] },
        ...('id' in filter
          ? { id: filter.id }
          : {
              student: {
                person: {
                  name: { contains: filter.name, mode: 'insensitive' },
                  lastname: { contains: filter.lastname, mode: 'insensitive' },
                },
              },
            }),
      },
      select: {
        id: true,
        status: true,
        discount: true,
        totalAmount: true,
        plan: { select: { id: true, name: true, amount: true } },
        student: { select: { person: { select: { name: true, lastname: true } } } },
        classAssignments: { select: { classPeriod: { select: { name: true } } } },
        payments: { where: { isActive: true }, select: { amount: true } },
      },
      orderBy: [{ registeredAt: 'asc' }, { id: 'asc' }],
      take: 10,
    }),

  /**
   * Inscriptions payables par une famille : celles de ses élèves dont elle est la famille
   * redevable. `families: { some: { familyId } }` ne suffit pas — un élève en garde partagée
   * est rattaché à plusieurs familles, et une seule d'entre elles doit porter la dette
   * (`resolveDebtorFamily`, appliqué comme dans `familiesOutstanding`).
   *
   * `client` reçoit la transaction d'un encaissement : lues sous `lockFamilyForPayment`, ces
   * inscriptions et leurs paiements ne peuvent plus bouger avant l'écriture.
   */
  findPayableByFamily: async (
    schoolId: string,
    familyId: string,
    client: Prisma.TransactionClient = db
  ) => {
    const rows = await client.enrollment.findMany({
      where: {
        schoolId,
        status: { in: [...OPEN_ENROLLMENT_STATUSES] },
        student: {
          person: {
            families: {
              some: { familyId },
            },
          },
        },
      },
      include: {
        payments: { where: { isActive: true } },
        student: {
          select: {
            person: {
              select: {
                families: { select: { familyId: true, relationType: true } },
              },
            },
          },
        },
      },
      orderBy: [{ registeredAt: 'asc' }, { id: 'asc' }],
    })

    return rows
      .filter((row) => resolveDebtorFamily(row.student.person.families)?.familyId === familyId)
      .map(({ student: _student, ...enrollment }) => enrollment)
  },

  findEnrolledStudentIds: async (schoolId: string, periodId: string, studentIds: string[]) => {
    if (studentIds.length === 0) return new Set<string>()

    const enrollments = await db.enrollment.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        status: { in: [...PROMOTED_ENROLLMENT_STATUSES] },
        classAssignments: { some: { classPeriod: { periodId } } },
      },
      select: { studentId: true },
    })
    return new Set(enrollments.map((enrollment) => enrollment.studentId))
  },

  /**
   * Relecture de `findEnrolledStudentIds` pour un élève, dans la transaction de promotion et après
   * `lockStudentInPeriod` : une promotion lancée deux fois (double clic, deux admins) ne crée pas
   * une seconde inscription dans la période cible.
   */
  isEnrolledInPeriod: async (
    tx: Prisma.TransactionClient,
    schoolId: string,
    studentId: string,
    periodId: string
  ) => {
    const enrollment = await tx.enrollment.findFirst({
      where: {
        schoolId,
        studentId,
        status: { in: [...PROMOTED_ENROLLMENT_STATUSES] },
        classAssignments: { some: { classPeriod: { periodId } } },
      },
      select: { id: true },
    })
    return enrollment !== null
  },

  findCompletedByPeriod: async (
    schoolId: string,
    periodId: string
  ): Promise<CompletedEnrollment[]> => {
    const enrollments = await db.enrollment.findMany({
      where: {
        schoolId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        // Un élève archivé n'est pas promu : le filtre soft-delete ne descend pas dans les
        // relations, il faut le dire ici.
        student: { isActive: true },
        classAssignments: {
          some: {
            classPeriod: { periodId },
          },
        },
      },
      include: {
        ...completedEnrollmentInclude,
        // L'affectation ouverte seulement : après un changement de classe en cours d'année,
        // l'ancienne affectation (close) désignerait le mauvais niveau de départ.
        classAssignments: {
          ...completedEnrollmentInclude.classAssignments,
          where: {
            endAt: null,
            classPeriod: { periodId },
          },
          orderBy: { startAt: 'desc' },
        },
      },
    })
    return enrollments
  },
}
