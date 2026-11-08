import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { findReceiptByShareToken } from '@/lib/db-unscoped'
import { PrintButton } from '../../_components/print-button'
import { RECEIPT_PRINT_CSS, ReceiptSheet } from '../../_components/receipt-sheet'
import { loadReceiptView } from '../../_lib/receipt-view'

type Props = {
  params: Promise<{ locale: string; token: string }>
}

const TOKEN = /^[A-Za-z0-9_-]{32,64}$/

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard.pages.cashier.receipt' })
  return { title: t('title'), robots: { index: false, follow: false }, referrer: 'no-referrer' }
}

/**
 * Reçu ouvert par son lien partagé, sans connexion : le jeton aléatoire tient lieu
 * d'autorisation, en lecture seule. Un reçu annulé ou un jeton inconnu donne une 404.
 */
export default async function PublicReceiptPage({ params }: Props) {
  await connection()
  const { locale, token } = await params
  setRequestLocale(locale)
  if (!TOKEN.test(token)) notFound()

  const receipt = await findReceiptByShareToken(token)
  if (!receipt) notFound()
  const view = await loadReceiptView(receipt.schoolId, receipt.id, locale)
  if (!view || view.isCancelled) notFound()
  const t = await getTranslations('dashboard.pages.cashier.receipt')

  return (
    <>
      <style>{RECEIPT_PRINT_CSS}</style>
      <div className="flex flex-1 flex-col items-center gap-4 bg-alabaster-900 px-4 py-6 print:block print:bg-white print:p-0">
        <div className="flex w-full max-w-[148mm] justify-end print:hidden">
          <PrintButton label={t('print')} />
        </div>
        <ReceiptSheet view={view} locale={locale} />
      </div>
    </>
  )
}
