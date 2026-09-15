import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { LoginForm } from '@/features/auth'
import { redirect } from '@/i18n/routing'
import { getBrandingConfig, resolveBrandingSchoolId } from '@/lib/branding'
import { getSchoolContext } from '@/lib/school-context'
import { isGoogleSignInAvailable } from '@/use-cases/platform-settings/is-google-sign-in-available'
import { isPasskeySignInEnabled } from '@/use-cases/platform-settings/is-passkey-sign-in-enabled'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.login' })

  return {
    title: t('title'),
    description: t('subtitle'),
  }
}

export default async function LoginPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)

  const context = await getSchoolContext()
  if (context) {
    redirect({ href: '/dashboard', locale })
  }

  // Sans session, l'école vient du cookie posé par le dashboard : celle de la dernière visite.
  const brandingSchoolId = await resolveBrandingSchoolId()
  const [t, googleEnabled, passkeyEnabled, branding] = await Promise.all([
    getTranslations('auth.login'),
    isGoogleSignInAvailable(),
    isPasskeySignInEnabled(),
    brandingSchoolId ? getBrandingConfig(brandingSchoolId) : null,
  ])

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded bg-white shadow-lg">
          <div className="bg-[var(--color-primary)] px-8 py-6 text-center">
            {branding?.logoUrl && (
              // biome-ignore lint/performance/noImgElement: config URLs are dynamic
              <img
                src={branding.logoUrl}
                alt={branding.schoolName}
                className="mx-auto mb-4 h-16 w-auto max-w-full rounded bg-white object-contain p-2"
              />
            )}
            <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
            <p className="mt-1 text-sm text-white/80">{t('subtitle')}</p>
          </div>
          <div className="px-8 py-8">
            <LoginForm googleEnabled={googleEnabled} passkeyEnabled={passkeyEnabled} />
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-graphite-600">{t('contactAdmin')}</p>
      </div>
    </div>
  )
}
