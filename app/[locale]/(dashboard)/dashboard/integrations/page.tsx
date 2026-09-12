import { Breadcrumbs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { isMcpEnabled } from '@/use-cases/platform-settings/is-mcp-enabled'
import { requirePlatformAdmin } from '../../_lib/auth-helper'
import { platformPageMetadata } from '../../_lib/page-metadata'
import { IntegrationsForm } from './_components/integrations-form'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return platformPageMetadata(locale, 'dashboard.pages.integrations.title')
}

export default async function IntegrationsPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.integrations')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  await requirePlatformAdmin()

  const mcpEnabled = await isMcpEnabled()

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('integrations') },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
        <p className="mt-1 text-sm text-graphite-600">{t('description')}</p>
      </div>

      <IntegrationsForm mcpEnabled={mcpEnabled} />
    </div>
  )
}
