import { Button } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import type { Labels } from './attendance-call-model'
import { RosterRefreshBar } from './roster-refresh-bar'
import type { AttendanceStatus } from './student-attendance-card'

export function AttendanceProgress({
  labels,
  status,
  counts,
  recorded,
  total,
  editing,
  blocked,
  rosterNotice,
  onRefreshRoster,
  onMarkRemainingPresent,
}: {
  labels: Labels
  status: string
  counts: Record<AttendanceStatus, number>
  recorded: number
  total: number
  editing: boolean
  blocked: boolean
  rosterNotice: string | null
  onRefreshRoster: () => void
  onMarkRemainingPresent: () => void
}) {
  const t = useTranslations('dashboard.pages.attendance')
  return (
    <section className="mx-auto max-w-2xl space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-graphite-600">
        <p>{status === 'VALIDATED' ? labels.validatedStatus : labels.draft}</p>
        <div className="flex gap-1.5">
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-900">
            {counts.PRESENT} {labels.present}
          </span>
          <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-950">
            {counts.LATE} {labels.late}
          </span>
          <span className="rounded-full bg-red-50 px-2 py-1 text-red-900">
            {counts.ABSENT} {labels.absent}
          </span>
        </div>
      </div>
      <p className="text-sm text-graphite-600">
        {labels.progress.replace('{recorded}', String(recorded)).replace('{total}', String(total))}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-alabaster-700" aria-hidden="true">
        <div
          className="h-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${total ? (recorded / total) * 100 : 0}%` }}
        />
      </div>
      {status === 'DRAFT' ? (
        <RosterRefreshBar
          className="flex flex-wrap items-center gap-2"
          disabled={blocked}
          notice={rosterNotice}
          onRefresh={onRefreshRoster}
        />
      ) : null}
      {editing && counts.NOT_RECORDED > 0 ? (
        <Button variant="outline" size="sm" disabled={blocked} onClick={onMarkRemainingPresent}>
          {t('markRemainingPresent', { count: counts.NOT_RECORDED })}
        </Button>
      ) : null}
    </section>
  )
}
