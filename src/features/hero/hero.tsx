import { Button } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'

export async function Hero() {
  const t = await getTranslations('hero')

  return (
    <section className="relative overflow-hidden bg-white">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-primary-light opacity-50 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-primary-light opacity-30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="display-xl text-balance text-gray-900">{t('title')}</h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">{t('subtitle')}</p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg">{t('cta')}</Button>
            </Link>
            <Link href="/a-propos">
              <Button variant="outline" size="lg">
                {t('secondary')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
