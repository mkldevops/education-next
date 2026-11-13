'use client'

import * as Sentry from '@sentry/nextjs'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { ErrorPageShell } from '@/features/error-pages'
import { localizedHref } from '@/i18n/localized-href'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  const locale = useLocale()
  const t = useTranslations('errorPages')

  return (
    <ErrorPageShell
      statusCode="500"
      title={t('500.title')}
      description={t('500.description')}
      onRetry={reset}
      retryLabel={t('actions.retry')}
      actions={[
        {
          href: localizedHref(locale, '/'),
          icon: 'home',
          label: t('actions.goHome'),
        },
      ]}
    />
  )
}
