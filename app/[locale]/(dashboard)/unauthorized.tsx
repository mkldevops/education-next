import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button/button'
import { Link } from '@/i18n/routing'

export default async function DashboardUnauthorized() {
  const t = await getTranslations('errorPages')

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <p className="text-sm font-medium text-yellow-600">401</p>
      <h1 className="mt-2 text-3xl font-bold text-gray-900">{t('401.title')}</h1>
      <p className="mt-2 text-center text-gray-600">{t('401.description')}</p>
      <Link href="/auth/login" className="mt-6">
        <Button>{t('actions.login')}</Button>
      </Link>
    </div>
  )
}
