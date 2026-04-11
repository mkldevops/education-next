import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { Hero } from '@/features/hero'
import { BlockRenderer } from '@/features/landing/block-renderer'
import { getBrandingContacts } from '@/lib/get-branding-contacts'
import { parseBlocks } from '@/lib/parse-blocks'
import { getHomePage } from '@/use-cases/pages/get-page'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)

  const [homePage, branding] = await Promise.all([getHomePage(), getBrandingContacts()])

  if (!homePage?.published) {
    return <Hero />
  }

  return <BlockRenderer blocks={parseBlocks(homePage.blocks)} branding={branding} />
}
