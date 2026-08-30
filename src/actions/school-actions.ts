'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { z } from 'zod'
import { schoolGateway } from '@/gateways/school-gateway'
import { schoolMemberGateway } from '@/gateways/school-member-gateway'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ACTIVE_SCHOOL_COOKIE } from '@/lib/school-context'
import { isSchoolSwitchEnabled } from '@/use-cases/platform-settings/is-school-switch-enabled'

/**
 * Bascule d'école active.
 *
 * L'appartenance est revalidée ici comme à chaque lecture : le cookie est une entrée
 * non fiable, et c'est précisément parce que cette validation est obligatoire que le
 * support de stockage peut être un simple cookie.
 *
 * Le drapeau plateforme est appliqué **ici** et pas seulement dans l'interface : masquer
 * le sélecteur laisserait l'action appelable directement, donc le drapeau décoratif. Il
 * est lu avant toute requête sur l'école visée, pour ne pas révéler son existence à un
 * appelant à qui la bascule est fermée.
 */
export async function switchSchoolAction(schoolId: string) {
  const parsed = z.uuid().safeParse(schoolId)
  if (!parsed.success) return 'invalidSchoolId' as const

  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id
  if (!userId) return 'unauthenticated' as const

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  })
  if (!user) return 'unauthenticated' as const

  // Un super-admin n'est jamais bloqué par le drapeau.
  if (!user.isSuperAdmin && !(await isSchoolSwitchEnabled())) return 'switchDisabled' as const

  const school = await schoolGateway.findActiveById(parsed.data)
  if (!school) return 'notFound' as const

  if (!user.isSuperAdmin) {
    const membership = await schoolMemberGateway.findMembership(userId, parsed.data)
    if (!membership) return 'notFound' as const
  }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_SCHOOL_COOKIE, parsed.data, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })

  // Le rendu de l'école précédente doit disparaître entièrement, layout inclus.
  revalidatePath('/', 'layout')
  return 'OK' as const
}
