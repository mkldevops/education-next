import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { ServiceWorkerRegister } from '@/features/pwa/service-worker-register'
import { type Locale, routing } from '@/i18n/routing'
import { db } from '@/lib/db'
import '@/styles/globals.css'

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

  return {
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

  const [messages, themeConfigs] = await Promise.all([
    getMessages(),
    db.config.findMany({
      where: {
        name: {
          in: ['theme_primary', 'theme_primary_hover', 'theme_primary_light', 'theme_background'],
        },
        isActive: true,
      },
      select: { name: true, value: true },
    }),
  ])

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider configs={themeConfigs} />
          <ServiceWorkerRegister />
          {children}
          <Toaster richColors position="top-right" />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
