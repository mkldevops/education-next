'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button/button'
import { Link } from '@/i18n/routing'

export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations('errorPages')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <p className="text-sm font-medium text-red-600">500</p>
      <h1 className="mt-2 text-3xl font-bold text-gray-900">{t('500.title')}</h1>
      <p className="mt-2 text-center text-gray-600">{t('500.description')}</p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>{t('actions.retry')}</Button>
        <Link href="/">
          <Button variant="outline">{t('actions.goHome')}</Button>
        </Link>
      </div>
    </div>
  )
}
