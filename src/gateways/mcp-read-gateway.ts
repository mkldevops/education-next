import { db } from '@/lib/db'

/**
 * Projections publiées par les outils de lecture MCP, et seule frontière de ces lectures.
 *
 * Les gateways du dashboard lisent la ligne entière : une colonne ajoutée à `Teacher` y
 * entrerait sans qu'aucune relecture du MCP soit déclenchée, et partirait dans le contexte
 * du fournisseur de modèle. La surface exposée est donc décrite ici, `select` par outil,
 * plutôt que héritée d'une lecture écrite pour un écran.
 *
 * `email` et `phone` n'y figurent pas : un agent qui résout une fiche papier a besoin de
 * l'identité d'un enseignant, jamais de ses coordonnées.
 */
const teacherIdentity = { id: true, firstName: true, lastName: true } as const

const namedRef = { id: true, name: true } as const

export const mcpReadGateway = {
  // `School` n'est pas couvert par le soft-delete de `src/lib/db.ts` : le filtre est explicite.
  describeSchool: (schoolId: string) =>
    db.school.findFirst({
      where: { id: schoolId, isActive: true },
      select: { id: true, name: true, slug: true },
    }),

  listLevels: (schoolId: string) =>
    db.level.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true, nextLevel: { select: namedRef } },
      orderBy: { name: 'asc' },
    }),

  listPeriods: (schoolId: string) =>
    db.period.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true, startAt: true, endAt: true },
      orderBy: { startAt: 'desc' },
    }),

  listClassPeriods: (schoolId: string) =>
    db.classPeriod.findMany({
      where: { schoolId, isActive: true },
      select: {
        id: true,
        name: true,
        capacity: true,
        level: { select: namedRef },
        period: { select: namedRef },
        // L'extension soft-delete ne filtre que la racine de la requête : une relation
        // imbriquée qui ne pose pas `isActive` publie les enseignants archivés.
        teachers: {
          where: { teacher: { isActive: true } },
          select: { teacher: { select: teacherIdentity } },
        },
      },
      orderBy: { name: 'asc' },
    }),

  listPlans: (schoolId: string) =>
    db.plan.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true, amount: true },
      orderBy: { name: 'asc' },
    }),

  listTeachers: (schoolId: string) =>
    db.teacher.findMany({
      where: { schoolId, isActive: true },
      select: teacherIdentity,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
}
