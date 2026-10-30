import { CalendarDays, Eye, MapPin } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ThemeProvider } from '@/components/theme-provider'
import { eventPublicPath } from '@/domain/event'
import { Link } from '@/i18n/routing'
import { getBrandingConfig } from '@/lib/branding'
import { formatEventPosterDate } from '@/lib/date'
import { getThemeConfigs } from '@/lib/theme-configs'
import { resolvePublicEvent } from './_lib/resolve-public-event'

type Props = {
  params: Promise<{ locale: string; slug: string; eventSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug, eventSlug } = await params
  const resolved = await resolvePublicEvent(slug, eventSlug)

  if (!resolved) {
    const t = await getTranslations({ locale, namespace: 'errorPages.404' })
    return { title: t('title'), robots: { index: false } }
  }

  const { event, access, schoolId } = resolved
  const { schoolName } = await getBrandingConfig(schoolId)
  const title = schoolName ? `${event.title} · ${schoolName}` : event.title

  // Un aperçu n'est vu que par un administrateur connecté : rien à indexer ni à partager.
  if (access === 'preview') return { title, robots: { index: false, follow: false } }

  const cover = event.images[0]
  const path = `/${locale}${eventPublicPath(slug, event.slug)}`

  return {
    title,
    description: event.summary ?? undefined,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title,
      description: event.summary ?? undefined,
      siteName: schoolName,
      locale,
      images: cover
        ? [{ url: `/api/media/${cover.storageKey}`, alt: cover.alt ?? event.title }]
        : undefined,
    },
  }
}

export default async function PublicEventPage({ params }: Props) {
  await connection()
  const { locale, slug, eventSlug } = await params
  setRequestLocale(locale)

  const resolved = await resolvePublicEvent(slug, eventSlug)
  if (!resolved) notFound()

  const { event, access, schoolId } = resolved
  const [branding, themeConfigs, t, tCategory, tStatus, tVisibility] = await Promise.all([
    getBrandingConfig(schoolId),
    getThemeConfigs(schoolId),
    getTranslations('publicEvent'),
    getTranslations('eventCategory'),
    getTranslations('eventStatus'),
    getTranslations('eventVisibility'),
  ])

  const [cover, ...gallery] = event.images
  const isCancelled = event.status === 'CANCELLED'

  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* Le layout habille la page avec l'école du visiteur (souvent aucune) : celle de
          l'événement prime ici, déclarée après et donc gagnante sur `:root`. */}
      <ThemeProvider configs={themeConfigs} />

      {access === 'preview' && (
        <div
          role="status"
          className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2">
              <Eye className="h-4 w-4 shrink-0" />
              <span>
                <strong>{t('preview.title')}</strong>{' '}
                {t('preview.description', {
                  status: tStatus(event.status),
                  visibility: tVisibility(event.visibility),
                })}
              </span>
            </p>
            <Link href="/dashboard/events" className="font-medium underline underline-offset-2">
              {t('preview.back')}
            </Link>
          </div>
        </div>
      )}

      <header className="border-b border-alabaster-700 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {branding.logoUrl && (
            // biome-ignore lint/performance/noImgElement: dynamic logo URL from config
            <img src={branding.logoUrl} alt="" className="h-10 w-auto object-contain" />
          )}
          {branding.schoolName && (
            <p className="text-base font-semibold text-graphite">{branding.schoolName}</p>
          )}
        </div>
      </header>

      <main className="px-4 py-8">
        <article className="mx-auto max-w-3xl overflow-hidden rounded border border-alabaster-700 bg-white shadow-sm">
          {cover && (
            <Image
              src={`/api/media/${cover.storageKey}`}
              alt={cover.alt ?? ''}
              width={1200}
              height={630}
              sizes="(min-width: 768px) 768px, 100vw"
              priority
              className={`aspect-[1200/630] w-full object-cover ${isCancelled ? 'grayscale' : ''}`}
            />
          )}

          <div className="space-y-6 p-6 sm:p-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
                {tCategory(event.category)}
              </p>
              <h1
                className={`text-balance text-3xl font-extrabold leading-tight text-graphite ${
                  isCancelled ? 'line-through opacity-60' : ''
                }`}
              >
                {event.title}
              </h1>
              {isCancelled && (
                <p className="inline-block rounded bg-red-50 px-2 py-1 text-sm font-bold uppercase text-red-700">
                  {t('cancelled')}
                </p>
              )}
            </div>

            <dl className="grid gap-3 border-y border-alabaster-700 py-4 text-graphite sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <dt>
                  <CalendarDays className="mt-0.5 h-4 w-4 text-foreground" />
                  <span className="sr-only">{t('date')}</span>
                </dt>
                <dd className="font-medium first-letter:uppercase">
                  {formatEventPosterDate(event, locale)}
                </dd>
              </div>
              {event.location && (
                <div className="flex items-start gap-2">
                  <dt>
                    <MapPin className="mt-0.5 h-4 w-4 text-foreground" />
                    <span className="sr-only">{t('location')}</span>
                  </dt>
                  <dd>{event.location}</dd>
                </div>
              )}
            </dl>

            {event.summary && <p className="text-lg leading-snug text-graphite">{event.summary}</p>}
            {event.description && (
              <p className="whitespace-pre-line leading-relaxed text-graphite-600">
                {event.description}
              </p>
            )}

            {gallery.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-graphite">{t('gallery')}</h2>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {gallery.map((image) => (
                    <li key={image.id}>
                      <Image
                        src={`/api/media/${image.storageKey}`}
                        alt={image.alt ?? ''}
                        width={400}
                        height={300}
                        sizes="(min-width: 640px) 240px, 50vw"
                        className="aspect-[4/3] w-full rounded border border-alabaster-700 object-cover"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </article>
      </main>
    </div>
  )
}
