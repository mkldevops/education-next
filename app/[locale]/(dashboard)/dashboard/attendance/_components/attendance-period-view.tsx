import { Breadcrumbs, Card, EmptyState } from '@peaklab/ui'
import { CalendarDays } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import {
  type AttendanceGridColumn,
  type AttendanceGridRow,
  buildAttendanceGrid,
} from '@/domain/attendance-grid'
import {
  ATTENDANCE_RANGE_PRESETS,
  attendanceRangePreset,
  resolveAttendanceRange,
} from '@/domain/attendance-range'
import { attendanceClassPeriodScope } from '@/domain/attendance-tracking-scope'
import type { AttendanceEntryStatus } from '@/generated/prisma/client'
import { Link } from '@/i18n/routing'
import { db } from '@/lib/db'
import { attendanceGridCsv } from '../_lib/attendance-grid-csv'
import { AttendanceClassSelect } from './attendance-class-select'
import { AttendanceExportMenu } from './attendance-export-menu'
import {
  attendanceDayHref,
  attendancePeriodHref,
  attendanceSessionHref,
} from './attendance-period-href'
import { AttendanceRangeMenu } from './attendance-range-menu'
import { AttendanceViewToggle } from './attendance-view-toggle'

const ATTENDED: AttendanceEntryStatus[] = ['PRESENT', 'LATE']

const CELL_TONE: Record<AttendanceEntryStatus, string> = {
  PRESENT: 'bg-success-subtle text-success',
  LATE: 'bg-warning-subtle text-warning',
  ABSENT: 'bg-danger-subtle text-danger',
  NOT_RECORDED: 'text-graphite-600',
}

const PRINT_STYLES = `@media print {
  @page { size: A4 landscape; margin: 10mm; }
  body * { visibility: hidden; }
  [data-print-root], [data-print-root] * { visibility: visible; }
  :has([data-print-root]) {
    position: static !important; overflow: visible !important; height: auto !important;
    max-height: none !important; min-height: 0 !important;
  }
  [data-print-root] * { overflow: visible !important; }
  [data-print-root] { position: absolute; inset: 0 auto auto 0; width: 100%; }
  [data-print-root] table { font-size: 9px; }
  [data-print-root] thead { display: table-header-group; }
  [data-print-root] tr { break-inside: avoid; }
}`

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function AttendancePeriodView({
  locale,
  schoolId,
  teacherId,
  period,
  query,
}: {
  locale: string
  schoolId: string
  teacherId: string | null
  period: { id: string; name: string } | null
  query: { range?: string; from?: string; to?: string; classId?: string }
}) {
  const [t, tBreadcrumbs] = await Promise.all([
    getTranslations('dashboard.pages.attendance'),
    getTranslations('dashboard.breadcrumbs'),
  ])
  const today = new Date()
  const range = resolveAttendanceRange(query, today)
  const longDay = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' })
  const shortDay = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  const dayNumber = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' })
  const rangeLabel = (from: Date, to: Date) => longDay.formatRange(from, to)

  const scope = attendanceClassPeriodScope({
    periodId: period?.id,
    teacherId: teacherId ?? undefined,
  })
  const classes = scope
    ? await db.classPeriod.findMany({
        where: { schoolId, ...scope },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : []
  const selectedClass = classes.find((item) => item.id === query.classId) ?? classes[0]

  const sessions = selectedClass
    ? await db.attendanceSession.findMany({
        where: {
          schoolId,
          classPeriodId: selectedClass.id,
          status: { not: 'CANCELLED' },
          occurredOn: { gte: range.from, lte: range.to },
        },
        select: {
          id: true,
          occurredOn: true,
          occurrenceKey: true,
          classScheduleSlotId: true,
          classScheduleSlot: { select: { startTime: true } },
          entries: { select: { studentId: true, studentName: true, status: true } },
        },
      })
    : []
  const studentIds = [...new Set(sessions.flatMap((s) => s.entries.map((e) => e.studentId)))]
  const lastPresences =
    selectedClass && studentIds.length > 0
      ? await db.attendanceEntry.findMany({
          where: {
            schoolId,
            studentId: { in: studentIds },
            status: { in: ATTENDED },
            attendanceSession: {
              schoolId,
              classPeriodId: selectedClass.id,
              status: { not: 'CANCELLED' },
              occurredOn: { lte: range.to },
            },
          },
          select: { studentId: true, attendanceSession: { select: { occurredOn: true } } },
          orderBy: { attendanceSession: { occurredOn: 'desc' } },
          distinct: ['studentId'],
        })
      : []
  const { columns, rows } = buildAttendanceGrid(
    sessions.map((session) => ({
      id: session.id,
      occurredOn: session.occurredOn,
      occurrenceKey: session.occurrenceKey,
      classScheduleSlotId: session.classScheduleSlotId,
      startTime: session.classScheduleSlot?.startTime ?? null,
      entries: session.entries,
    })),
    new Map(lastPresences.map((item) => [item.studentId, item.attendanceSession.occurredOn]))
  )

  const sameDayCount = new Map<number, number>()
  for (const column of columns) {
    const key = column.occurredOn.getTime()
    sameDayCount.set(key, (sameDayCount.get(key) ?? 0) + 1)
  }
  const columnTime = (column: AttendanceGridColumn) =>
    (sameDayCount.get(column.occurredOn.getTime()) ?? 0) > 1 ? column.startTime : null
  const columnLabel = (column: AttendanceGridColumn) =>
    [shortDay.format(column.occurredOn), columnTime(column)].filter(Boolean).join(' ')
  const codes: Record<AttendanceEntryStatus, string> = {
    PRESENT: t('period.codePresent'),
    LATE: t('period.codeLate'),
    ABSENT: t('period.codeAbsent'),
    NOT_RECORDED: '·',
  }
  const absentAllRange = rows.filter(
    (row) => !row.lastPresentOn || row.lastPresentOn < range.from
  ).length
  const classId = selectedClass?.id
  const currentQuery = {
    range: range.preset,
    from: isoDay(range.from),
    to: isoDay(range.to),
    classId,
  }
  const lastPresence = (row: AttendanceGridRow) => {
    if (!row.lastPresentOn)
      return (
        <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-danger">
          {t('period.never')}
        </span>
      )
    const label = shortDay.format(row.lastPresentOn)
    return row.lastPresentOn < range.from ? (
      <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-danger">{label}</span>
    ) : (
      label
    )
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Breadcrumbs
          items={[
            { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
            { label: tBreadcrumbs('attendance') },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-graphite">{t('trackingTitle')}</h1>
          <p className="mt-1 text-sm text-graphite-600">
            {rangeLabel(range.from, range.to)}
            {selectedClass ? ` · ${selectedClass.name}` : ''}
            {period ? ` · ${period.name}` : ''}
          </p>
        </div>
        <AttendanceViewToggle
          current="period"
          dayHref={attendanceDayHref(teacherId ? undefined : classId)}
          periodHref={attendancePeriodHref(currentQuery)}
          labels={{
            group: t('period.view'),
            day: t('period.viewDay'),
            period: t('period.viewPeriod'),
          }}
        />
      </div>

      {!selectedClass ? (
        <EmptyState icon={CalendarDays} title={t('period.noClasses')} />
      ) : (
        <>
          <Card className="flex flex-wrap items-center gap-2 p-3 print:hidden">
            <AttendanceRangeMenu
              key={`${range.preset}|${currentQuery.from}|${currentQuery.to}`}
              current={range.preset}
              from={currentQuery.from}
              to={currentQuery.to}
              classId={classId}
              items={ATTENDANCE_RANGE_PRESETS.map((preset) => {
                const bounds = attendanceRangePreset(preset, today)
                return {
                  value: preset,
                  label: t(`period.presets.${preset}`),
                  dates: rangeLabel(bounds.from, bounds.to),
                }
              })}
              labels={{
                trigger: t('period.range'),
                dates: `${shortDay.format(range.from)} – ${shortDay.format(range.to)}`,
                custom: t('period.presets.custom'),
                from: t('period.from'),
                to: t('period.to'),
                apply: t('period.apply'),
              }}
            />
            {classes.length > 1 && (
              <AttendanceClassSelect
                key={classId}
                query={currentQuery}
                items={classes.map((item) => ({ value: item.id, label: item.name }))}
                label={t('class')}
              />
            )}
            {rows.length > 0 && (
              <div className="ml-auto">
                <AttendanceExportMenu
                  filename={`appel-${currentQuery.from}-${currentQuery.to}.csv`}
                  csv={attendanceGridCsv({
                    columns,
                    rows,
                    columnLabel,
                    dayLabel: (date) => shortDay.format(date),
                    codes,
                    headers: {
                      student: t('period.student'),
                      absences: t('period.absences'),
                      lates: t('period.lates'),
                      lastPresence: t('period.lastPresence'),
                      never: t('period.never'),
                    },
                  })}
                  labels={{
                    trigger: t('period.export'),
                    print: t('period.print'),
                    printHint: t('period.printHint'),
                    csv: t('period.csv'),
                    csvHint: t('period.csvHint'),
                  }}
                />
              </div>
            )}
          </Card>

          {rows.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={t('period.noSessions')}
              description={t('period.noSessionsHint')}
            />
          ) : (
            <section
              data-print-root
              aria-labelledby="attendance-period-heading"
              className="space-y-3"
            >
              <style>{PRINT_STYLES}</style>
              <div className="hidden print:block">
                <p className="text-lg font-bold text-graphite">
                  {t('period.printTitle', { className: selectedClass.name })}
                </p>
                <p className="text-sm text-graphite-600">
                  {rangeLabel(range.from, range.to)}
                  {period ? ` · ${period.name}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="attendance-period-heading" className="text-lg font-semibold text-graphite">
                  {t('period.sessions', { count: columns.length })}
                </h2>
                <p className="text-sm text-graphite-600">
                  {t('period.withoutPresence', { count: absentAllRange })}
                </p>
              </div>
              <Card className="overflow-x-auto p-0 print:overflow-visible print:border-0">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-alabaster-700 text-xs text-graphite-600">
                      <th
                        scope="col"
                        className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold"
                      >
                        {t('period.student')}
                      </th>
                      {columns.map((column) => (
                        <th key={column.sessionId} scope="col" className="px-1 py-2 font-semibold">
                          <Link
                            href={attendanceSessionHref({
                              classPeriodId: selectedClass.id,
                              day: isoDay(column.occurredOn),
                              occurrenceKey: column.occurrenceKey,
                              classScheduleSlotId: column.classScheduleSlotId,
                            })}
                            aria-label={t('period.openCall', {
                              date: longDay.format(column.occurredOn),
                            })}
                            className="block rounded px-1 leading-tight hover:bg-alabaster-800"
                          >
                            <span className="block capitalize">
                              {weekday.format(column.occurredOn)}
                            </span>
                            <span className="block text-graphite">
                              {dayNumber.format(column.occurredOn)}
                            </span>
                            {columnTime(column) && (
                              <span className="block">{columnTime(column)}</span>
                            )}
                          </Link>
                        </th>
                      ))}
                      <th scope="col" className="px-2 py-2 font-semibold">
                        {t('period.absencesShort')}
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                      >
                        {t('period.lastPresence')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.studentId}
                        className="border-b border-alabaster-800 last:border-0"
                      >
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-medium whitespace-nowrap text-graphite"
                        >
                          {row.studentName}
                        </th>
                        {row.cells.map((status, index) => (
                          <td key={columns[index].sessionId} className="px-1 py-1.5 text-center">
                            {status ? (
                              <span
                                title={t(`period.status.${status}`)}
                                className={`inline-flex size-6 items-center justify-center rounded text-xs font-bold ${CELL_TONE[status]}`}
                              >
                                {codes[status]}
                              </span>
                            ) : (
                              <span className="text-graphite-600">—</span>
                            )}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center font-semibold text-graphite">
                          {row.absences}
                        </td>
                        <td className="px-3 py-1.5 text-xs whitespace-nowrap text-graphite">
                          {lastPresence(row)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <p className="text-xs text-graphite-600">{t('period.legend')}</p>
            </section>
          )}
        </>
      )}
    </div>
  )
}
