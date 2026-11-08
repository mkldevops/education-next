import { teacherName } from '@/domain/teacher'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

type Tx = Prisma.TransactionClient

const staffSelect = {
  id: true,
  firstName: true,
  lastName: true,
  mealExempt: true,
  isActive: true,
} as const

type StaffRecord = Prisma.TeacherGetPayload<{ select: typeof staffSelect }>

const toStaff = ({ firstName, lastName, ...rest }: StaffRecord) => ({
  ...rest,
  name: teacherName({ firstName, lastName }),
})

/** Le personnel de la cantine, ce sont les enseignants de l'école (#545). */
export const staffCanteenGateway = {
  /** Enseignants actifs, et retirés qui gardent un compte repas ; actifs d'abord puis par nom. */
  list: async (schoolId: string) =>
    (
      await db.teacher.findMany({
        where: { schoolId, OR: [{ isActive: true }, { mealAccounts: { some: {} } }] },
        select: staffSelect,
        orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }, { lastName: 'asc' }],
      })
    ).map(toStaff),

  find: async (schoolId: string, id: string) => {
    const teacher = await db.teacher.findUnique({
      where: { id_schoolId: { id, schoolId } },
      select: staffSelect,
    })
    return teacher ? toStaff(teacher) : null
  },

  setMealExempt: async (schoolId: string, id: string, mealExempt: boolean) =>
    (await db.teacher.updateMany({ where: { id, schoolId }, data: { mealExempt } })).count === 1,

  /** Relu sous la transaction d'un encaissement : une exemption posée entre-temps l'emporte. */
  findForReceipt: (tx: Tx, schoolId: string, id: string) =>
    tx.teacher.findUnique({
      where: { id_schoolId: { id, schoolId } },
      select: { isActive: true, mealExempt: true },
    }),
}
