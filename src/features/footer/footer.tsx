import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'

export async function Footer() {
  const t = await getTranslations('footer')
  const company = await getTranslations('company')
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="col-span-1">
            <Link href="/" className="text-xl font-bold text-primary">
              {company('name')}
            </Link>
            <p className="mt-4 max-w-md text-sm text-gray-600">{t('tagline')}</p>
          </div>

          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-gray-900">Legal</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/privacy-policy" className="text-sm text-gray-600 hover:text-primary">
                  {t('privacy')}
                </Link>
              </li>
              <li>
                <Link href="/legal-notices" className="text-sm text-gray-600 hover:text-primary">
                  {t('legal')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-8">
          <p className="text-center text-sm text-gray-500">
            &copy; {currentYear} {company('name')}. {t('copyright')}
          </p>
        </div>
      </div>
    </footer>
  )
}
