import { db } from '@/lib/db'

/**
 * Nom de l'administrateur qui a émis l'invitation, pour dire au destinataire qui l'invite.
 * Le détenteur du jeton a reçu l'email de cette école : son émetteur ne lui apprend rien de
 * sensible. Sans nom saisi, ou si le compte a été désactivé, la page parle au nom de l'école.
 */
export async function findInviterName(userId: string): Promise<string | undefined> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } })
  return user?.name?.trim() || undefined
}
