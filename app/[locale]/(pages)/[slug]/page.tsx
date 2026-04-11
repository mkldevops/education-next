import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { BlockRenderer } from '@/features/landing/block-renderer'
import { getBrandingContacts } from '@/lib/get-branding-contacts'
import { parseBlocks } from '@/lib/parse-blocks'
import { getPageBySlug } from '@/use-cases/pages/get-page'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getPageBySlug(slug)
  if (!page?.published) return {}
  return { title: page.title }
}

export default async function PublicPage({ params }: Props) {
  await connection()
  const { locale, slug } = await params
  setRequestLocale(locale)

  const [page, branding] = await Promise.all([getPageBySlug(slug), getBrandingContacts()])

  if (!page?.published) notFound()

  return <BlockRenderer blocks={parseBlocks(page.blocks)} branding={branding} />
}
