'use client'

import { CircleAlert } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { DEFAULT_CURRENCY, formatCurrency } from '@/lib/decimal'
import { InstallmentSchedule } from '../installment-schedule'
import type { DraftPlan } from './draft-plans'

const installmentsSchema = z.array(z.object({ dueDate: z.string(), amount: z.number() }))

const pricingSchema = z.object({
  plan: z.object({ name: z.string() }),
  discount: z.number(),
  totalAmount: z.number(),
  firstInstallmentAmount: z.number().nullable().default(null),
})

const updateSchema = z.object({
  enrollment: z.object({ student: z.string() }),
  before: pricingSchema,
  after: pricingSchema,
  currency: z.string().default(DEFAULT_CURRENCY),
  schedule: z.object({ before: installmentsSchema, after: installmentsSchema }),
  paid: z.number(),
  remaining: z.number(),
})

const familySchema = z.object({
  family: z.object({ name: z.string() }),
  students: z.array(
    z.object({
      name: z.string(),
      lastname: z.string(),
      classPeriod: z.object({ name: z.string() }),
      plan: z.object({ name: z.string(), amount: z.number() }),
      firstInstallmentAmount: z.number().nullable().default(null),
      totalAmount: z.number(),
      installments: installmentsSchema,
    })
  ),
  discount: z.number().default(0),
  currency: z.string().default(DEFAULT_CURRENCY),
  payment: z.object({ amount: z.number() }).nullable().default(null),
})

type UpdatePlan = z.infer<typeof updateSchema>
type FamilyPlan = z.infer<typeof familySchema>

function Rows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Une remise posée sur un premier mois réduit baisse aussi les échéances suivantes : à relire. */
function DiscountWarning({ discount }: { discount: string }) {
  const t = useTranslations('dashboard.assistant.tools.summary')
  return (
    <p className="flex items-start gap-2 rounded border border-warning bg-surface p-2 text-sm">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      {t('discountWithFirstInstallment', { discount })}
    </p>
  )
}

function UpdateSummary({ plan }: { plan: UpdatePlan }) {
  const t = useTranslations('dashboard.assistant.tools.summary')
  const locale = useLocale()
  const { before, after, schedule, currency } = plan
  const money = (amount: number) => formatCurrency(amount, locale, currency)
  const change = (from: string, to: string) => (from === to ? to : `${from} → ${to}`)
  const scheduled = schedule.before.length > 0 || schedule.after.length > 0

  const rows: Array<[string, string]> = [
    [t('student'), plan.enrollment.student],
    [t('plan'), change(before.plan.name, after.plan.name)],
  ]
  if (before.discount > 0 || after.discount > 0) {
    rows.push([t('discount'), change(money(before.discount), money(after.discount))])
  }
  if (!scheduled) {
    rows.push([t('total'), change(money(before.totalAmount), money(after.totalAmount))])
  }
  rows.push([t('paid'), money(plan.paid)], [t('remaining'), money(plan.remaining)])

  return (
    <>
      <Rows rows={rows} />
      {scheduled && (
        <InstallmentSchedule
          installments={schedule.after}
          previous={schedule.before}
          total={after.totalAmount}
          previousTotal={before.totalAmount}
          currency={currency}
        />
      )}
      {after.discount > 0 && after.firstInstallmentAmount !== null && (
        <DiscountWarning discount={money(after.discount)} />
      )}
    </>
  )
}

function FamilySummary({ plan }: { plan: FamilyPlan }) {
  const t = useTranslations('dashboard.assistant.tools.summary')
  const locale = useLocale()
  const { currency, discount } = plan
  const money = (amount: number) => formatCurrency(amount, locale, currency)

  const rows: Array<[string, string]> = [[t('family'), plan.family.name]]
  if (discount > 0) rows.push([t('discount'), money(discount)])
  if (plan.payment) rows.push([t('payment'), money(plan.payment.amount)])

  return (
    <>
      <Rows rows={rows} />
      {plan.students.map((student) => (
        <section
          key={`${student.name}|${student.lastname}|${student.classPeriod.name}`}
          className="space-y-1"
        >
          <p className="font-medium text-sm">
            {[
              `${student.name} ${student.lastname}`,
              student.classPeriod.name,
              // Paiements coupés : la formule réservée « sans tarif » ne se nomme pas.
              ...(student.plan.amount > 0 ? [student.plan.name] : []),
            ].join(' · ')}
          </p>
          {student.installments.length > 0 ? (
            <InstallmentSchedule
              installments={student.installments}
              total={student.totalAmount}
              currency={currency}
            />
          ) : (
            student.totalAmount > 0 && (
              <p className="text-sm tabular-nums">
                {t('total')} : {money(student.totalAmount)}
              </p>
            )
          )}
        </section>
      ))}
      {discount > 0 && plan.students.some((student) => student.firstInstallmentAmount !== null) && (
        <DiscountWarning discount={money(discount)} />
      )}
    </>
  )
}

/**
 * Résumé lisible d'un aperçu d'inscription : l'échéancier mois par mois remplace le JSON brut.
 * `null` pour tout autre outil, ou pour un brouillon préparé avant que l'aperçu ne porte
 * l'échéancier : la carte retombe alors sur le plan brut.
 */
export function enrollmentPlanSummary(plan: DraftPlan): ReactNode | null {
  if (plan.tool === 'update_enrollment') {
    const parsed = updateSchema.safeParse(plan)
    return parsed.success ? <UpdateSummary plan={parsed.data} /> : null
  }
  if (plan.tool === 'enroll_family') {
    const parsed = familySchema.safeParse(plan)
    return parsed.success ? <FamilySummary plan={parsed.data} /> : null
  }
  return null
}
