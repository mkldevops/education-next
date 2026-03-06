import { Button } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'

export default async function NotFound() {
  const t = await getTranslations('common')
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="mt-2 text-gray-600">{t('error')}</p>
      <Link href="/" className="mt-6">
        <Button>{t('back')}</Button>
      </Link>
    </div>
  )
}
