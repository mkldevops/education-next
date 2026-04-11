import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { listPages } from '@/use-cases/pages/list-pages'
import { getSessionWithRole } from '../../_lib/auth-helper'
import { CreatePageDialog } from './_components/create-page-dialog'
import { PageList } from './_components/page-list'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })
  return { title: t('pages.pages.title') }
}

export default async function PagesAdminPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)

  const { role } = await getSessionWithRole()
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'
  if (!isAdmin) notFound()

  const t = await getTranslations('dashboard.pages.pages')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const pages = await listPages()

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('pages') },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <CreatePageDialog />
      </div>
      <Card className="rounded-xl border border-gray-200">
        <PageList pages={pages} />
      </Card>
    </div>
  )
}
