import { localizedHref } from '@/i18n/localized-href'
import { routing } from '@/i18n/routing'
import type { Block } from '@/use-cases/pages/schemas'

type Branding = {
  email?: string | null
  phone?: string | null
  address?: string | null
}

export function BlockRenderer({
  blocks,
  branding,
  locale,
}: {
  blocks: Block[]
  branding?: Branding
  locale: string
}) {
  return (
    <>
      {blocks.map((block, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocks have no stable id
        <BlockSwitch key={`${block.type}-${i}`} block={block} branding={branding} locale={locale} />
      ))}
    </>
  )
}

function BlockSwitch({
  block,
  branding,
  locale,
}: {
  block: Block
  branding?: Branding
  locale: string
}) {
  switch (block.type) {
    case 'hero':
      return <HeroBlock block={block} locale={locale} />
    case 'text':
      return <TextBlock block={block} />
    case 'features':
      return <FeaturesBlock block={block} />
    case 'cta':
      return <CtaBlock block={block} locale={locale} />
    case 'stats':
      return <StatsBlock block={block} />
    case 'contact':
      return <ContactBlock block={block} branding={branding} />
  }
}

function localizeBlockHref(locale: string, href: string) {
  if (href.startsWith('#') || href.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(href)) {
    return href
  }

  const alreadyLocalized = routing.locales.some(
    (supportedLocale) =>
      href === `/${supportedLocale}` ||
      href.startsWith(`/${supportedLocale}/`) ||
      href.startsWith(`/${supportedLocale}?`) ||
      href.startsWith(`/${supportedLocale}#`)
  )
  if (alreadyLocalized) return href

  return localizedHref(locale, href)
}

function HeroBlock({ block, locale }: { block: Extract<Block, { type: 'hero' }>; locale: string }) {
  return (
    <section
      className="relative flex min-h-[60vh] flex-col items-center justify-center bg-primary px-6 py-24 text-center text-white"
      style={
        block.backgroundImage
          ? {
              backgroundImage: `url(${block.backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {block.backgroundImage && <div className="absolute inset-0 bg-black/40" aria-hidden="true" />}
      <div className="relative z-10 mx-auto max-w-3xl space-y-6">
        <h1 className="text-4xl font-bold leading-tight md:text-6xl">{block.title}</h1>
        {block.subtitle && <p className="text-lg opacity-90 md:text-xl">{block.subtitle}</p>}
        {block.ctaLabel && block.ctaHref && (
          <a
            href={localizeBlockHref(locale, block.ctaHref)}
            className="inline-block rounded-lg bg-white px-8 py-3 text-base font-semibold text-primary transition-opacity hover:opacity-90"
          >
            {block.ctaLabel}
          </a>
        )}
      </div>
    </section>
  )
}

function TextBlock({ block }: { block: Extract<Block, { type: 'text' }> }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      {block.title && <h2 className="mb-6 text-3xl font-bold text-gray-900">{block.title}</h2>}
      <div className="prose prose-gray max-w-none text-gray-700 whitespace-pre-wrap">
        {block.content}
      </div>
    </section>
  )
}

function FeaturesBlock({ block }: { block: Extract<Block, { type: 'features' }> }) {
  return (
    <section className="bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {block.title && (
          <h2 className="mb-10 text-center text-3xl font-bold text-gray-900">{block.title}</h2>
        )}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {block.items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            <div key={i} className="rounded-xl bg-white p-6 shadow-sm">
              {item.icon && <div className="mb-4 text-3xl">{item.icon}</div>}
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{item.title}</h3>
              <p className="text-sm text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaBlock({ block, locale }: { block: Extract<Block, { type: 'cta' }>; locale: string }) {
  return (
    <section className="bg-primary px-6 py-16 text-center text-white">
      <div className="mx-auto max-w-2xl space-y-6">
        <h2 className="text-3xl font-bold">{block.title}</h2>
        {block.subtitle && <p className="text-lg opacity-90">{block.subtitle}</p>}
        <a
          href={localizeBlockHref(locale, block.ctaHref)}
          className="inline-block rounded-lg bg-white px-8 py-3 text-base font-semibold text-primary transition-opacity hover:opacity-90"
        >
          {block.ctaLabel}
        </a>
      </div>
    </section>
  )
}

function StatsBlock({ block }: { block: Extract<Block, { type: 'stats' }> }) {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {block.title && (
          <h2 className="mb-10 text-center text-3xl font-bold text-gray-900">{block.title}</h2>
        )}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {block.items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            <div key={i} className="text-center">
              <p className="text-4xl font-bold text-primary">{item.value}</p>
              <p className="mt-2 text-sm text-gray-600">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ContactBlock({
  block,
  branding,
}: {
  block: Extract<Block, { type: 'contact' }>
  branding?: Branding
}) {
  const hasContact =
    (block.showEmail && branding?.email) ||
    (block.showPhone && branding?.phone) ||
    (block.showAddress && branding?.address)

  if (!hasContact) return null

  return (
    <section className="bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        {block.title && <h2 className="mb-8 text-3xl font-bold text-gray-900">{block.title}</h2>}
        <div className="space-y-3 text-gray-700">
          {block.showPhone && branding?.phone && (
            <p>
              <a href={`tel:${branding.phone}`} className="hover:text-primary">
                {branding.phone}
              </a>
            </p>
          )}
          {block.showEmail && branding?.email && (
            <p>
              <a href={`mailto:${branding.email}`} className="hover:text-primary">
                {branding.email}
              </a>
            </p>
          )}
          {block.showAddress && branding?.address && <p>{branding.address}</p>}
        </div>
      </div>
    </section>
  )
}
