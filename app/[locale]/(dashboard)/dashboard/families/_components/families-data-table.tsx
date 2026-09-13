'use client'

import { CircleProgress, RichDataTable, useMenu } from '@peaklab/ui'
import type { ColumnDef } from '@tanstack/react-table'
import { Phone } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { PaymentMethodLabel } from '@/features/enums'
import { useTableLabels } from '@/features/tables'
import type { PaymentMethod } from '@/generated/prisma/client'
import { Link } from '@/i18n/routing'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/decimal'

export type FamilyPaymentRow = {
  amount: number
  method: PaymentMethod
  paidAt: Date
  cashedAt: Date | null
}

export type FamilyRow = {
  id: string
  name: string
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  studentCount: number
  enrollmentCount: number
  due: number
  paid: number
  remaining: number
  payments: FamilyPaymentRow[]
  paymentCount: number
}

type Props = {
  data: FamilyRow[]
}

function EmergencyContactCell({ family }: { family: FamilyRow }) {
  const t = useTranslations('dashboard.pages.families')

  if (!family.emergencyContactName && !family.emergencyContactPhone) {
    return <span className="text-graphite-600">{t('noEmergencyContact')}</span>
  }

  const phone = family.emergencyContactPhone

  return (
    <div className="flex max-w-64 flex-col gap-0.5">
      {family.emergencyContactName && (
        <span className="line-clamp-2 text-graphite" title={family.emergencyContactName}>
          {family.emergencyContactName}
        </span>
      )}
      {phone && (
        <a
          href={`tel:${phone.replace(/[^+\d]/g, '')}`}
          className="relative z-10 flex w-fit items-center gap-1 text-primary hover:text-primary-hover hover:underline"
        >
          <Phone className="h-3 w-3 shrink-0" />
          <span className="truncate">{phone}</span>
        </a>
      )}
    </div>
  )
}

/**
 * Reste à payer d'une famille, jauge et détail des derniers règlements.
 *
 * Le panneau s'ouvre au clic — pas au survol : la ligne entière est déjà un lien vers la fiche
 * famille, et un survol déclencherait le panneau à chaque passage de souris.
 */
function RemainingCell({ family }: { family: FamilyRow }) {
  const t = useTranslations('dashboard.pages.families')
  const locale = useLocale()
  const { open, toggle, containerRef, triggerRef, menuRef } = useMenu()

  // Rien de facturé : ni jauge ni popover. Une famille sans inscription payante n'a aucun suivi
  // de règlement à montrer, et une colonne de « 0 % » sur toute la page n'informe personne.
  if (family.due === 0 && family.paymentCount === 0) {
    return <span className="text-graphite-600">—</span>
  }

  const rate = family.due > 0 ? (family.paid / family.due) * 100 : 0
  const tone = family.remaining === 0 ? 'green' : rate >= 50 ? 'amber' : 'red'

  return (
    <div className={open ? 'relative z-40' : 'relative z-10'} ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-3 rounded px-1 py-0.5 text-left hover:bg-alabaster-900"
      >
        <CircleProgress value={rate} tone={family.due > 0 ? tone : 'primary'} />
        <span className="flex flex-col">
          <span className="font-medium text-graphite">
            {formatCurrency(family.remaining, locale)}
          </span>
          <span className="text-xs text-graphite-600">
            {t('paymentsSummary', {
              paid: formatCurrency(family.paid, locale),
              due: formatCurrency(family.due, locale),
            })}
          </span>
        </span>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute left-0 top-full z-20 mt-2 w-72 rounded border border-alabaster-700 bg-white p-4 shadow-lg"
        >
          <p className="text-sm font-semibold text-graphite">{t('paymentDetails')}</p>
          {family.payments.length === 0 ? (
            <p className="mt-2 text-sm text-graphite-600">{t('noPayments')}</p>
          ) : (
            <>
              <ul className="mt-2 space-y-2">
                {family.payments.map((payment) => (
                  <li
                    key={`${payment.paidAt.toISOString()}-${payment.amount}-${payment.method}`}
                    className="flex items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="text-graphite-600">
                      {formatDate(payment.paidAt, locale)}
                      <span className="ml-2 text-xs">
                        <PaymentMethodLabel method={payment.method} />
                      </span>
                    </span>
                    <span className="font-medium text-graphite">
                      {formatCurrency(payment.amount, locale)}
                      {payment.method === 'CHECK' && payment.cashedAt === null && (
                        <span className="ml-1 text-xs text-amber-700">{t('notCashed')}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {family.paymentCount > family.payments.length && (
                <p className="mt-2 text-xs text-graphite-600">
                  {t('morePayments', { count: family.paymentCount - family.payments.length })}
                </p>
              )}
            </>
          )}
          <Link
            href={`/dashboard/families/${family.id}`}
            className="mt-3 block text-sm font-medium text-primary hover:text-primary-hover"
          >
            {t('viewFamily')}
          </Link>
        </div>
      )}
    </div>
  )
}

export function FamiliesDataTable({ data }: Props) {
  const t = useTranslations('dashboard.pages.families')

  const columns: ColumnDef<FamilyRow>[] = [
    {
      id: 'name',
      header: t('name'),
      accessorFn: (row) => row.name,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/families/${row.original.id}`}
          className="font-medium text-primary after:absolute after:inset-0 hover:text-primary-hover"
        >
          {row.original.name}
        </Link>
      ),
      enableSorting: true,
    },
    {
      id: 'emergencyContact',
      header: t('emergencyContact'),
      accessorFn: (row) =>
        [row.emergencyContactName, row.emergencyContactPhone].filter(Boolean).join(' ') || '-',
      cell: ({ row }) => <EmergencyContactCell family={row.original} />,
      enableSorting: true,
    },
    {
      id: 'remaining',
      header: t('remaining'),
      accessorFn: (row) => row.remaining,
      cell: ({ row }) => <RemainingCell family={row.original} />,
      enableSorting: true,
    },
    {
      id: 'studentCount',
      header: t('students'),
      accessorFn: (row) => row.studentCount,
      cell: ({ getValue }) => <span className="text-graphite">{getValue() as number}</span>,
      enableSorting: true,
    },
    {
      id: 'enrollmentCount',
      header: t('enrollments'),
      accessorFn: (row) => row.enrollmentCount,
      cell: ({ getValue }) => <span className="text-graphite">{getValue() as number}</span>,
      enableSorting: true,
    },
  ]

  const labels = useTableLabels()

  return (
    <RichDataTable data={data} columns={columns} labels={labels} emptyMessage={t('noFamilies')} />
  )
}
