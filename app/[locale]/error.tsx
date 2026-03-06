'use client'

import { Button } from '@peaklab/ui'
import { useTranslations } from 'next-intl'

export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations('common')
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-gray-900">{t('error')}</h1>
      <Button onClick={reset} className="mt-6">
        {t('retry')}
      </Button>
    </div>
  )
}
