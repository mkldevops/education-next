import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Inter } from 'next/font/google'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { UmamiScript } from '@/components/umami-script'
import { ServiceWorkerRegister } from '@/features/pwa/service-worker-register'
import { type Locale, routing } from '@/i18n/routing'
import { getBrandingConfig, resolveBrandingSchoolId } from '@/lib/branding'
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
  const schoolId = await resolveBrandingSchoolId()
  const schoolName = schoolId ? (await getBrandingConfig(schoolId)).schoolName : undefined

  return {
    title: schoolName ? t('title', { schoolName }) : t('platformTitle'),
    description: t('description'),
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        fr: '/fr',
        en: '/en',
      },
    },
    manifest: '/manifest.webmanifest',
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
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider configs={themeConfigs} />
          <ServiceWorkerRegister />
          {children}
          <Toaster richColors position="top-right" />
        </NextIntlClientProvider>
        <UmamiScript />
      </body>
    </html>
  )
}
