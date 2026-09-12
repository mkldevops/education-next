'use client'

import {
  Button,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  useDialog,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import type { FormEvent } from 'react'
import { useEffect, useState, useTransition } from 'react'
import { toast, toastActionError } from '@/lib/toast'
import type {
  PromotionPreview,
  PromotionResult,
  SkipReason,
} from '@/use-cases/enrollments/promote-students'
import {
  previewPromoteStudentsAction,
  promoteStudentsAction,
} from '../../../_lib/enrollment-actions'

interface PeriodOption {
  id: string
  name: string
}

interface PromotePeriodDialogProps {
  sourcePeriod: PeriodOption
  targetOptions: PeriodOption[]
}

const SKIP_REASONS: SkipReason[] = [
  'alreadyPromoted',
  'noClassAssignment',
  'noNextLevel',
  'noTargetClass',
  'targetClassFull',
]

type Step = 'form' | 'preview' | 'report'

export function PromotePeriodDialogContent({
  sourcePeriod,
  targetOptions,
}: PromotePeriodDialogProps) {
  const t = useTranslations('dashboard.pages.periods.promote')
  const { open, setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>('form')
  const [targetPeriodId, setTargetPeriodId] = useState(targetOptions[0]?.id ?? '')
  const [preview, setPreview] = useState<PromotionPreview | null>(null)
  const [report, setReport] = useState<PromotionResult | null>(null)

  useEffect(() => {
    if (open) return
    setStep('form')
    setPreview(null)
    setReport(null)
    setTargetPeriodId(targetOptions[0]?.id ?? '')
  }, [open, targetOptions])

  const handlePreview = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        const result = await previewPromoteStudentsAction({
          sourcePeriodId: sourcePeriod.id,
          targetPeriodId,
        })
        if (typeof result === 'string') {
          toastActionError(t, result)
          return
        }
        setPreview(result)
        setStep('preview')
      } catch {
        toast.error(t('error'))
      }
    })
  }

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        const result = await promoteStudentsAction({
          sourcePeriodId: sourcePeriod.id,
          targetPeriodId,
        })
        if (typeof result === 'string') {
          toastActionError(t, result)
          return
        }
        setReport(result)
        setStep('report')
      } catch {
        toast.error(t('error'))
      }
    })
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('title', { period: sourcePeriod.name })}</DialogTitle>
      </DialogHeader>
      {step === 'form' && (
        <form onSubmit={handlePreview}>
          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="promote-target-period">{t('selectTarget')}</Label>
              <Select
                id="promote-target-period"
                required
                disabled={isPending}
                value={targetPeriodId}
                onChange={(e) => setTargetPeriodId(e.target.value)}
              >
                {targetOptions.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '...' : t('preview')}
            </Button>
          </DialogFooter>
        </form>
      )}
      {step === 'preview' && preview && (
        <>
          <DialogBody>
            <p className="text-sm text-graphite">
              {t('promotedCount', { count: preview.promoted })}
            </p>
            <p className="text-sm text-graphite">{t('skippedCount', { count: preview.skipped })}</p>
            {preview.skipped > 0 && (
              <ul className="space-y-1 text-sm text-graphite-600">
                {SKIP_REASONS.filter((reason) => preview.skippedByReason[reason] > 0).map(
                  (reason) => (
                    <li key={reason}>
                      {t(`reasons.${reason}`, { count: preview.skippedByReason[reason] })}
                    </li>
                  )
                )}
              </ul>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('form')}
              disabled={isPending}
            >
              {t('back')}
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={isPending}>
              {isPending ? '...' : t('confirm')}
            </Button>
          </DialogFooter>
        </>
      )}
      {step === 'report' && report && (
        <>
          <DialogBody>
            <p className="text-sm text-graphite">
              {t('promotedCount', { count: report.promoted })}
            </p>
            <p className="text-sm text-graphite">{t('skippedCount', { count: report.skipped })}</p>
            {report.errors.length > 0 && (
              <ul className="space-y-1 text-sm text-red-700">
                {report.errors.map((error) => (
                  <li key={error.studentId}>
                    {t(`reasons.${error.reason}`, { studentId: error.studentId })}
                  </li>
                ))}
              </ul>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </>
      )}
    </DialogContent>
  )
}
