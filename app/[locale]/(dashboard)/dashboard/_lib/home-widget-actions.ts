'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { CHART_GRANULARITIES, CHART_RANGES, readChartView } from '@/domain/collection-chart'
import { isImpersonating } from '@/domain/user'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { HOME_WIDGETS, hiddenWidgetsSchema } from './home-widgets'

/** Préférence d'affichage propre à l'utilisateur de la session ; un emprunt ne la modifie pas. */
async function preferenceOwner() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return 'unauthorized' as const
  if (isImpersonating(session)) return 'impersonating' as const
  return { userId: session.user.id }
}

async function storeHiddenWidgets(userId: string, widgets: readonly string[]) {
  await db.user.update({
    where: { id: userId },
    data: { dashboardHiddenWidgets: [...new Set(widgets)] },
    select: { id: true },
  })
  revalidatePath('/[locale]/dashboard', 'page')
}

export async function saveHiddenWidgetsAction(input: unknown) {
  const owner = await preferenceOwner()
  if (typeof owner === 'string') return owner

  const parsed = hiddenWidgetsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  await storeHiddenWidgets(owner.userId, parsed.data)
  return 'OK' as const
}

const toggleSchema = z.object({ widget: z.enum(HOME_WIDGETS), hidden: z.boolean() })

/** Masquer ou réafficher un seul bloc, depuis l'icône de la carte ou l'annulation du toast. */
export async function setWidgetHiddenAction(input: unknown) {
  const owner = await preferenceOwner()
  if (typeof owner === 'string') return owner

  const parsed = toggleSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { widget, hidden } = parsed.data

  const user = await db.user.findUnique({
    where: { id: owner.userId },
    select: { dashboardHiddenWidgets: true },
  })
  const current = user?.dashboardHiddenWidgets ?? []
  const next = hidden ? [...current, widget] : current.filter((entry) => entry !== widget)

  await storeHiddenWidgets(owner.userId, next)
  return 'OK' as const
}

const chartViewSchema = z.object({
  granularity: z.enum(CHART_GRANULARITIES),
  range: z.enum(CHART_RANGES),
})

/** Vue du graphique d'encaissements : découpage et période, rangés sur l'utilisateur. */
export async function saveCollectionChartViewAction(input: unknown) {
  const owner = await preferenceOwner()
  if (typeof owner === 'string') return owner

  const parsed = chartViewSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const view = readChartView(parsed.data.granularity, parsed.data.range)
  if (view.granularity !== parsed.data.granularity || view.range !== parsed.data.range) {
    return 'validationError' as const
  }

  await db.user.update({
    where: { id: owner.userId },
    data: { dashboardChartGranularity: view.granularity, dashboardChartRange: view.range },
    select: { id: true },
  })
  revalidatePath('/[locale]/dashboard', 'page')
  revalidatePath('/[locale]/dashboard/payments', 'page')
  return 'OK' as const
}
