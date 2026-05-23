'use client'

import { useLocale, useTranslations } from 'next-intl'
import { ErrorPageShell } from '@/features/error-pages'
import { localizedHref } from '@/i18n/localized-href'

export default function DashboardErrorPage({ reset }: { reset: () => void }) {
  const locale = useLocale()
  const t = useTranslations('errorPages')

  return (
    <ErrorPageShell
      statusCode="500"
      title={t('500.title')}
      description={t('500.description')}
      minHeight="content"
      onRetry={reset}
      retryLabel={t('actions.retry')}
      actions={[
        {
          href: localizedHref(locale, '/dashboard'),
          icon: 'dashboard',
          label: t('actions.dashboard'),
        },
      ]}
    />
  )
}
