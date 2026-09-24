import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { LoginForm } from '@/features/auth'
import { AuthHeading } from '@/features/auth/auth-heading'
import { safeRedirectPath } from '@/features/auth/safe-redirect'
import { redirect } from '@/i18n/routing'
import { getBrandingConfig, resolveBrandingSchoolId } from '@/lib/branding'
import { getSchoolContext } from '@/lib/school-context'
import { isGoogleSignInAvailable } from '@/use-cases/platform-settings/is-google-sign-in-available'
import { isPasskeySignInEnabled } from '@/use-cases/platform-settings/is-passkey-sign-in-enabled'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ redirectTo?: string | string[] }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.login' })

  return {
    title: t('title'),
    description: t('subtitle'),
  }
}

export default async function LoginPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)

  // Seul un chemin interne survit : tout le reste retombe sur le dashboard.
  const redirectTo = safeRedirectPath((await searchParams).redirectTo)

  const context = await getSchoolContext()
  if (context) {
    redirect({ href: redirectTo, locale })
  }

  const brandingSchoolId = await resolveBrandingSchoolId()
  const [t, googleEnabled, passkeyEnabled, branding] = await Promise.all([
    getTranslations('auth.login'),
    isGoogleSignInAvailable(),
    isPasskeySignInEnabled(),
    brandingSchoolId ? getBrandingConfig(brandingSchoolId) : null,
  ])

  return (
    <div className="space-y-8">
      <AuthHeading
        title={t('title')}
        description={
          branding?.schoolName
            ? t('subtitleSchool', { schoolName: branding.schoolName })
            : t('subtitle')
        }
      />

      <LoginForm
        googleEnabled={googleEnabled}
        passkeyEnabled={passkeyEnabled}
        redirectTo={redirectTo}
      />

      <p className="border-t border-border pt-6 text-sm leading-6 text-muted-foreground">
        <span className="font-medium text-foreground">{t('noAccount')}</span> {t('contactAdmin')}
      </p>
    </div>
  )
}
