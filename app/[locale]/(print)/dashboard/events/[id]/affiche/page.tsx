import { buttonVariants } from '@peaklab/ui'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { eventGateway } from '@/gateways/event-gateway'
import { Link } from '@/i18n/routing'
import { getBrandingConfig } from '@/lib/branding'
import { formatEventPosterDate } from '@/lib/date'
import { db } from '@/lib/db'
import { EVENTS_CONFIG_KEY } from '@/lib/events-config'
import { requireSchoolAdmin } from '../../../../../(dashboard)/_lib/auth-helper'
import { restrictedPageMetadata } from '../../../../../(dashboard)/_lib/page-metadata'
import { PrintButton } from '../../../../_components/print-button'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

/**
 * `margin: 0` rend au navigateur la place de ses en-têtes et pieds de page (URL, date) :
 * la feuille dessine elle-même ses marges. Hauteur fixe et `overflow: hidden` sur la
 * feuille garantissent une page A4 unique, quelle que soit la longueur du texte.
 */
const POSTER_PRINT_CSS = `
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff !important; min-height: 0 !important; }
  .poster-sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.events.poster.title')
}

/**
 * Hors du groupe `(dashboard)` : son layout porte la barre latérale et l'en-tête, qu'aucune
 * règle d'impression ne devrait avoir à masquer. L'URL reste sous `/dashboard/events`.
 */
export default async function EventPosterPage({ params }: Props) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)

  const { schoolId } = await requireSchoolAdmin()

  const eventsConfig = await db.config.findFirst({
    where: { schoolId, name: EVENTS_CONFIG_KEY, isActive: true },
    select: { value: true },
  })
  if (eventsConfig?.value !== 'true') notFound()

  const [event, branding] = await Promise.all([
    eventGateway.findById(schoolId, id),
    getBrandingConfig(schoolId),
  ])
  if (!event) notFound()

  const t = await getTranslations('dashboard.pages.events.poster')
  const tCategory = await getTranslations('eventCategory')

  const cover = event.images[0]
  const { logoUrl, schoolName } = branding

  return (
    <>
      <style>{POSTER_PRINT_CSS}</style>
      <div className="flex flex-1 flex-col items-center gap-4 bg-alabaster-900 px-4 py-6 print:block print:bg-white print:p-0">
        <div className="flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-2 print:hidden">
          <Link
            href="/dashboard/events"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>
          <p className="text-xs text-graphite-600">{t('hint')}</p>
          <PrintButton label={t('print')} />
        </div>

        <div className="w-full max-w-full overflow-x-auto print:overflow-visible">
          <article className="poster-sheet relative mx-auto flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-white p-[16mm] text-graphite shadow-lg print:m-0 print:shadow-none">
            {logoUrl && (
              // biome-ignore lint/performance/noImgElement: dynamic logo URL from config
              <img
                src={logoUrl}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 m-auto w-[150mm] max-w-none object-contain opacity-[0.06]"
              />
            )}

            <header className="relative flex items-center gap-[5mm]">
              {logoUrl && (
                // biome-ignore lint/performance/noImgElement: dynamic logo URL from config
                <img src={logoUrl} alt="" className="h-[18mm] w-auto object-contain" />
              )}
              {schoolName && <p className="text-[18pt] font-bold leading-tight">{schoolName}</p>}
            </header>

            {cover && (
              // biome-ignore lint/performance/noImgElement: media route serves arbitrary sizes
              <img
                src={`/api/media/${cover.storageKey}`}
                alt={cover.alt ?? ''}
                className="relative mt-[10mm] h-[105mm] w-full rounded object-cover"
              />
            )}

            <div className="relative mt-[10mm] flex min-h-0 flex-1 flex-col">
              <p className="text-[12pt] font-semibold uppercase tracking-widest text-foreground">
                {tCategory(event.category)}
              </p>
              <h1 className="mt-[3mm] text-balance text-[34pt] font-extrabold leading-[1.1]">
                {event.title}
              </h1>
              {event.status === 'CANCELLED' && (
                <p className="mt-[3mm] text-[16pt] font-bold uppercase text-red-700">
                  {t('cancelled')}
                </p>
              )}
              {event.summary && (
                <p className="mt-[5mm] text-[16pt] leading-snug">{event.summary}</p>
              )}
              {event.description && (
                <p className="mt-[4mm] line-clamp-6 whitespace-pre-line text-[12pt] leading-relaxed text-graphite-600">
                  {event.description}
                </p>
              )}

              <div className="mt-auto space-y-[3mm] border-t-2 border-primary pt-[6mm]">
                <p className="text-[20pt] font-bold leading-tight first-letter:uppercase">
                  {formatEventPosterDate(event, locale)}
                </p>
                {event.location && <p className="text-[16pt] leading-snug">{event.location}</p>}
              </div>
            </div>
          </article>
        </div>
      </div>
    </>
  )
}
