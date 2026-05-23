import { getLocale, getTranslations } from 'next-intl/server'
import { ErrorPageShell } from '@/features/error-pages'
import { localizedHref } from '@/i18n/localized-href'

export default async function NotFound() {
  const locale = await getLocale()
  const t = await getTranslations('errorPages')

  return (
    <ErrorPageShell
      statusCode="404"
      title={t('404.title')}
      description={t('404.description')}
      actions={[
        {
          href: localizedHref(locale, '/'),
          icon: 'home',
          label: t('actions.goHome'),
          variant: 'default',
        },
      ]}
    />
  )
}
