import { Card, type Column, DataTable } from '@peaklab/ui'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { CreateLevelDialog } from './_components/create-level-dialog'
import { EditLevelDialog } from './_components/edit-level-dialog'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.levels.title'),
  }
}

export default async function LevelsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.levels')

  const levels = await db.level.findMany({
    where: { isActive: true },
    include: {
      nextLevel: true,
      _count: {
        select: { classPeriods: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const allLevelsForSelect = levels.map((l) => ({ id: l.id, name: l.name }))

  const chains = buildPromotionChains(levels)

  const columns: Column<(typeof levels)[number]>[] = [
    {
      key: 'name',
      header: t('name'),
    },
    {
      key: 'nextLevel',
      header: t('nextLevel'),
      className: 'text-gray-700',
      render: (level) => level.nextLevel?.name || t('none'),
    },
    {
      key: 'classes',
      header: t('classes'),
      className: 'text-gray-700',
      render: (level) => level._count.classPeriods,
    },
    {
      key: 'actions',
      header: t('actions'),
      headerClassName: 'text-right',
      className: 'text-right',
      render: (level) => (
        <EditLevelDialog
          level={{ id: level.id, name: level.name }}
          currentNextLevelId={level.nextLevelId}
          allLevels={allLevelsForSelect}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <CreateLevelDialog />
      </div>

      {chains.length > 0 && (
        <Card className="rounded-xl border border-gray-200 p-4">
          <p className="mb-2 text-sm font-medium text-gray-500">{t('promotionChain')}</p>
          <div className="flex flex-wrap gap-2">
            {chains.map((chain) => (
              <div key={chain.join('-')} className="flex items-center gap-1 text-sm">
                {chain.map((name) => (
                  <span key={name} className="flex items-center gap-1">
                    {chain.indexOf(name) > 0 && <span className="text-gray-400">&rarr;</span>}
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-medium">{name}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="rounded-xl border border-gray-200">
        <DataTable
          data={levels}
          columns={columns}
          getRowKey={(item) => item.id}
          emptyMessage={t('noLevels')}
        />
      </Card>
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
