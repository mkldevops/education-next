import { buttonVariants } from '@peaklab/ui'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { getBrandingConfig } from '@/lib/branding'
import { formatDate } from '@/lib/date'
import { db } from '@/lib/db'
import { requireSchoolStaff } from '../../../../../(dashboard)/_lib/auth-helper'
import { restrictedPageMetadata } from '../../../../../(dashboard)/_lib/page-metadata'
import { ROSTER_STATUSES } from '../../../../../(dashboard)/dashboard/classes/_lib/roster'
import { PrintButton } from '../../../../_components/print-button'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

/**
 * Contrairement à l'affiche, la liste peut déborder sur plusieurs pages : la hauteur reste libre
 * et le navigateur répète l'en-tête du tableau sur chaque feuille.
 */
const ROSTER_PRINT_CSS = `
@page { size: A4; margin: 12mm; }
@media print {
  html, body { background: #fff !important; min-height: 0 !important; }
  .roster-sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .roster-sheet tr { break-inside: avoid; }
}
`

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.classDetails.printList.title')
}

export default async function ClassRosterPrintPage({ params }: Props) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)

  const { schoolId } = await requireSchoolStaff()

  const [classPeriod, branding] = await Promise.all([
    db.classPeriod.findFirst({
      where: { id, schoolId },
      select: {
        name: true,
        level: { select: { name: true } },
        period: { select: { name: true } },
        teachers: {
          where: { teacher: { isActive: true } },
          select: { teacher: { select: { id: true, firstName: true, lastName: true } } },
        },
        classAssignments: {
          where: { endAt: null, enrollment: { status: { in: [...ROSTER_STATUSES] } } },
          select: {
            id: true,
            enrollment: {
              select: {
                student: {
                  select: {
                    birthday: true,
                    person: { select: { name: true, lastname: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    getBrandingConfig(schoolId),
  ])
  if (!classPeriod) notFound()

  const t = await getTranslations('dashboard.pages.classDetails.printList')

  const roster = classPeriod.classAssignments
    .map((assignment) => ({
      id: assignment.id,
      lastname: assignment.enrollment.student.person.lastname,
      firstname: assignment.enrollment.student.person.name,
      birthday: assignment.enrollment.student.birthday,
    }))
    .sort(
      (a, b) =>
        a.lastname.localeCompare(b.lastname, locale) ||
        a.firstname.localeCompare(b.firstname, locale)
    )
  const teachers = classPeriod.teachers
    .map(({ teacher }) => `${teacher.lastName} ${teacher.firstName}`.trim())
    .join(', ')
  const { logoUrl, schoolName } = branding

  return (
    <>
      <style>{ROSTER_PRINT_CSS}</style>
      <div className="flex flex-1 flex-col items-center gap-4 bg-alabaster-900 px-4 py-6 print:block print:bg-white print:p-0">
        <div className="flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-2 print:hidden">
          <Link
            href={`/dashboard/classes/${id}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>
          <p className="text-xs text-graphite-600">{t('hint')}</p>
          <PrintButton label={t('print')} />
        </div>

        <div className="w-full max-w-full overflow-x-auto print:overflow-visible">
          <article className="roster-sheet mx-auto min-h-[297mm] w-[210mm] bg-white p-[12mm] text-graphite shadow-lg print:min-h-0 print:w-auto print:p-0 print:shadow-none">
            <header className="flex items-start justify-between gap-[6mm] border-b-2 border-primary pb-[5mm]">
              <div className="flex items-center gap-[4mm]">
                {logoUrl && (
                  // biome-ignore lint/performance/noImgElement: dynamic logo URL from config
                  <img src={logoUrl} alt="" className="h-[14mm] w-auto object-contain" />
                )}
                <div>
                  {schoolName && <p className="text-[10pt] text-graphite-600">{schoolName}</p>}
                  <h1 className="text-[18pt] font-bold leading-tight">{classPeriod.name}</h1>
                  <p className="text-[10pt] text-graphite-600">
                    {classPeriod.level.name} · {classPeriod.period.name}
                  </p>
                </div>
              </div>
              <dl className="shrink-0 text-right text-[9pt] leading-relaxed">
                <div>
                  <dt className="inline text-graphite-600">{t('headcount')} : </dt>
                  <dd className="inline font-semibold tabular-nums">{roster.length}</dd>
                </div>
                {teachers && (
                  <div>
                    <dt className="inline text-graphite-600">{t('teachers')} : </dt>
                    <dd className="inline">{teachers}</dd>
                  </div>
                )}
                <div>
                  <dt className="inline text-graphite-600">{t('printedOn')} : </dt>
                  <dd className="inline tabular-nums">{formatDate(new Date(), locale)}</dd>
                </div>
              </dl>
            </header>

            {roster.length === 0 ? (
              <p className="mt-[8mm] text-[11pt] text-graphite-600">{t('empty')}</p>
            ) : (
              <table className="mt-[6mm] w-full border-collapse text-left text-[10pt]">
                <thead>
                  <tr className="border-b border-graphite-800 text-[8pt] uppercase tracking-wide text-graphite-600">
                    <th className="w-[10mm] py-[2mm] pr-[2mm] text-right font-medium">#</th>
                    <th className="py-[2mm] pl-[3mm] font-medium">{t('lastname')}</th>
                    <th className="py-[2mm] font-medium">{t('firstname')}</th>
                    <th className="w-[30mm] py-[2mm] font-medium">{t('birthday')}</th>
                    <th className="w-[55mm] py-[2mm] font-medium">{t('notes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((row, index) => (
                    <tr key={row.id} className="border-b border-alabaster-700">
                      <td className="py-[2.5mm] pr-[2mm] text-right text-graphite-600 tabular-nums">
                        {index + 1}
                      </td>
                      <td className="py-[2.5mm] pl-[3mm] font-semibold uppercase">
                        {row.lastname}
                      </td>
                      <td className="py-[2.5mm]">{row.firstname}</td>
                      <td className="py-[2.5mm] tabular-nums">
                        {row.birthday ? formatDate(row.birthday, locale) : '—'}
                      </td>
                      <td className="py-[2.5mm]" />
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        </div>
      </div>
    </>
  )
}
