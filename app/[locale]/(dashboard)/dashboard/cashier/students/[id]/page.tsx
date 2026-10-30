import { Breadcrumbs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { resolveDebtorFamily } from '@/domain/family-debtor'
import { getSelectedPeriodId } from '@/features/dashboard/period'
import { Link } from '@/i18n/routing'
import { db } from '@/lib/db'
import { requireSchoolCashier } from '../../../../_lib/auth-helper'
import { cashierPageMetadata } from '../../../../_lib/page-metadata'
import { MealPanel } from '../../../students/[id]/_components/meal-panel'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return cashierPageMetadata(locale, 'dashboard.pages.cashier.studentSheet.title')
}

/**
 * Fiche repas d'un élève vue depuis la caisse : inscrire, changer les jours, arrêter, marquer
 * une absence. Ni la fiche élève, ni la famille, ni la reprise, réservées à l'administration.
 */
export default async function CashierStudentPage({ params }: Props) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.cashier')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { schoolId, isAdmin } = await requireSchoolCashier()
  if (!UUID.test(id)) notFound()

  const student = await db.student.findFirst({
    where: { id, schoolId, isActive: true },
    select: {
      id: true,
      person: {
        select: {
          name: true,
          lastname: true,
          families: { select: { familyId: true, relationType: true } },
        },
      },
    },
  })
  if (!student) notFound()

  const name = `${student.person.name} ${student.person.lastname}`
  const familyId = resolveDebtorFamily(student.person.families)?.familyId ?? null
  const selectedPeriodId = await getSelectedPeriodId(schoolId)

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('cashier'), href: '/dashboard/cashier' },
          { label: name },
        ]}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-graphite">{name}</h1>
        {familyId && (
          <Link
            href={`/dashboard/cashier?familyId=${familyId}`}
            className="text-sm text-foreground hover:underline"
          >
            {t('studentSheet.collect')}
          </Link>
        )}
      </div>
      <div className="max-w-xl">
        <MealPanel
          schoolId={schoolId}
          studentId={student.id}
          locale={locale}
          selectedPeriodId={selectedPeriodId}
          canRecordOpening={isAdmin}
        />
      </div>
    </div>
  )
}
