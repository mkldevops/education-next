import { Breadcrumbs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPage } from '@/use-cases/pages/get-page'
import { getSessionWithRole } from '../../../_lib/auth-helper'
import { EditPageForm } from '../_components/edit-page-form'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const page = await getPage(id)
  if (!page) return {}
  return { title: page.title }
}

export default async function EditPagePage({ params }: Props) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)

  const { role } = await getSessionWithRole()
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'
  if (!isAdmin) notFound()

  const page = await getPage(id)
  if (!page) notFound()

  const t = await getTranslations('dashboard.pages.pages')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('pages'), href: '/dashboard/pages' },
          { label: page.title },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('edit.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">"{page.title}"</p>
      </div>
      <EditPageForm page={page} />
    </div>
  )
}
