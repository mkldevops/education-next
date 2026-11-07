import { getTranslations } from 'next-intl/server'
import { dateToMonth, formatChildcareMonth } from '@/domain/childcare'
import { formatReceiptNumber } from '@/domain/receipt'
import { teacherName } from '@/domain/teacher'
import { receiptGateway } from '@/gateways/receipt-gateway'
import { getBrandingConfig } from '@/lib/branding'
import { formatCurrency, roundHalfUp } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { getFamilyBalance } from '@/use-cases/payments/family-balance'

export type ReceiptLine = { key: string; label: string; amount: string; detail?: string }

export type ReceiptView = {
  id: string
  familyId: string | null
  number: string
  schoolName: string | null
  logoUrl: string | null
  paidAt: string
  payerLabel: string
  payer: string
  method: string
  reference: string | null
  recordedBy: string
  lines: ReceiptLine[]
  total: string
  tuitionBalance: string | null
  isCancelled: boolean
  cancelReason: string | null
  /** Texte du reçu pour un message : WhatsApp, feuille de partage du téléphone. */
  shareText: string
}

/**
 * Reçu prêt à afficher, lu dans l'école donnée : la page de caisse comme le lien public le
 * rendent à l'identique. `null` si le reçu n'appartient pas à cette école.
 */
export async function loadReceiptView(
  schoolId: string,
  id: string,
  locale: string
): Promise<ReceiptView | null> {
  const [t, tServices, tMethods] = await Promise.all([
    getTranslations({ locale, namespace: 'dashboard.pages.cashier.receipt' }),
    getTranslations({ locale, namespace: 'dashboard.pages.meals.services' }),
    getTranslations({ locale, namespace: 'dashboard.pages.payments.record.methods' }),
  ])
  const [receipt, { logoUrl, schoolName }, { currency, timeZone }] = await Promise.all([
    receiptGateway.findForDisplay(schoolId, id),
    getBrandingConfig(schoolId),
    getSchoolRegionalSettings(schoolId),
  ])
  if (!receipt) return null

  const money = (value: number) => formatCurrency(value, locale, currency)
  // `paidThroughAtReceipt` est un `@db.Date`, à minuit UTC : formaté en UTC, il garde son jour.
  const formatDay = (day: Date) => day.toLocaleDateString(locale, { timeZone: 'UTC' })
  const number = formatReceiptNumber(receipt.number)
  const payer = receipt.family?.name ?? (receipt.teacher ? teacherName(receipt.teacher) : '')
  const payerLabel = receipt.family ? t('family') : t('staff')
  const personName = (person: { name: string; lastname: string }) =>
    `${person.name} ${person.lastname}`
  const mealOwnerName = (account: (typeof receipt.mealPayments)[number]['account']) =>
    account.student
      ? personName(account.student.person)
      : account.teacher
        ? teacherName(account.teacher)
        : ''
  const total = Number(receipt.total)
  const serviceLines = [
    ...receipt.mealPayments.map((line) => ({
      key: `meal:${mealOwnerName(line.account)}:${line.account.service}`,
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
        key: `childcare:${personName(person)}:${month}`,
        label: `${personName(person)} · ${t('childcare')}`,
        amount: Number(line.amount),
        detail: formatChildcareMonth(month, locale),
      }
    }),
  ]
  // L'écolage est le reste du total une fois les services déduits ; détaillé par élève quand
  // ses lignes de règlement le recomposent exactement.
  const tuition = roundHalfUp(total - serviceLines.reduce((sum, line) => sum + line.amount, 0))
  const byStudent = new Map<string, number>()
  for (const payment of receipt.payments) {
    const name = personName(payment.enrollment.student.person)
    byStudent.set(name, roundHalfUp((byStudent.get(name) ?? 0) + Number(payment.amount)))
  }
  const detailed = roundHalfUp([...byStudent.values()].reduce((sum, value) => sum + value, 0))
  const tuitionLines =
    tuition <= 0
      ? []
      : byStudent.size > 0 && detailed === tuition
        ? [...byStudent].map(([name, amount]) => ({
            key: `tuition:${name}`,
            label: `${name} · ${t('tuition')}`,
            amount,
          }))
        : [{ key: 'tuition', label: t('tuition'), amount: tuition }]

  // Une saisie d'écolage ne porte qu'un jour, stocké à minuit UTC : l'heure n'y aurait aucun sens.
  const paidAt =
    receipt.paidAt.getTime() % 86_400_000 === 0
      ? receipt.paidAt.toLocaleDateString(locale, { timeZone: 'UTC', dateStyle: 'short' })
      : receipt.paidAt.toLocaleString(locale, { timeZone, dateStyle: 'short', timeStyle: 'short' })
  const isCancelled = receipt.cancelledAt !== null
  // Solde lu à l'affichage, pas figé au paiement : daté pour qu'une réimpression reste honnête.
  const tuitionBalance =
    tuition > 0 && !isCancelled && receipt.family
      ? t('tuitionBalance', {
          date: new Date().toLocaleDateString(locale, { timeZone }),
          amount: money((await getFamilyBalance(schoolId, receipt.family.id)).remainingBalance),
        })
      : null

  const lines: ReceiptLine[] = [
    ...serviceLines.map((line) => ({ ...line, amount: money(line.amount) })),
    ...tuitionLines.map((line) => ({ ...line, amount: money(line.amount) })),
  ]
  const method = tMethods(receipt.method)
  const shareText = [
    t('shareHeader', { school: schoolName ?? '', number }),
    t('sharePayer', { label: payerLabel, payer, date: paidAt }),
    ...lines.map(
      (line) => `• ${line.label} : ${line.amount}${line.detail ? ` (${line.detail})` : ''}`
    ),
    t('shareTotal', { amount: money(total), method }),
    ...(tuitionBalance ? [tuitionBalance] : []),
    ...(isCancelled ? [t('cancelled')] : []),
  ].join('\n')

  return {
    id: receipt.id,
    familyId: receipt.family?.id ?? null,
    number,
    schoolName: schoolName ?? null,
    logoUrl: logoUrl ?? null,
    paidAt,
    payerLabel,
    payer,
    method,
    reference: receipt.reference,
    recordedBy: receipt.recordedBy?.name ?? t('onlinePayment'),
    lines,
    total: money(total),
    tuitionBalance,
    isCancelled,
    cancelReason: receipt.cancelReason,
    shareText,
  }
}
