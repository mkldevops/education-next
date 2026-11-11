import { Card } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import type { PaymentMethod } from '@/generated/prisma/client'
import { formatCurrency } from '@/lib/decimal'
import { cn } from '@/lib/utils'
import type { PaymentStats } from '@/use-cases/payments/payment-stats'

const METHOD_TONE: Record<PaymentMethod, { stroke: string; swatch: string }> = {
  CASH: { stroke: 'stroke-emerald-600', swatch: 'bg-emerald-600' },
  CHECK: { stroke: 'stroke-primary', swatch: 'bg-primary' },
  TRANSFER: { stroke: 'stroke-sky-600', swatch: 'bg-sky-600' },
  CARD: { stroke: 'stroke-amber-500', swatch: 'bg-amber-500' },
  STRIPE: { stroke: 'stroke-violet-500', swatch: 'bg-violet-500' },
  MOBILE_MONEY: { stroke: 'stroke-orange-600', swatch: 'bg-orange-600' },
}

const RADIUS = 15.9155

export async function PaymentMethodsCard({
  methods,
  locale,
  currency,
  className,
}: {
  methods: PaymentStats['methods']
  locale: string
  currency: string
  className?: string
}) {
  const t = await getTranslations('dashboard.pages.payments.stats')
  const tMethod = await getTranslations('paymentMethod')
  const total = methods.reduce((sum, method) => sum + method.amount, 0)
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 })

  let offset = 0
  const slices = methods.map((method) => {
    const share = total > 0 ? (100 * method.amount) / total : 0
    const slice = { ...method, share, start: offset }
    offset += share
    return slice
  })

  return (
    <Card className={cn('p-4 sm:p-5', className)}>
      <h2 className="text-sm font-semibold text-foreground">{t('methodsTitle')}</h2>
      {total === 0 ? (
        <p className="mt-4 text-sm text-graphite-600">{t('noCollection')}</p>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-4">
          <div className="relative size-36 shrink-0">
            <svg viewBox="0 0 42 42" className="size-full -rotate-90" aria-hidden="true">
              <circle
                cx="21"
                cy="21"
                r={RADIUS}
                fill="none"
                strokeWidth="6"
                className="stroke-alabaster-700"
              />
              {slices.map((slice) => (
                <circle
                  key={slice.method}
                  cx="21"
                  cy="21"
                  r={RADIUS}
                  fill="none"
                  strokeWidth="6"
                  pathLength={100}
                  strokeDasharray={`${slice.share} ${100 - slice.share}`}
                  strokeDashoffset={-slice.start}
                  className={METHOD_TONE[slice.method as PaymentMethod].stroke}
                />
              ))}
            </svg>
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-semibold tabular-nums text-graphite">
              {formatCurrency(total, locale, currency)}
            </p>
          </div>
          <ul className="w-full space-y-2">
            {slices.map((slice) => (
              <li key={slice.method} className="flex items-baseline gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-2.5 shrink-0 self-center rounded-xs',
                    METHOD_TONE[slice.method as PaymentMethod].swatch
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-graphite">
                  {tMethod(slice.method as PaymentMethod)}
                </span>
                <span className="tabular-nums text-graphite">
                  {formatCurrency(slice.amount, locale, currency)}
                </span>
                <span className="w-10 text-right text-xs tabular-nums text-graphite-600">
                  {percent.format(slice.share / 100)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
