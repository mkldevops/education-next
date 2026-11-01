import type { Prisma } from '@/generated/prisma/client'

/** Serialize family links with merge/deletion, and reject an archived or foreign target. */
export async function lockActiveFamily(
  tx: Prisma.TransactionClient,
  schoolId: string,
  familyId: string
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Family"
    WHERE "schoolId" = ${schoolId} AND "id" = ${familyId} AND "isActive" = true
    FOR UPDATE`
  return rows.length === 1
}
