import { getTranslations } from 'next-intl/server'
import { EnrollmentStatusBadge } from '@/features/enums'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { calculateFamilyBalance } from '@/use-cases/payments/family-balance'
import type { FamilyDetailStudent } from '../_lib/family-detail'

type Props = {
  students: FamilyDetailStudent[]
  locale: string
  currency: string
  /** Faux quand l'école a désactivé les paiements : aucun solde n'est affiché. */
  paymentsEnabled: boolean
}

/**
 * Liste compacte des enfants de l'onglet Résumé. L'inscription montrée est la plus récente
 * (les inscriptions arrivent triées par `registeredAt` décroissant) ; le solde reprend la règle
 * de `calculateFamilyBalance` restreinte aux inscriptions de l'enfant.
 */
export async function ChildrenSummary({ students, locale, currency, paymentsEnabled }: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  if (students.length === 0) {
    return <p className="py-8 text-center text-sm text-graphite-600">{t('sections.noChildren')}</p>
  }

  return (
    <ul className="divide-y divide-alabaster-700">
      {students.map(({ person }) => {
        const enrollments = person.student.enrollments
        const current = enrollments[0]
        const className = current?.classAssignments[0]?.classPeriod.name
        const balance = calculateFamilyBalance(enrollments).remainingBalance

        return (
          <li key={person.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <Link
                href={`/dashboard/students/${person.student.id}`}
                className="text-sm font-medium text-primary hover:text-primary-hover hover:underline"
              >
                {person.name}
              </Link>
              <p className="truncate text-xs text-graphite-600">
                {className ?? t('childCard.noClass')}
              </p>
            </div>
            {current ? (
              <EnrollmentStatusBadge status={current.status} />
            ) : (
              <span className="text-xs text-graphite-600">{t('childCard.noEnrollments')}</span>
            )}
            {paymentsEnabled && (
              <span
                className={
                  balance > 0
                    ? 'w-24 shrink-0 text-right text-xs font-medium text-amber-600'
                    : 'w-24 shrink-0 text-right text-xs text-graphite-600'
                }
              >
                {balance > 0
                  ? t('childCard.remaining', { amount: formatCurrency(balance, locale, currency) })
                  : t('childCard.settled')}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
