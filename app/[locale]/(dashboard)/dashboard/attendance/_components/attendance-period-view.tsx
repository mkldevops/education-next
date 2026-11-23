import { Breadcrumbs, Card, EmptyState } from '@peaklab/ui'
import { CalendarDays } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import {
  attendanceCallPlan,
  type ClassCallState,
  classCallState,
  compareClassCallState,
  type PlannedCall,
} from '@/domain/attendance-calls'
import type { AttendanceFrequency } from '@/domain/attendance-frequency'
import {
  type AttendanceGridColumn,
  type AttendanceGridColumnState,
  type AttendanceGridRow,
  buildAttendanceGrid,
  countWithoutPresence,
} from '@/domain/attendance-grid'
import {
  ATTENDANCE_RANGE_PRESETS,
  attendanceRangePreset,
  resolveAttendanceRange,
} from '@/domain/attendance-range'
import { attendanceRosterWindow } from '@/domain/attendance-session'
import { attendanceClassPeriodScope } from '@/domain/attendance-tracking-scope'
import type { AttendanceEntryStatus } from '@/generated/prisma/client'
import { Link } from '@/i18n/routing'
import { db } from '@/lib/db'
import { attendanceGridCsv } from '../_lib/attendance-grid-csv'
import { AttendanceColumnMenu } from './attendance-column-menu'
import { AttendanceExportMenu } from './attendance-export-menu'
import { AttendanceGapsSwitch } from './attendance-gaps-switch'
import { AttendanceNewCall } from './attendance-new-call'
import { attendancePeriodHref, attendanceSessionHref } from './attendance-period-href'
import { AttendanceRangeMenu } from './attendance-range-menu'
import { CancelAttendanceForm, CancelOccurrenceForm } from './cancel-attendance-form'

const ATTENDED: AttendanceEntryStatus[] = ['PRESENT', 'LATE']
const PENDING_PREVIEW = 4

const CELL_TONE: Record<AttendanceEntryStatus, string> = {
  PRESENT: 'bg-success-subtle text-success',
  LATE: 'bg-warning-subtle text-warning',
  ABSENT: 'bg-danger-subtle text-danger',
  NOT_RECORDED: 'text-graphite-600',
}

const DOT_TONE: Record<AttendanceEntryStatus, string> = {
  PRESENT: 'bg-success',
  LATE: 'bg-warning',
  ABSENT: 'bg-danger',
  NOT_RECORDED: 'bg-alabaster-600',
}

const COLUMN_TONE: Record<AttendanceGridColumnState, string> = {
  VALIDATED: 'text-graphite-600 hover:bg-alabaster-800',
  DRAFT: 'bg-info-subtle text-info',
  missed: 'bg-danger-subtle text-danger',
  todo: 'bg-warning-subtle text-warning',
  CANCELLED: 'text-graphite-600 line-through',
}

const CHIP_DOT: Record<ClassCallState, string> = {
  late: 'bg-danger',
  todo: 'bg-warning',
  done: 'bg-success',
  none: 'bg-alabaster-600',
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

function utcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function shiftDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days))
}

/**
 * Suivi des appels d'une classe sur une période : une colonne par appel tenu ou attendu, les appels
 * oubliés et ceux du jour en couleur pour être faits depuis la grille. Les pastilles de classe
 * font passer devant les classes qui attendent un appel.
 */
export async function AttendancePeriodView({
  locale,
  schoolId,
  teacherId,
  admin,
  frequency,
  period,
  query,
}: {
  locale: string
  schoolId: string
  teacherId: string | null
  admin: boolean
  frequency: AttendanceFrequency
  period: { id: string; name: string } | null
  query: { range?: string; from?: string; to?: string; classId?: string; all?: boolean }
}) {
  const [t, tAttendance, tBreadcrumbs] = await Promise.all([
    getTranslations('dashboard.pages.attendance.period'),
    getTranslations('dashboard.pages.attendance'),
    getTranslations('dashboard.breadcrumbs'),
  ])
  const now = new Date()
  const today = utcDay(now)
  const range = resolveAttendanceRange(query, now)
  const showGaps = query.all === true
  const longDay = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' })
  const fullDay = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' })
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
  const classIds = classes.map((item) => item.id)
  const windowStart = new Date(Math.min(range.from.getTime(), today.getTime()))
  const windowEnd = new Date(Math.max(range.to.getTime(), today.getTime()))
  const [slots, plannedSessions, closures, firstSessions] =
    classIds.length > 0
      ? await Promise.all([
          db.classScheduleSlot.findMany({
            where: { schoolId, classPeriodId: { in: classIds } },
            select: { id: true, classPeriodId: true, weekday: true, startTime: true },
            orderBy: { startTime: 'asc' },
          }),
          db.attendanceSession.findMany({
            where: {
              schoolId,
              classPeriodId: { in: classIds },
              OR: [{ occurredOn: { gte: range.from, lte: range.to } }, { occurredOn: today }],
            },
            select: { classPeriodId: true, occurredOn: true, occurrenceKey: true, status: true },
          }),
          db.event.findMany({
            where: {
              schoolId,
              isActive: true,
              status: 'PUBLISHED',
              category: 'CLOSURE',
              startAt: { lt: shiftDays(windowEnd, 1) },
              OR: [{ endAt: null }, { endAt: { gte: windowStart } }],
            },
            select: { status: true, category: true, startAt: true, endAt: true },
          }),
          db.attendanceSession.groupBy({
            by: ['classPeriodId'],
            where: { schoolId, classPeriodId: { in: classIds }, status: { not: 'CANCELLED' } },
            _min: { occurredOn: true },
          }),
        ])
      : [[], [], [], []]
  const trackedSince = new Map<string, Date>()
  for (const item of firstSessions)
    if (item._min.occurredOn) trackedSince.set(item.classPeriodId, item._min.occurredOn)
  const { planned, summaries } = attendanceCallPlan({
    from: range.from,
    to: range.to,
    today: now,
    slots,
    sessions: plannedSessions,
    closures,
    frequency,
    trackedSince,
  })

  const chips = classes
    .map((item) => {
      const summary = summaries.get(item.id)
      return { ...item, summary, state: classCallState(summary) }
    })
    .sort(compareClassCallState)
  const selectedClass = chips.find((item) => item.id === query.classId) ?? chips[0]
  const classId = selectedClass?.id
  const currentQuery = {
    range: range.preset,
    from: isoDay(range.from),
    to: isoDay(range.to),
    classId,
    all: showGaps,
  }
  const totals = chips.reduce(
    (sum, item) => ({
      expected: sum.expected + (item.summary?.todayExpected ?? 0),
      done: sum.done + (item.summary?.todayDone ?? 0),
      late: sum.late + (item.summary?.late ?? 0),
    }),
    { expected: 0, done: 0, late: 0 }
  )

  const sessions = selectedClass
    ? await db.attendanceSession.findMany({
        where: {
          schoolId,
          classPeriodId: selectedClass.id,
          occurredOn: { gte: range.from, lte: range.to },
        },
        select: {
          id: true,
          occurredOn: true,
          occurrenceKey: true,
          classScheduleSlotId: true,
          status: true,
          classScheduleSlot: { select: { startTime: true } },
          entries: { select: { studentId: true, studentName: true, status: true } },
        },
      })
    : []
  const studentIds = [
    ...new Set(
      sessions
        .filter((session) => session.status !== 'CANCELLED')
        .flatMap((session) => session.entries.map((entry) => entry.studentId))
    ),
  ]
  // Élèves inscrits dans la classe sur la plage : un élève parti reste dans les séances passées
  // mais ne compte plus parmi les élèves sans présence. Une archive antérieure à `archiveStudent`
  // a laissé l'affectation ouverte ; seul `leftAt` la date.
  const enrolledAssignments =
    selectedClass && studentIds.length > 0
      ? await db.classAssignment.findMany({
          where: {
            schoolId,
            classPeriodId: selectedClass.id,
            startAt: { lt: attendanceRosterWindow(range.to).startsBefore },
            OR: [{ endAt: null }, { endAt: { gte: attendanceRosterWindow(range.from).endsFrom } }],
            enrollment: {
              schoolId,
              studentId: { in: studentIds },
              status: { in: ['ACTIVE', 'COMPLETED'] },
              student: { OR: [{ isActive: true }, { leftAt: { gte: range.from } }] },
            },
          },
          select: { enrollment: { select: { studentId: true } } },
        })
      : []
  const enrolledStudentIds = new Set(
    enrolledAssignments.map((assignment) => assignment.enrollment.studentId)
  )
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
  const classPlanned = planned.filter((call) => call.classPeriodId === classId)
  const grid = buildAttendanceGrid(
    sessions.map((session) => ({
      id: session.id,
      occurredOn: session.occurredOn,
      occurrenceKey: session.occurrenceKey,
      classScheduleSlotId: session.classScheduleSlotId,
      startTime: session.classScheduleSlot?.startTime ?? null,
      status: session.status,
      entries: session.entries,
    })),
    new Map(lastPresences.map((item) => [item.studentId, item.attendanceSession.occurredOn])),
    classPlanned
  )
  const visibleIndexes = grid.columns.flatMap((column, index) =>
    showGaps || (column.sessionId !== null && column.state !== 'CANCELLED') ? [index] : []
  )
  const columns = visibleIndexes.map((index) => grid.columns[index])
  const rows = grid.rows.map((row) => ({
    ...row,
    cells: visibleIndexes.map((index) => row.cells[index]),
  }))
  const gapCount = grid.columns.filter(
    (column) => column.sessionId === null || column.state === 'CANCELLED'
  ).length
  const gapsToggle = gapCount > 0 && (
    <AttendanceGapsSwitch
      checked={showGaps}
      href={attendancePeriodHref({ ...currentQuery, all: !showGaps })}
      label={t('showGaps', { count: gapCount })}
    />
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
  const columnHref = (column: {
    occurredOn: Date
    occurrenceKey: string
    classScheduleSlotId: string | null
  }) =>
    attendanceSessionHref({
      classPeriodId: classId ?? '',
      day: isoDay(column.occurredOn),
      occurrenceKey: column.occurrenceKey,
      classScheduleSlotId: column.classScheduleSlotId,
    })
  const codes: Record<AttendanceEntryStatus, string> = {
    PRESENT: t('codePresent'),
    LATE: t('codeLate'),
    ABSENT: t('codeAbsent'),
    NOT_RECORDED: '·',
  }
  const absentAllRange = countWithoutPresence(rows, range.from, enrolledStudentIds)
  const errorLabels = {
    validationError: tAttendance('errors.validationError'),
    notFound: tAttendance('errors.notFound'),
    attendanceDisabled: tAttendance('errors.attendanceDisabled'),
    sessionCancelled: tAttendance('errors.sessionCancelled'),
    invalidTransition: tAttendance('errors.invalidTransition'),
    unexpected: tAttendance('errors.unexpected'),
  }
  const cancelConfirmation = {
    title: tAttendance('cancelDialog.title'),
    description: tAttendance('cancelDialog.description'),
    confirmLabel: tAttendance('cancelDialog.confirm'),
    cancelLabel: tAttendance('cancelDialog.dismiss'),
  }
  const lastPresence = (row: AttendanceGridRow) => {
    if (!enrolledStudentIds.has(row.studentId))
      return row.lastPresentOn ? shortDay.format(row.lastPresentOn) : t('never')
    if (!row.lastPresentOn)
      return (
        <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-danger">{t('never')}</span>
      )
    const label = shortDay.format(row.lastPresentOn)
    return row.lastPresentOn < range.from ? (
      <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-danger">{label}</span>
    ) : (
      label
    )
  }
  const columnMenu = (column: AttendanceGridColumn) => {
    if (!admin || !classId) return null
    const label = t('columnMenu', { date: longDay.format(column.occurredOn) })
    if (column.sessionId)
      return (
        <AttendanceColumnMenu label={label}>
          <CancelAttendanceForm
            sessionId={column.sessionId}
            cancelled={column.state !== 'CANCELLED'}
            label={tAttendance(column.state === 'CANCELLED' ? 'restore' : 'cancel')}
            pendingLabel={tAttendance(
              column.state === 'CANCELLED' ? 'restorePending' : 'cancellationPending'
            )}
            errors={errorLabels}
            confirmation={column.state === 'CANCELLED' ? undefined : cancelConfirmation}
          />
        </AttendanceColumnMenu>
      )
    if (!column.classScheduleSlotId) return null
    return (
      <AttendanceColumnMenu label={label}>
        <CancelOccurrenceForm
          classPeriodId={classId}
          classScheduleSlotId={column.classScheduleSlotId}
          occurredOn={column.occurredOn}
          label={tAttendance('cancel')}
          pendingLabel={tAttendance('cancellationPending')}
          errors={errorLabels}
          confirmation={cancelConfirmation}
        />
      </AttendanceColumnMenu>
    )
  }
  const pendingCalls = [...classPlanned].sort(
    (a, b) => b.occurredOn.getTime() - a.occurredOn.getTime()
  )
  const pendingStrip = (call: PlannedCall) => (
    <Link
      key={`${isoDay(call.occurredOn)}:${call.occurrenceKey}`}
      href={columnHref(call)}
      className={`inline-flex min-h-11 items-center gap-2 rounded px-3 text-sm font-semibold ${COLUMN_TONE[call.state]}`}
    >
      {shortDay.format(call.occurredOn)}
      {frequency === 'PER_SLOT' && call.startTime ? ` ${call.startTime}` : ''}
      <span className="font-normal">· {t(call.state === 'todo' ? 'takeCall' : 'catchUp')}</span>
    </Link>
  )

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
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-graphite">{tAttendance('trackingTitle')}</h1>
        <p className="mt-1 text-sm text-graphite-600">
          <span className="capitalize">{fullDay.format(today)}</span>
          {' · '}
          {t('todayStatus', { done: totals.done, expected: totals.expected })}
          {totals.late > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-danger">
                {t('lateCalls', { count: totals.late })}
              </span>
            </>
          )}
          {period ? ` · ${period.name}` : ''}
        </p>
      </div>

      {!selectedClass ? (
        <EmptyState icon={CalendarDays} title={t('noClasses')} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <AttendanceRangeMenu
              key={`${range.preset}|${currentQuery.from}|${currentQuery.to}`}
              current={range.preset}
              from={currentQuery.from}
              to={currentQuery.to}
              classId={classId}
              all={showGaps}
              items={ATTENDANCE_RANGE_PRESETS.map((preset) => {
                const bounds = attendanceRangePreset(preset, now)
                return {
                  value: preset,
                  label: t(`presets.${preset}`),
                  dates: rangeLabel(bounds.from, bounds.to),
                }
              })}
              labels={{
                trigger: t('range'),
                dates: `${shortDay.format(range.from)} – ${shortDay.format(range.to)}`,
                custom: t('presets.custom'),
                from: t('from'),
                to: t('to'),
                apply: t('apply'),
              }}
            />
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
                      student: t('student'),
                      absences: t('absences'),
                      lates: t('lates'),
                      lastPresence: t('lastPresence'),
                      never: t('never'),
                    },
                  })}
                  labels={{
                    trigger: t('export'),
                    print: t('print'),
                    printHint: t('printHint'),
                    csv: t('csv'),
                    csvHint: t('csvHint'),
                  }}
                />
              </div>
            )}
          </div>

          {chips.length > 1 && (
            <nav aria-label={t('classes')} className="print:hidden">
              <ul className="flex flex-wrap gap-2">
                {chips.map((chip) => {
                  const current = chip.id === classId
                  return (
                    <li key={chip.id}>
                      <Link
                        href={attendancePeriodHref({ ...currentQuery, classId: chip.id })}
                        aria-current={current ? 'page' : undefined}
                        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${
                          current
                            ? 'border-graphite bg-graphite text-white'
                            : 'border-alabaster-600 bg-white text-graphite hover:bg-alabaster-800'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`size-2 rounded-full ${CHIP_DOT[chip.state]}`}
                        />
                        {chip.name}
                        {chip.state !== 'none' && (
                          <span
                            className={`text-xs font-normal ${current ? 'text-alabaster-800' : 'text-graphite-600'}`}
                          >
                            {t(`chip.${chip.state}`, { count: chip.summary?.late ?? 0 })}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          )}

          <section
            data-print-root
            aria-labelledby="attendance-period-heading"
            className="space-y-3"
          >
            <style>{PRINT_STYLES}</style>
            <div className="hidden print:block">
              <p className="text-lg font-bold text-graphite">
                {t('printTitle', { className: selectedClass.name })}
              </p>
              <p className="text-sm text-graphite-600">
                {rangeLabel(range.from, range.to)}
                {period ? ` · ${period.name}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div>
                <h2 id="attendance-period-heading" className="text-lg font-semibold text-graphite">
                  {selectedClass.name}
                </h2>
                <p className="text-sm text-graphite-600">
                  {t('sessions', {
                    count: grid.columns.filter((column) => column.sessionId !== null).length,
                  })}
                  {rows.length > 0 && ` · ${t('withoutPresence', { count: absentAllRange })}`}
                </p>
              </div>
              <AttendanceNewCall
                classPeriodId={selectedClass.id}
                today={isoDay(today)}
                labels={{
                  trigger: t('newCall'),
                  date: t('newCallDate'),
                  open: t('newCallOpen'),
                  hint: t('newCallHint'),
                }}
              />
            </div>

            {pendingCalls.length > 0 && (
              <div
                className={`space-y-2 print:hidden ${showGaps && rows.length > 0 ? 'sm:hidden' : ''}`}
              >
                <p className="text-sm font-semibold text-graphite">
                  {t('pendingTitle', { count: pendingCalls.length })}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {pendingCalls.slice(0, PENDING_PREVIEW).map(pendingStrip)}
                  {pendingCalls.length > PENDING_PREVIEW && (
                    <Link
                      href={attendancePeriodHref({ ...currentQuery, all: true })}
                      className="text-sm text-graphite-600 hover:underline"
                    >
                      {t('pendingMore', { count: pendingCalls.length - PENDING_PREVIEW })}
                    </Link>
                  )}
                </div>
              </div>
            )}

            {columns.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title={t('noSessions')}
                description={t('noSessionsHint')}
              />
            ) : rows.length === 0 ? (
              <p className="text-sm text-graphite-600">{t('noStudentsYet')}</p>
            ) : (
              <>
                <ul className="divide-y divide-alabaster-800 rounded border border-alabaster-700 bg-white sm:hidden print:hidden">
                  {rows.map((row) => (
                    <li key={row.studentId} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-graphite">{row.studentName}</p>
                        <p className="mt-1 flex gap-0.5" aria-hidden="true">
                          {row.cells.slice(-12).map((status, index) => (
                            <span
                              // biome-ignore lint/suspicious/noArrayIndexKey: cells follow the fixed column order
                              key={index}
                              className={`size-2.5 rounded-sm ${status ? DOT_TONE[status] : 'bg-alabaster-800'}`}
                            />
                          ))}
                        </p>
                      </div>
                      <div className="text-right text-xs text-graphite">
                        <p className="font-semibold">
                          {row.absences} {t('absencesShort')}
                        </p>
                        <p className="mt-1">{lastPresence(row)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Card className="hidden overflow-x-auto p-0 sm:block print:block print:overflow-visible print:border-0">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-alabaster-700 text-xs text-graphite-600">
                        <th
                          scope="col"
                          className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold"
                        >
                          {t('student')}
                        </th>
                        {columns.map((column) => {
                          const content = (
                            <>
                              <span className="block capitalize">
                                {weekday.format(column.occurredOn)}
                              </span>
                              <span className="block text-graphite">
                                {dayNumber.format(column.occurredOn)}
                              </span>
                              {columnTime(column) && (
                                <span className="block">{columnTime(column)}</span>
                              )}
                            </>
                          )
                          return (
                            <th
                              key={column.key}
                              scope="col"
                              className="group/column px-0.5 py-2 align-top font-semibold"
                            >
                              {column.state === 'CANCELLED' ? (
                                <span
                                  title={t('cancelledColumn')}
                                  className={`block rounded px-1 leading-tight ${COLUMN_TONE.CANCELLED}`}
                                >
                                  {content}
                                </span>
                              ) : (
                                <Link
                                  href={columnHref(column)}
                                  aria-label={t(
                                    column.state === 'missed'
                                      ? 'catchUpCall'
                                      : column.state === 'todo'
                                        ? 'takeCallOn'
                                        : 'openCall',
                                    { date: longDay.format(column.occurredOn) }
                                  )}
                                  className={`block rounded px-1 leading-tight ${COLUMN_TONE[column.state]}`}
                                >
                                  {content}
                                </Link>
                              )}
                              {columnMenu(column)}
                            </th>
                          )
                        })}
                        <th scope="col" className="px-2 py-2 font-semibold">
                          {t('absencesShort')}
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                        >
                          {t('lastPresence')}
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
                          {row.cells.map((status, index) => {
                            const column = columns[index]
                            return (
                              <td
                                key={column.key}
                                className={`px-1 py-1.5 text-center ${column.state === 'CANCELLED' ? 'bg-alabaster-800' : ''}`}
                              >
                                {status ? (
                                  <span
                                    title={t(`status.${status}`)}
                                    className={`inline-flex size-6 items-center justify-center rounded text-xs font-bold ${CELL_TONE[status]}`}
                                  >
                                    {codes[status]}
                                  </span>
                                ) : column.state === 'missed' ? (
                                  <span title={t('missedCell')} className="font-bold text-danger">
                                    ?
                                  </span>
                                ) : column.state === 'todo' ? (
                                  <span className="text-warning">·</span>
                                ) : (
                                  <span className="text-graphite-600">—</span>
                                )}
                              </td>
                            )
                          })}
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
              </>
            )}
            {(rows.length > 0 || gapsToggle) && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                {rows.length > 0 ? (
                  <p className="text-xs text-graphite-600">{t('legend')}</p>
                ) : (
                  <span />
                )}
                {gapsToggle}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
