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
  const membership = await tx.schoolMember.findUnique({
    where: { userId_schoolId: { userId, schoolId: invitation.schoolId } },
    select: { userId: true },
  })
  // Une invitation ciblant une fiche enseignant ajoute une capacité à un compte
  // déjà ADMIN/PARENT, sans écraser son rôle ni créer une seconde appartenance.
  if (membership && !invitation.teacherId) return 'alreadyMember'

  const closed = await tx.invitation.updateMany({
    where: { id: invitation.id, schoolId: invitation.schoolId, usedAt: null },
    data: { usedAt: new Date() },
  })
  if (closed.count !== 1) return 'alreadyUsed'

  // Le `SchoolMember` doit exister avant le `UserFamily` : sa clé étrangère
  // composite `(userId, schoolId) -> SchoolMember` bloquerait sinon l'insertion.
  if (!membership) {
    await tx.schoolMember.create({
      data: { userId, schoolId: invitation.schoolId, role: invitation.role },
    })
  }

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

  if (invitation.familyId) {
    await tx.userFamily.upsert({
      where: {
        userId_familyId: { userId, familyId: invitation.familyId },
        schoolId: invitation.schoolId,
      },
      create: { userId, familyId: invitation.familyId, schoolId: invitation.schoolId },
      update: {},
    })
  }

  return 'OK'
}
