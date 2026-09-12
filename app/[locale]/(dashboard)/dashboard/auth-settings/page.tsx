import { Breadcrumbs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { isGoogleConfigured } from '@/lib/social-providers'
import { isGoogleSignInEnabled } from '@/use-cases/platform-settings/is-google-sign-in-enabled'
import { isPasskeySignInEnabled } from '@/use-cases/platform-settings/is-passkey-sign-in-enabled'
import { countGoogleOnlyAccounts } from '@/use-cases/users/count-google-only-accounts'
import { requirePlatformAdmin } from '../../_lib/auth-helper'
import { platformPageMetadata } from '../../_lib/page-metadata'
import { AuthSettingsForm } from './_components/auth-settings-form'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return platformPageMetadata(locale, 'dashboard.pages.authSettings.title')
}

export default async function AuthSettingsPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.authSettings')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  await requirePlatformAdmin()

  const [googleEnabled, passkeyEnabled, googleOnlyAccountCount] = await Promise.all([
    isGoogleSignInEnabled(),
    isPasskeySignInEnabled(),
    countGoogleOnlyAccounts(),
  ])

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('authSettings') },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
        <p className="mt-1 text-sm text-graphite-600">{t('description')}</p>
      </div>

      <AuthSettingsForm
        googleEnabled={googleEnabled}
        googleConfigured={isGoogleConfigured}
        passkeyEnabled={passkeyEnabled}
        googleOnlyAccountCount={googleOnlyAccountCount}
      />
    </div>
  )
}
