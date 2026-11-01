import { lockActiveFamily } from '@/gateways/family-mutation-lock'
import { grantMemberRole } from '@/gateways/school-member-gateway'
import type { Invitation, Prisma } from '@/generated/prisma/client'

export type LinkInvitedUserResult = 'OK' | 'alreadyMember' | 'alreadyUsed'

/**
 * Rattachement d'un compte à l'école de l'invitation, dans une transaction ouverte
 * par l'appelant.
 *
 * Partagé par les deux acceptations — création de compte et compte existant — pour
 * qu'un seul endroit décide de l'ordre des écritures et de la fermeture du jeton.
 *
 * La fermeture vient AVANT les rattachements et porte `usedAt: null` dans son propre
 * `where` : c'est le seul point de sérialisation de deux acceptations concurrentes.
 * Fermer après coup laisserait la seconde créer son appartenance avant de découvrir
 * que le jeton était déjà consommé.
 */
export async function linkInvitedUser(
  tx: Prisma.TransactionClient,
  invitation: Invitation,
  userId: string
): Promise<LinkInvitedUserResult> {
  // Merge may have moved the invitation since the public token lookup. Lock its
  // current active family before consuming the token, in merge's family-first order.
  let familyId = invitation.familyId
  if (familyId) {
    const current = await tx.invitation.findUnique({
      where: { id: invitation.id, schoolId: invitation.schoolId },
      select: { familyId: true },
    })
    if (!current) return 'alreadyUsed'
    familyId = current.familyId
    if (!familyId || !(await lockActiveFamily(tx, invitation.schoolId, familyId))) {
      throw new Error('familyLinkUnavailable')
    }
  }

  const membership = await tx.schoolMember.findUnique({
    where: { userId_schoolId: { userId, schoolId: invitation.schoolId } },
    select: { roles: true },
  })
  // Les rôles se cumulent : l'invitation ajoute le sien à un membre qui ne l'a pas encore,
  // sans créer de seconde appartenance. Une invitation ciblant une fiche enseignant lie
  // toujours sa fiche.
  if (membership?.roles.includes(invitation.role) && !invitation.teacherId) {
    return 'alreadyMember'
  }

  const closed = await tx.invitation.updateMany({
    where: { id: invitation.id, schoolId: invitation.schoolId, usedAt: null },
    data: { usedAt: new Date() },
  })
  if (closed.count !== 1) return 'alreadyUsed'

  // Le `SchoolMember` doit exister avant le `UserFamily` : sa clé étrangère
  // composite `(userId, schoolId) -> SchoolMember` bloquerait sinon l'insertion.
  await grantMemberRole(tx, userId, invitation.schoolId, invitation.role)

  if (invitation.teacherId) {
    // L'extension soft-delete ne couvre pas `updateMany` : sans `isActive: true`, une
    // fiche archivée entre l'envoi et l'acceptation serait liée au compte, qui
    // obtiendrait une appartenance TEACHER sans aucune capacité.
    const linked = await tx.teacher.updateMany({
      where: {
        id: invitation.teacherId,
        schoolId: invitation.schoolId,
        userId: null,
        isActive: true,
      },
      data: { userId },
    })
    if (linked.count !== 1) throw new Error('teacherLinkUnavailable')
  }

  if (familyId) {
    await tx.userFamily.upsert({
      where: {
        userId_familyId: { userId, familyId },
        schoolId: invitation.schoolId,
      },
      create: { userId, familyId, schoolId: invitation.schoolId },
      update: {},
    })
  }

  return 'OK'
}
