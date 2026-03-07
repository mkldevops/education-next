'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button/button'
import { Link } from '@/i18n/routing'

export default function DashboardErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations('errorPages')

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <p className="text-sm font-medium text-red-600">500</p>
      <h1 className="mt-2 text-3xl font-bold text-gray-900">{t('500.title')}</h1>
      <p className="mt-2 text-center text-gray-600">{t('500.description')}</p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>{t('actions.retry')}</Button>
        <Link href="/dashboard">
          <Button variant="outline">{t('actions.dashboard')}</Button>
        </Link>
      </div>
    </div>
  )
}
