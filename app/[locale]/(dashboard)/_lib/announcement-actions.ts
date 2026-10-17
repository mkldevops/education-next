'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { isImpersonating } from '@/domain/user'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Fermer la pop-up ou ouvrir `/dashboard/news` marque toutes les nouveautés comme vues pour
 * l'utilisateur de la session. Un emprunt d'identité ne touche pas à l'état de la cible.
 */
export async function markAnnouncementsSeenAction() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return 'unauthorized' as const
  if (isImpersonating(session)) return 'impersonating' as const

  await db.user.update({
    where: { id: session.user.id },
    data: { announcementsSeenAt: new Date() },
    select: { id: true },
  })

  revalidatePath('/[locale]/dashboard', 'layout')
  return 'OK' as const
}
