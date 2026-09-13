import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { db } from '@/lib/db'
import { MAX_STUDENTS_PER_CLASS_CONFIG_KEY } from '@/lib/school-config-defaults'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { CreateLevelDialog } from './_components/create-level-dialog'
import { LevelsTable } from './_components/levels-table'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.levels.title')
}

export default async function LevelsPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.levels')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { schoolId } = await requireSchoolAdmin()

  const selectedPeriod = await getSelectedPeriod(schoolId)

  const [levels, maxStudentsConfig] = await Promise.all([
    db.level.findMany({
      where: { schoolId, isActive: true },
      include: {
        nextLevel: true,
        _count: { select: { classPeriods: true } },
        // Classes du niveau sur la période sélectionnée : leur absence déclenche le bouton
        // de génération. La liste est vide, jamais absente, quand aucune période n'est choisie.
        classPeriods: {
          where: selectedPeriod ? { periodId: selectedPeriod.id, isActive: true } : { id: '' },
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    db.config.findFirst({
      where: { schoolId, name: MAX_STUDENTS_PER_CLASS_CONFIG_KEY, isActive: true },
      select: { value: true },
    }),
  ])

  const parsedCapacity = Number(maxStudentsConfig?.value)
  const defaultCapacity =
    Number.isInteger(parsedCapacity) && parsedCapacity > 0 ? parsedCapacity : 25

  const allLevelsForSelect = levels.map((l) => ({ id: l.id, name: l.name }))

  const takenNextLevelIds = levels
    .map((l) => l.nextLevelId)
    .filter((id): id is string => id !== null)

  const chains = buildPromotionChains(levels)

  const rows = levels.map((level) => ({
    id: level.id,
    name: level.name,
    nextLevelId: level.nextLevelId,
    nextLevelName: level.nextLevel?.name ?? null,
    classCount: level._count.classPeriods,
    currentClasses: level.classPeriods,
  }))

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('levels') },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
        <CreateLevelDialog />
      </div>

      {chains.length > 0 && (
        <Card className="rounded border border-alabaster-700 p-4">
          <p className="mb-2 text-sm font-medium text-graphite-600">{t('promotionChain')}</p>
          <div className="flex flex-wrap gap-2">
            {chains.map((chain) => (
              <div key={chain.join('-')} className="flex items-center gap-1 text-sm">
                {chain.map((name) => (
                  <span key={name} className="flex items-center gap-1">
                    {chain.indexOf(name) > 0 && <span className="text-graphite-700">&rarr;</span>}
                    <span className="rounded bg-alabaster-800 px-2 py-0.5 font-medium">{name}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}

      <LevelsTable
        levels={rows}
        selectedPeriod={
          selectedPeriod ? { id: selectedPeriod.id, name: selectedPeriod.name } : null
        }
        defaultCapacity={defaultCapacity}
        allLevels={allLevelsForSelect}
        takenNextLevelIds={takenNextLevelIds}
      />
    </div>
  )
}

function buildPromotionChains(
  levels: { id: string; name: string; nextLevelId: string | null }[]
): string[][] {
  const childIds = new Set(levels.filter((l) => l.nextLevelId).map((l) => l.nextLevelId as string))
  const roots = levels.filter((l) => !childIds.has(l.id))
  const byId = new Map(levels.map((l) => [l.id, l]))

  const chains: string[][] = []
  for (const root of roots) {
    const chain: string[] = [root.name]
    let current = root
    while (current.nextLevelId) {
      const next = byId.get(current.nextLevelId)
      if (!next) break
      chain.push(next.name)
      current = next
    }
    if (chain.length > 1) chains.push(chain)
  }
  return chains
}
