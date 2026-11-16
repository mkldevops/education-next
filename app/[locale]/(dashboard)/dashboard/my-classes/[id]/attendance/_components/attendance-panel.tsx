'use client'

import { Button, Card } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import type { AttendanceEntryMode } from '@/domain/attendance-entry-mode'
import type { AttendanceFrequency } from '@/domain/attendance-frequency'
import { AttendanceActionsBar } from './attendance-actions-bar'
import type { Labels, Session, Slot } from './attendance-call-model'
import { AttendanceHeader } from './attendance-header'
import { AttendanceList } from './attendance-list'
import { AttendanceProgress } from './attendance-progress'
import { AttendanceReview } from './attendance-review'
import { OccurrencePicker } from './occurrence-picker'
import { RosterRefreshBar } from './roster-refresh-bar'
import type { AbsenceReasonOption, AttendanceStatus } from './student-attendance-card'
import { StudentStepper } from './student-stepper'
import { useAttendanceCall } from './use-attendance-call'

export function AttendancePanel({
  frequency = 'PER_SLOT',
  classPeriodId,
  className,
  occurredOn,
  locale,
  slots,
  selectedSlotId,
  selectedOccurrence,
  initialSession,
  returnHref,
  labels,
  entryMode = 'ONE_BY_ONE',
  absenceReasons = [],
  absenceReasonRequired = false,
}: {
  frequency?: AttendanceFrequency
  classPeriodId: string
  className: string
  occurredOn: string
  locale: string
  slots: Slot[]
  selectedSlotId?: string
  selectedOccurrence?: 'adhoc' | 'daily'
  initialSession: Session | null
  returnHref: string
  labels: Labels
  entryMode?: AttendanceEntryMode
  absenceReasons?: AbsenceReasonOption[]
  absenceReasonRequired?: boolean
}) {
  const t = useTranslations('dashboard.pages.attendance')
  const call = useAttendanceCall({
    classPeriodId,
    occurredOn,
    selectedSlotId,
    initialSession,
    returnHref,
    labels,
    entryMode,
    absenceReasons,
    absenceReasonRequired,
  })
  const { session, entries, active, reviewing, listView, editing } = call
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <AttendanceHeader
        labels={labels}
        className={className}
        frequency={frequency}
        locale={locale}
        occurredOn={occurredOn}
        selectedSlot={slots.find((slot) => slot.id === selectedSlotId)}
        selectedOccurrence={selectedOccurrence}
        showDateForm={call.showDateForm}
        globalPending={call.globalPending}
        onToggleDateForm={call.toggleDateForm}
        onDateSubmit={call.submitDateForm}
      />
      {call.globalError ? (
        <p role="alert" className="text-sm text-red-700">
          {call.globalError}
        </p>
      ) : null}
      {frequency !== 'DAILY' && !selectedSlotId && !selectedOccurrence ? (
        <OccurrencePicker
          labels={labels}
          classPeriodId={classPeriodId}
          occurredOn={occurredOn}
          slots={slots}
        />
      ) : !session ? (
        <Button onClick={call.start} disabled={call.globalPending}>
          {frequency !== 'DAILY' && selectedOccurrence ? labels.startExceptional : labels.start}
        </Button>
      ) : session.status === 'CANCELLED' ? (
        <Card className="p-4">
          <p role="status">{labels.errors.sessionCancelled}</p>
        </Card>
      ) : (
        <>
          {!reviewing && entryMode === 'LIST' && session.status === 'DRAFT' ? (
            <RosterRefreshBar
              className="mx-auto flex max-w-2xl flex-wrap items-center gap-2"
              disabled={call.blocked}
              notice={call.rosterNotice}
              onRefresh={() => void call.refreshRoster()}
            />
          ) : null}
          {!reviewing && !listView ? (
            <AttendanceProgress
              labels={labels}
              status={session.status}
              counts={call.counts}
              recorded={call.recorded}
              total={entries.length}
              editing={editing}
              blocked={call.blocked}
              rosterNotice={call.rosterNotice}
              onRefreshRoster={() => void call.refreshRoster()}
              onMarkRemainingPresent={call.markRemainingPresent}
            />
          ) : null}
          {entries.length === 0 ? (
            <Card className="p-6 text-center text-graphite-600">{labels.noStudents}</Card>
          ) : listView && !reviewing ? (
            <AttendanceList
              entries={entries}
              labels={labels}
              editing={editing}
              pending={call.pending}
              globalPending={call.globalPending}
              errors={call.errors}
              reasonPicker={call.reasonPicker}
              reasonRequired={absenceReasonRequired}
              onStatus={(id, status) => {
                call.updateDraft(id, { status })
                void call.save(id)
              }}
              onReason={call.chooseReason}
              onLateMinutes={(id, minutes) => {
                call.updateDraft(id, { lateMinutes: minutes })
                call.scheduleSave(id)
              }}
              onMessage={(id, message) => {
                call.updateDraft(id, { message: message || null })
                call.scheduleSave(id)
              }}
              onFieldBlur={call.saveNow}
              onRetry={(id) => {
                void call.save(id)
              }}
              onMarkRemaining={call.markRemainingPresent}
              onReview={call.startReview}
              canFinish={!call.blocked}
            />
          ) : active && !reviewing ? (
            <StudentStepper
              labels={labels}
              index={call.index}
              total={entries.length}
              forward={call.forward}
              globalPending={call.globalPending}
              onMove={(next) => void call.move(next)}
              card={{
                entry: active,
                editing,
                pending: call.pending.has(active.id),
                error: call.errors[active.id],
                saved: call.isSaved(active),
                inputRef: (node) => {
                  call.control.current = node
                },
                onStatus: (status: AttendanceStatus) => {
                  call.updateDraft(active.id, {
                    status,
                    lateMinutes: status === 'LATE' ? active.lateMinutes : null,
                  })
                  void call.save(active.id)
                },
                onLateMinutes: (value) => {
                  call.updateDraft(active.id, { lateMinutes: value })
                  call.scheduleSave(active.id)
                },
                onMessage: (message) => {
                  call.updateDraft(active.id, { message: message || null })
                  call.scheduleSave(active.id)
                },
                onFieldBlur: () => call.saveNow(active.id),
                onRetry: () => {
                  void call.save(active.id)
                },
                reasonPicker: call.reasonPicker,
                onReason: (reason) => call.chooseReason(active.id, reason),
              }}
            />
          ) : null}
          {!reviewing && (!listView || !editing) ? (
            <AttendanceActionsBar
              labels={labels}
              validated={session.status === 'VALIDATED' && !editing}
              listView={listView}
              reviewDisabled={call.globalPending || call.pendingEntries || call.entryErrors}
              onCorrect={call.startEditing}
              onReview={call.startReview}
            />
          ) : null}
          {reviewing ? (
            <div ref={call.review} tabIndex={-1} className="scroll-mt-28 focus:outline-none">
              <AttendanceReview
                entries={entries}
                labels={labels}
                validated={session.status === 'VALIDATED' && !editing}
                returnHref={returnHref}
                missingReasonsWarning={
                  absenceReasonRequired ? t('reasons.missingWarning') : undefined
                }
                onCorrect={call.correct}
                onReturn={call.stopReview}
                onComplete={call.completeMissing}
                onEdit={call.editEntry}
                validating={
                  call.leaving || call.globalPending || call.pendingEntries || call.entryErrors
                }
                onValidate={call.validate}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
