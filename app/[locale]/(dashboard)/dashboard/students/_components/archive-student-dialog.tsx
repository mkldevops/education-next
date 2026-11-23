'use client'

import {
  Button,
  cn,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useDialog,
} from '@peaklab/ui'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'
import { DEPARTURE_REMAINDERS, type DepartureRemainder } from '@/domain/student-departure'
import { useRouter } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { toast, toastActionError } from '@/lib/toast'
import { archiveStudentAction, previewStudentArchiveAction } from '../../../_lib/student-actions'

type Props = {
  studentId: string
  studentName: string
  triggerRole?: React.AriaRole
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

type Preview = Exclude<Awaited<ReturnType<typeof previewStudentArchiveAction>>, string>

export function ArchiveStudentDialog({
  studentId,
  studentName,
  triggerRole,
  restoreFocusRef,
}: Props) {
  const t = useTranslations('dashboard.pages.students.archive')

  return (
    <Dialog restoreFocusRef={restoreFocusRef}>
      <DialogTrigger>
        <Button variant="destructive" size="sm" role={triggerRole}>
          {t('trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title', { name: studentName })}</DialogTitle>
        </DialogHeader>
        <ArchiveStudentForm studentId={studentId} />
      </DialogContent>
    </Dialog>
  )
}

function ArchiveStudentForm({ studentId }: { studentId: string }) {
  const t = useTranslations('dashboard.pages.students.archive')
  const locale = useLocale()
  const router = useRouter()
  const { setOpen } = useDialog()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [remainder, setRemainder] = useState<DepartureRemainder>('keep')
  const [reason, setReason] = useState('')
  const [isLoading, startLoading] = useTransition()
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startLoading(async () => {
      const result = await previewStudentArchiveAction(studentId, month ?? undefined)
      if (typeof result === 'string') {
        setPreviewError(result)
        return
      }
      setPreviewError(null)
      setPreview(result)
    })
  }, [studentId, month])

  const monthFormat = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const monthLabel = (value: string) => monthFormat.format(new Date(`${value}-01T00:00:00.000Z`))
  const monthItems = (preview?.months ?? []).map((value) => ({ value, label: monthLabel(value) }))
  const selectedMonth = month ?? preview?.endMonth ?? null
  const owesRemainder = (preview?.remaining ?? 0) > 0
  const chosenRemainder: DepartureRemainder = owesRemainder ? remainder : 'keep'
  const reasonMissing = chosenRemainder === 'writeOff' && reason.trim() === ''

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedMonth || reasonMissing) return
    startTransition(async () => {
      const result = await archiveStudentAction({
        studentId,
        endMonth: selectedMonth,
        remainder: chosenRemainder,
        reason: chosenRemainder === 'writeOff' ? reason : undefined,
      })
      if (result !== 'OK') {
        toastActionError(t, result)
        return
      }
      toast.success(t('success'))
      setOpen(false)
      router.push('/dashboard/students')
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody className="grid gap-4">
        <div className="grid gap-1">
          <Label htmlFor="archive-end-month">{t('endMonth')}</Label>
          {preview ? (
            <Select
              name="endMonth"
              items={monthItems}
              value={selectedMonth}
              onValueChange={(value) => value && setMonth(String(value))}
              disabled={isPending}
            >
              <SelectTrigger id="archive-end-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : previewError ? (
            <p role="alert" className="text-sm text-danger">
              {t.has(`errors.${previewError}`) ? t(`errors.${previewError}`) : t('error')}
            </p>
          ) : (
            <p className="text-sm text-graphite-600">{t('loading')}</p>
          )}
        </div>

        <ul className="list-disc space-y-1 pl-5 text-sm text-graphite-600">
          <li>{t('effects.enrollments')}</li>
          <li>{t('effects.class')}</li>
          <li>{t('effects.services')}</li>
          <li>{t('effects.history')}</li>
        </ul>

        {preview && selectedMonth && (
          <p className={cn('text-sm font-medium text-graphite', isLoading && 'opacity-60')}>
            {t('remaining', {
              month: monthLabel(selectedMonth),
              amount: formatCurrency(preview.remaining, locale, preview.currency),
            })}
          </p>
        )}

        {owesRemainder && (
          <fieldset className="grid gap-2" disabled={isPending}>
            <legend className="mb-1 text-sm font-medium text-graphite">
              {t('remainderLegend')}
            </legend>
            {DEPARTURE_REMAINDERS.map((value) => (
              <label key={value} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="remainder"
                  value={value}
                  checked={remainder === value}
                  onChange={() => setRemainder(value)}
                  className="mt-0.5"
                />
                <span>{t(`remainders.${value}`)}</span>
              </label>
            ))}
            {remainder === 'writeOff' && (
              <div className="grid gap-1">
                <Label htmlFor="archive-reason">{t('reason')}</Label>
                <Textarea
                  id="archive-reason"
                  name="reason"
                  value={reason}
                  maxLength={500}
                  required
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            )}
          </fieldset>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={isPending || isLoading || !preview || reasonMissing}
        >
          {isPending ? '...' : t('confirm')}
        </Button>
      </DialogFooter>
    </form>
  )
}
