'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { isImpersonating } from '@/domain/user'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { hiddenWidgetsSchema } from './home-widgets'

/** Préférence d'affichage propre à l'utilisateur de la session ; un emprunt ne la modifie pas. */
export async function saveHiddenWidgetsAction(input: unknown) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return 'unauthorized' as const
  if (isImpersonating(session)) return 'impersonating' as const

  const parsed = hiddenWidgetsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  await db.user.update({
    where: { id: session.user.id },
    data: { dashboardHiddenWidgets: [...new Set(parsed.data)] },
    select: { id: true },
  })

  revalidatePath('/[locale]/dashboard', 'page')
  return 'OK' as const
}
