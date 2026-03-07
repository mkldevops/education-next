import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button/button'
import { Link } from '@/i18n/routing'

export default async function DashboardNotFound() {
  const t = await getTranslations('errorPages')

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <p className="text-sm font-medium text-gray-500">404</p>
      <h1 className="mt-2 text-3xl font-bold text-gray-900">{t('404.title')}</h1>
      <p className="mt-2 text-center text-gray-600">{t('404.description')}</p>
      <Link href="/dashboard" className="mt-6">
        <Button>{t('actions.dashboard')}</Button>
      </Link>
    </div>
  )
}
