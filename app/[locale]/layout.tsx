import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Inter } from 'next/font/google'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { UmamiScript } from '@/components/umami-script'
import { captureInstallPromptScript } from '@/features/pwa/install-prompt'
import { ServiceWorkerRegister } from '@/features/pwa/service-worker-register'
import { type Locale, routing } from '@/i18n/routing'
import { resolveBrandingSchoolId } from '@/lib/branding'
import { getBrandingAssets } from '@/lib/branding-assets'
import { ErrorTrackingScript } from '@/lib/error-tracking/error-tracking-script'
import { getPwaBranding } from '@/lib/pwa-branding'
import { getThemeConfigs } from '@/lib/theme-configs'
import '@/styles/globals.css'

// Branchées sur `--font-sans` et `--font-mono` par `globals.css`. `latin-ext` couvre les noms
// de familles accentués au-delà du français.
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
})

const geistMono = Geist_Mono({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-geist-mono',
  preload: false,
})

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateViewport(): Promise<Viewport> {
  const { themeColor } = await getPwaBranding()
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    interactiveWidget: 'resizes-content',
    themeColor,
  }
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Le titre par défaut suit l'école affichée. Il ne retombe jamais sur `company`,
  // qui décrit l'exploitant de la plateforme et non un locataire.
  const t = await getTranslations({ locale, namespace: 'metadata' })
  const { schoolName, logoUrl } = await getPwaBranding()
  const appleIcon = getBrandingAssets(logoUrl)?.find((asset) => asset.purpose === 'apple')

  return {
    title: schoolName ? t('title', { schoolName }) : t('platformTitle'),
    description: t('description'),
    applicationName: schoolName || t('platformTitle'),
    appleWebApp: {
      capable: true,
      title: schoolName || t('platformTitle'),
      statusBarStyle: 'default',
    },
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        fr: '/fr',
        en: '/en',
      },
    },
    ...(appleIcon
      ? {
          icons: {
            icon: [{ url: '/icon', sizes: '32x32', type: 'image/png' }],
            apple: [{ url: appleIcon.src, sizes: '180x180', type: 'image/png' }],
          },
        }
      : {}),
  }
}

export default async function LocaleLayout({ children, params }: Props) {
  await connection()
  const { locale } = await params

  if (!routing.locales.includes(locale as Locale)) {
    notFound()
  }

  setRequestLocale(locale)

  const schoolId = await resolveBrandingSchoolId()

  const [messages, themeConfigs] = await Promise.all([
    getMessages(),
    schoolId ? getThemeConfigs(schoolId) : Promise.resolve([]),
  ])

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${geistMono.variable}`}
    >
      <head>
        {/* The school's manifest depends on the session and active-school cookies. */}
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
        <script dangerouslySetInnerHTML={{ __html: captureInstallPromptScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider configs={themeConfigs} />
          <ServiceWorkerRegister />
          {children}
          <Toaster richColors position="top-right" />
        </NextIntlClientProvider>
        <UmamiScript />
        <ErrorTrackingScript />
      </body>
    </html>
  )
}
