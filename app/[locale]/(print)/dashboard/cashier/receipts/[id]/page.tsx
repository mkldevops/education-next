import { buttonVariants } from '@peaklab/ui'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ensureReceiptShareToken, receiptShareUrl } from '@/use-cases/receipts/share-receipt'
import { requireSchoolReceipts } from '../../../../../(dashboard)/_lib/auth-helper'
import { cashierPageMetadata } from '../../../../../(dashboard)/_lib/page-metadata'
import { PrintButton } from '../../../../_components/print-button'
import { RECEIPT_PRINT_CSS, ReceiptSheet } from '../../../../_components/receipt-sheet'
import { loadReceiptView } from '../../../../_lib/receipt-view'
import { CancelReceiptDialog, ReceiptShareDialog } from './_components/receipt-actions'

type Props = {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ action?: string }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return cashierPageMetadata(locale, 'dashboard.pages.cashier.receipt.title')
}

export default async function ReceiptPage({ params, searchParams }: Props) {
  await connection()
  const { locale, id } = await params
  const { action } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.cashier.receipt')

  const { schoolId, isAdmin } = await requireSchoolReceipts()
  if (!UUID.test(id)) notFound()

  const view = await loadReceiptView(schoolId, id, locale)
  if (!view) notFound()

  // Le lien public n'existe que pour un reçu valide : l'annulation le révoque.
  const shared = view.isCancelled ? null : await ensureReceiptShareToken(schoolId, view.id)
  const shareUrl =
    shared && typeof shared !== 'string' ? receiptShareUrl(shared.token, locale) : null
  const back =
    isAdmin && view.familyId
      ? { href: `/dashboard/families/${view.familyId}`, label: t('backToFamily') }
      : { href: '/dashboard/cashier', label: t('back') }

  return (
    <>
      <style>{RECEIPT_PRINT_CSS}</style>
      <div className="flex flex-1 flex-col items-center gap-4 bg-alabaster-900 px-4 py-6 print:block print:bg-white print:p-0">
        <div className="flex w-full max-w-[148mm] flex-wrap items-center justify-between gap-2 print:hidden">
          <Link href={back.href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <ArrowLeft className="h-4 w-4" />
            {back.label}
          </Link>
          <div className="flex flex-wrap gap-2">
            {isAdmin && !view.isCancelled && (
              <CancelReceiptDialog receiptId={view.id} initialOpen={action === 'cancel'} />
            )}
            {shareUrl && (
              <ReceiptShareDialog
                receiptId={view.id}
                text={view.shareText}
                url={shareUrl}
                canEmail={view.familyId !== null}
              />
            )}
            <PrintButton label={t('print')} />
          </div>
        </div>

        <ReceiptSheet view={view} locale={locale} />
      </div>
    </>
  )
}
