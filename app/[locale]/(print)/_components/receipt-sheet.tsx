import { getTranslations } from 'next-intl/server'
import type { ReceiptView } from '../_lib/receipt-view'

export const RECEIPT_PRINT_CSS = `
@page { size: A5; margin: 10mm; }
@media print {
  html, body { background: #fff !important; min-height: 0 !important; }
  .receipt-sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`

/** Feuille A5 du reçu, commune à la caisse et au lien public. */
export async function ReceiptSheet({ view, locale }: { view: ReceiptView; locale: string }) {
  const t = await getTranslations({ locale, namespace: 'dashboard.pages.cashier.receipt' })

  return (
    <article className="receipt-sheet w-full max-w-[148mm] space-y-5 bg-white p-[10mm] text-graphite shadow-lg print:max-w-none print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4 border-b-2 border-primary pb-4">
        <div className="flex items-center gap-3">
          {view.logoUrl && (
            // biome-ignore lint/performance/noImgElement: logo printed as-is, outside next/image
            <img src={view.logoUrl} alt="" className="h-16 w-auto max-w-[40mm] object-contain" />
          )}
          <div>
            {view.schoolName && <p className="text-sm text-graphite-600">{view.schoolName}</p>}
            <h1 className="text-xl font-bold">{t('heading', { number: view.number })}</h1>
            <p className="text-sm text-graphite-600">{view.paidAt}</p>
          </div>
        </div>
        {view.isCancelled && (
          <span className="rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
            {t('cancelled')}
          </span>
        )}
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-graphite-600">{view.payerLabel}</dt>
        <dd>{view.payer}</dd>
        <dt className="text-graphite-600">{t('method')}</dt>
        <dd>
          {view.method}
          {view.reference && ` · ${view.reference}`}
        </dd>
        <dt className="text-graphite-600">{t('recordedBy')}</dt>
        <dd>{view.recordedBy}</dd>
      </dl>

      <ul className="divide-y divide-alabaster-700 border-y border-alabaster-700 text-sm">
        {view.lines.map((line) => (
          <li key={line.key} className="flex justify-between gap-4 py-2">
            <span>
              <span className="block">{line.label}</span>
              {line.detail && (
                <span className="block text-xs text-graphite-600">{line.detail}</span>
              )}
            </span>
            <span className="font-medium tabular-nums">{line.amount}</span>
          </li>
        ))}
      </ul>

      <p className="flex justify-between text-lg font-semibold">
        <span>{t('total')}</span>
        <span className="tabular-nums">{view.total}</span>
      </p>

      {view.tuitionBalance && <p className="text-sm text-graphite-600">{view.tuitionBalance}</p>}

      {view.isCancelled && view.cancelReason && (
        <p className="text-sm text-red-700">
          {t('cancelledReason', { reason: view.cancelReason })}
        </p>
      )}
    </article>
  )
}
