'use client'

import { Button } from '@peaklab/ui'
import { type DynamicToolUIPart, getToolName, type ToolUIPart } from 'ai'
import { Ban, Check, CircleAlert, Loader2, ShieldQuestion, Wrench, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import type { DraftPlan } from './draft-plans'

export type ApprovalResponse = { id: string; approved: boolean }

type Props = {
  part: ToolUIPart | DynamicToolUIPart
  /** Plan résolu par l'aperçu dont ce commit reprend le brouillon. */
  plan?: DraftPlan
  onApproval: (response: ApprovalResponse) => void
}

const MAX_DETAIL_CHARS = 4000

function formatDetail(value: unknown) {
  const text = JSON.stringify(value, null, 2) ?? ''
  return text.length > MAX_DETAIL_CHARS ? `${text.slice(0, MAX_DETAIL_CHARS)}\n…` : text
}

function PaymentSummary({ plan }: { plan: DraftPlan }) {
  const t = useTranslations('dashboard.assistant.tools.summary')
  const tMethod = useTranslations('paymentMethod')
  const format = useFormatter()
  const family = plan.family as { name?: string } | undefined
  const method = String(plan.method)
  const rows: Array<[string, string]> = [
    [t('family'), family?.name ?? ''],
    [t('amount'), format.number(Number(plan.amount), { style: 'currency', currency: 'EUR' })],
    [t('method'), tMethod.has(method) ? tMethod(method) : method],
    [t('paidAt'), format.dateTime(new Date(String(plan.paidAt)), { dateStyle: 'short' })],
  ]
  if (typeof plan.reference === 'string') rows.push([t('reference'), plan.reference])
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

function refusalCode(output: unknown): string | null {
  if (typeof output !== 'object' || output === null || !('error' in output)) return null
  return typeof output.error === 'string' ? output.error : null
}

/**
 * Une étape d'outil dans le fil : lectures repliées, écritures en attente de validation.
 *
 * Le détail montré à l'administrateur est l'entrée exacte que le serveur exécutera ;
 * c'est sur elle, pas sur le texte du modèle, que porte la validation.
 */
export function ToolPart({ part, plan, onApproval }: Props) {
  const t = useTranslations('dashboard.assistant.tools')
  const name = getToolName(part)
  const label = t.has(`names.${name}`) ? t(`names.${name}`) : name

  if (part.state === 'approval-requested') {
    return (
      <div className="mt-2 flex flex-col gap-2 rounded border border-warning bg-warning-subtle p-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ShieldQuestion className="h-4 w-4 shrink-0" aria-hidden />
          {t('approval.title', { tool: label })}
        </p>
        {plan?.tool === 'record_payment' ? <PaymentSummary plan={plan} /> : null}
        {plan && plan.tool !== 'record_payment' ? (
          <pre className="max-h-48 overflow-auto rounded bg-surface p-2 text-xs">
            {formatDetail(plan)}
          </pre>
        ) : null}
        <details open={!plan}>
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {t('approval.details')}
          </summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded bg-surface p-2 text-xs">
            {formatDetail(part.input)}
          </pre>
        </details>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onApproval({ id: part.approval.id, approved: true })}>
            <Check className="h-4 w-4" aria-hidden />
            {t('approval.approve')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onApproval({ id: part.approval.id, approved: false })}
          >
            <X className="h-4 w-4" aria-hidden />
            {t('approval.refuse')}
          </Button>
        </div>
      </div>
    )
  }

  if (part.state === 'input-streaming' || part.state === 'input-available') {
    return (
      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        {t('running', { tool: label })}
      </p>
    )
  }

  if (part.state === 'approval-responded') {
    return (
      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {part.approval.approved ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <Ban className="h-3 w-3" aria-hidden />
        )}
        {part.approval.approved ? t('approved', { tool: label }) : t('refused', { tool: label })}
      </p>
    )
  }

  if (part.state === 'output-denied') {
    return (
      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Ban className="h-3 w-3" aria-hidden />
        {t('refused', { tool: label })}
      </p>
    )
  }

  if (part.state === 'output-error') {
    return (
      <p className="mt-1 flex items-center gap-2 text-xs text-danger">
        <CircleAlert className="h-3 w-3" aria-hidden />
        {t('failed', { tool: label })}
      </p>
    )
  }

  const refusal = refusalCode(part.output)
  return (
    <details className="mt-1 text-xs">
      <summary
        className={
          refusal
            ? 'flex cursor-pointer items-center gap-2 text-warning'
            : 'flex cursor-pointer items-center gap-2 text-muted-foreground'
        }
      >
        {refusal ? (
          <CircleAlert className="h-3 w-3" aria-hidden />
        ) : (
          <Wrench className="h-3 w-3" aria-hidden />
        )}
        {refusal ? t('refusal', { tool: label, code: refusal }) : t('done', { tool: label })}
      </summary>
      <pre className="mt-1 max-h-48 overflow-auto rounded bg-surface p-2">
        {formatDetail(part.output)}
      </pre>
    </details>
  )
}
