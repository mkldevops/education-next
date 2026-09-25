'use client'

import { Button } from '@peaklab/ui'
import { Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { MCP_DRAFT_TTL_MINUTES } from '@/domain/mcp-draft'
import { formatCurrency } from '@/lib/decimal'
import type { AssistantPreviewResult } from '../../../_lib/enroll-assistant-actions'

type Finding = { field: string; value: string; reason: string }

export type PreviewOutcome = Extract<AssistantPreviewResult, { status: 'blocked' | 'preview' }>

type Props = {
  outcome: PreviewOutcome
  edited: boolean
  confirming: boolean
  onUseFamily: (family: { id: string; name: string }) => void
  onConfirm: () => void
}

export function PreviewCard({ outcome, edited, confirming, onUseFamily, onConfirm }: Props) {
  const t = useTranslations('dashboard.pages.enrollAssistant.preview')
  const tReasons = useTranslations('dashboard.pages.enrollAssistant.reasons')
  const locale = useLocale()

  const reason = (code: string) =>
    tReasons.has(code) ? tReasons(code) : tReasons('other', { reason: code })

  const findings = (title: string, items: Finding[], tone: string) =>
    items.length > 0 ? (
      <div className={`rounded border px-3 py-2 text-sm ${tone}`}>
        <p className="font-medium">{title}</p>
        <ul className="mt-1 list-disc pl-5">
          {items.map((item) => (
            <li key={`${item.field}-${item.reason}-${item.value}`}>
              {t('finding', { field: item.field, value: item.value, reason: reason(item.reason) })}
            </li>
          ))}
        </ul>
      </div>
    ) : null

  const { matches } = outcome
  const hasMatches = matches.families.length > 0 || matches.students.length > 0

  return (
    <section className="flex flex-col gap-3" aria-label={t('title')}>
      {outcome.status === 'blocked' ? (
        <p className="text-sm text-danger" role="alert">
          {t('blocked')}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">
          {t('ready', { minutes: MCP_DRAFT_TTL_MINUTES })}
        </p>
      )}

      {findings(t('blockers'), outcome.blockers, 'border-danger/40 bg-danger-subtle')}
      {findings(t('warnings'), outcome.warnings, 'border-warning/40 bg-warning-subtle')}

      {hasMatches ? (
        <div className="rounded border border-border bg-surface-2 px-3 py-2 text-sm">
          <p className="font-medium">{t('matches')}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {matches.families.map((family) => (
              <li key={family.id} className="flex items-center justify-between gap-2">
                <span>{t('matchFamily', { name: family.name })}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={confirming}
                  onClick={() => onUseFamily(family)}
                >
                  {t('useFamily')}
                </Button>
              </li>
            ))}
            {matches.students.map((student) => (
              <li key={student.id}>
                {t('matchStudent', {
                  name: `${student.name} ${student.lastname}`,
                  kind: t(student.isStudent ? 'matchKind.student' : 'matchKind.person'),
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {outcome.status === 'preview' ? (
        <>
          <div className="rounded border border-border px-3 py-2 text-sm">
            <p className="font-medium">{t('plan.title')}</p>
            <ul className="mt-1 flex flex-col gap-1">
              <li>
                {t(outcome.plan.family.existing ? 'plan.existingFamily' : 'plan.newFamily', {
                  name: outcome.plan.family.name,
                })}
              </li>
              <li>{t('plan.parents', { count: outcome.plan.parentCount })}</li>
              {outcome.plan.students.map((student) => (
                <li key={`${student.name}-${student.lastname}-${student.className}`}>
                  {t('plan.student', {
                    name: `${student.name} ${student.lastname}`,
                    className: student.className,
                    plan: student.planName,
                    amount: formatCurrency(student.amount, locale),
                  })}
                </li>
              ))}
              <li>
                {outcome.plan.payment
                  ? t('plan.payment', {
                      amount: formatCurrency(outcome.plan.payment.amount, locale),
                      method: outcome.plan.payment.method,
                    })
                  : t('plan.noPayment')}
              </li>
            </ul>
          </div>

          <div>
            <Button type="button" onClick={onConfirm} disabled={edited || confirming}>
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {confirming ? t('confirming') : t('confirm')}
            </Button>
          </div>
        </>
      ) : null}
    </section>
  )
}
