import { getLocale, getTranslations } from 'next-intl/server'
import { ErrorPageShell } from '@/features/error-pages'
import { localizedHref } from '@/i18n/localized-href'

export default async function DashboardUnauthorized() {
  const locale = await getLocale()
  const t = await getTranslations('errorPages')

  return (
    <ErrorPageShell
      statusCode="401"
      title={t('401.title')}
      description={t('401.description')}
      minHeight="content"
      actions={[
        {
          href: localizedHref(locale, '/login'),
          icon: 'login',
          label: t('actions.login'),
          variant: 'default',
        },
      ]}
    />
  )
}
