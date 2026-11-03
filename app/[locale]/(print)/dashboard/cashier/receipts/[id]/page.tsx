import { buttonVariants } from '@peaklab/ui'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { dateToMonth, formatChildcareMonth } from '@/domain/childcare'
import { formatReceiptNumber } from '@/domain/receipt'
import { teacherName } from '@/domain/teacher'
import { receiptGateway } from '@/gateways/receipt-gateway'
import { Link } from '@/i18n/routing'
import { getBrandingConfig } from '@/lib/branding'
import { formatCurrency, roundHalfUp } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { getFamilyBalance } from '@/use-cases/payments/family-balance'
import { requireSchoolCashier } from '../../../../../(dashboard)/_lib/auth-helper'
import { cashierPageMetadata } from '../../../../../(dashboard)/_lib/page-metadata'
import { PrintButton } from '../../../../_components/print-button'
import { CancelReceiptDialog, ShareReceiptButton } from './_components/receipt-actions'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RECEIPT_PRINT_CSS = `
@page { size: A5; margin: 10mm; }
@media print {
  html, body { background: #fff !important; min-height: 0 !important; }
  .receipt-sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return cashierPageMetadata(locale, 'dashboard.pages.cashier.receipt.title')
}

export default async function ReceiptPage({ params }: Props) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.cashier.receipt')
  const tServices = await getTranslations('dashboard.pages.meals.services')
  const tMethods = await getTranslations('dashboard.pages.payments.record.methods')

  const { schoolId, isAdmin } = await requireSchoolCashier()
  if (!UUID.test(id)) notFound()

  const [receipt, { logoUrl, schoolName }, { currency, timeZone }] = await Promise.all([
    receiptGateway.findForDisplay(schoolId, id),
    getBrandingConfig(schoolId),
    getSchoolRegionalSettings(schoolId),
  ])
  if (!receipt) notFound()

  const money = (value: number) => formatCurrency(value, locale, currency)
  // `paidThroughAtReceipt` est un `@db.Date`, à minuit UTC : formaté en UTC, il garde son jour.
  const formatDay = (day: Date) => day.toLocaleDateString(locale, { timeZone: 'UTC' })
  const number = formatReceiptNumber(receipt.number)
  const payer = receipt.family?.name ?? (receipt.teacher ? teacherName(receipt.teacher) : '')
  const payerLabel = receipt.family ? t('family') : t('staff')
  const mealOwnerName = (account: (typeof receipt.mealPayments)[number]['account']) =>
    account.student
      ? `${account.student.person.name} ${account.student.person.lastname}`
      : account.teacher
        ? teacherName(account.teacher)
        : ''
  const total = Number(receipt.total)
  const lines = [
    ...receipt.mealPayments.map((line) => ({
      key: `meal:${line.account.student?.person.name ?? (line.account.teacher ? teacherName(line.account.teacher) : '')}:${line.account.service}`,
      label: `${mealOwnerName(line.account)} · ${tServices(line.account.service)}`,
      amount: Number(line.amount),
      detail: line.paidThroughAtReceipt
        ? t('mealDetail', { days: line.daysAdded, date: formatDay(line.paidThroughAtReceipt) })
        : t('mealDays', { days: line.daysAdded }),
    })),
    ...receipt.childcarePayments.map((line) => {
      const { person } = line.charge.subscription.student
      const month = dateToMonth(line.charge.month)
      return {
        key: `childcare:${person.name}:${person.lastname}:${month}`,
        label: `${person.name} ${person.lastname} · ${t('childcare')}`,
        amount: Number(line.amount),
        detail: formatChildcareMonth(month, locale),
      }
    }),
  ]
  // L'écolage n'a pas de ligne propre : c'est le reste du total une fois les lignes déduites.
  const tuition = roundHalfUp(total - lines.reduce((sum, line) => sum + line.amount, 0))
  const paidAt = receipt.paidAt.toLocaleString(locale, {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  })
  const isCancelled = receipt.cancelledAt !== null
  // Solde lu à l'affichage, pas figé au paiement : daté pour qu'une réimpression reste honnête.
  const tuitionBalance =
    tuition > 0 && !isCancelled && receipt.family
      ? t('tuitionBalance', {
          date: new Date().toLocaleDateString(locale, { timeZone }),
          amount: money((await getFamilyBalance(schoolId, receipt.family.id)).remainingBalance),
        })
      : null

  const shareText = [
    t('shareHeader', { school: schoolName ?? '', number }),
    t('sharePayer', { label: payerLabel, payer, date: paidAt }),
    ...lines.map((line) => `• ${line.label} : ${money(line.amount)} (${line.detail})`),
    ...(tuition > 0 ? [`• ${t('tuition')} : ${money(tuition)}`] : []),
    t('shareTotal', { amount: money(total), method: tMethods(receipt.method) }),
    ...(tuitionBalance ? [tuitionBalance] : []),
    ...(isCancelled ? [t('cancelled')] : []),
  ].join('\n')

  return (
    <>
      <style>{RECEIPT_PRINT_CSS}</style>
      <div className="flex flex-1 flex-col items-center gap-4 bg-alabaster-900 px-4 py-6 print:block print:bg-white print:p-0">
        <div className="flex w-full max-w-[148mm] flex-wrap items-center justify-between gap-2 print:hidden">
          <Link
            href="/dashboard/cashier"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>
          <div className="flex flex-wrap gap-2">
            {isAdmin && !isCancelled && <CancelReceiptDialog receiptId={receipt.id} />}
            <ShareReceiptButton label={t('share')} text={shareText} />
            <PrintButton label={t('print')} />
          </div>
        </div>

        <article className="receipt-sheet w-full max-w-[148mm] space-y-5 bg-white p-[10mm] text-graphite shadow-lg print:max-w-none print:p-0 print:shadow-none">
          <header className="flex items-start justify-between gap-4 border-b-2 border-primary pb-4">
            <div className="flex items-center gap-3">
              {logoUrl && (
                // biome-ignore lint/performance/noImgElement: logo printed as-is, outside next/image
                <img src={logoUrl} alt="" className="h-12 w-auto object-contain" />
              )}
              <div>
                {schoolName && <p className="text-sm text-graphite-600">{schoolName}</p>}
                <h1 className="text-xl font-bold">{t('heading', { number })}</h1>
                <p className="text-sm text-graphite-600">{paidAt}</p>
              </div>
            </div>
            {isCancelled && (
              <span className="rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                {t('cancelled')}
              </span>
            )}
          </header>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-graphite-600">{payerLabel}</dt>
            <dd>{payer}</dd>
            <dt className="text-graphite-600">{t('method')}</dt>
            <dd>
              {tMethods(receipt.method)}
              {receipt.reference && ` · ${receipt.reference}`}
            </dd>
            <dt className="text-graphite-600">{t('recordedBy')}</dt>
            <dd>{receipt.recordedBy.name}</dd>
          </dl>

          <ul className="divide-y divide-alabaster-700 border-y border-alabaster-700 text-sm">
            {lines.map((line) => (
              <li key={line.key} className="flex justify-between gap-4 py-2">
                <span>
                  <span className="block">{line.label}</span>
                  <span className="block text-xs text-graphite-600">{line.detail}</span>
                </span>
                <span className="font-medium tabular-nums">{money(line.amount)}</span>
              </li>
            ))}
            {tuition > 0 && (
              <li className="flex justify-between gap-4 py-2">
                <span>{t('tuition')}</span>
                <span className="font-medium tabular-nums">{money(tuition)}</span>
              </li>
            )}
          </ul>

          <p className="flex justify-between text-lg font-semibold">
            <span>{t('total')}</span>
            <span className="tabular-nums">{money(total)}</span>
          </p>

          {tuitionBalance && <p className="text-sm text-graphite-600">{tuitionBalance}</p>}

          {isCancelled && receipt.cancelReason && (
            <p className="text-sm text-red-700">
              {t('cancelledReason', { reason: receipt.cancelReason })}
            </p>
          )}
        </article>
      </div>
    </>
  )
}
