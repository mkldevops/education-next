import { getLocale, getTranslations } from 'next-intl/server'
import { ErrorPageShell } from '@/features/error-pages'
import { localizedHref } from '@/i18n/localized-href'

export default async function DashboardForbidden() {
  const locale = await getLocale()
  const t = await getTranslations('errorPages')

  return (
    <ErrorPageShell
      statusCode="403"
      title={t('403.title')}
      description={t('403.description')}
      minHeight="content"
      actions={[
        {
          href: localizedHref(locale, '/dashboard'),
          icon: 'dashboard',
          label: t('actions.dashboard'),
          variant: 'default',
        },
      ]}
    />
  )
}
