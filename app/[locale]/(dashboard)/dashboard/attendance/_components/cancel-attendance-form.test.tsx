import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ButtonHTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cancelAttendanceOccurrenceActionMock, refresh, setAttendanceCancellationActionMock } =
  vi.hoisted(() => ({
    cancelAttendanceOccurrenceActionMock: vi.fn(),
    refresh: vi.fn(),
    setAttendanceCancellationActionMock: vi.fn(),
  }))

vi.mock('@peaklab/ui', async () => {
  const { cloneElement, useState } = await import('react')
  return {
    Button: (props: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
    ConfirmDialog: ({
      trigger,
      title,
      confirmLabel,
      cancelLabel,
      onConfirm,
    }: {
      trigger: React.ReactElement<{ onClick?: () => void }>
      title: string
      confirmLabel: string
      cancelLabel: string
      onConfirm: () => Promise<void>
    }) => {
      const [open, setOpen] = useState(false)
      return (
        <>
          {cloneElement(trigger, { onClick: () => setOpen(true) })}
          {open ? (
            <div role="dialog" aria-label={title}>
              <button type="button" onClick={() => setOpen(false)}>
                {cancelLabel}
              </button>
              <button type="button" onClick={() => void onConfirm().then(() => setOpen(false))}>
                {confirmLabel}
              </button>
            </div>
          ) : null}
        </>
      )
    },
  }
})

vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh }) }))

vi.mock('../../../_lib/attendance-actions', () => ({
  cancelAttendanceOccurrenceAction: cancelAttendanceOccurrenceActionMock,
  setAttendanceCancellationAction: setAttendanceCancellationActionMock,
}))

import { CancelAttendanceForm, CancelOccurrenceForm } from './cancel-attendance-form'

const confirmation = {
  title: 'Cancel this session?',
  description: 'Expected calls will no longer include it.',
  confirmLabel: 'Yes, cancel',
  cancelLabel: 'Keep session',
}

const errors = {
  validationError: 'Check the selected occurrence.',
  notFound: 'This occurrence no longer exists.',
  attendanceDisabled: 'Attendance is disabled.',
  sessionCancelled: 'This session is cancelled.',
  unexpected: 'Something went wrong. Try again.',
}

describe('attendance cancellation forms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps a typed cancellation failure visible instead of reporting a success', async () => {
    setAttendanceCancellationActionMock.mockResolvedValue('notFound')
    render(
      <CancelAttendanceForm
        sessionId="00000000-0000-4000-8000-000000000001"
        cancelled
        label="Cancel session"
        pendingLabel="Cancelling session"
        errors={errors}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel session' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(errors.notFound)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('shows a pending restore and refreshes the tracking list only after success', async () => {
    let resolveAction: (result: 'OK') => void = () => undefined
    setAttendanceCancellationActionMock.mockImplementation(
      () => new Promise<'OK'>((resolve) => (resolveAction = resolve))
    )
    render(
      <CancelAttendanceForm
        sessionId="00000000-0000-4000-8000-000000000001"
        cancelled={false}
        label="Restore session"
        pendingLabel="Restoring session"
        errors={errors}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Restore session' }))
    expect(await screen.findByRole('button', { name: 'Restoring session' })).toBeDisabled()
    expect(setAttendanceCancellationActionMock).toHaveBeenCalledWith({
      sessionId: '00000000-0000-4000-8000-000000000001',
      cancelled: false,
    })
    expect(refresh).not.toHaveBeenCalled()

    resolveAction('OK')
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('refreshes the list after successfully cancelling an unopened scheduled occurrence', async () => {
    cancelAttendanceOccurrenceActionMock.mockResolvedValue('OK')
    const occurredOn = new Date('2026-09-17T00:00:00.000Z')
    render(
      <CancelOccurrenceForm
        classPeriodId="00000000-0000-4000-8000-000000000001"
        classScheduleSlotId="00000000-0000-4000-8000-000000000002"
        occurredOn={occurredOn}
        label="Cancel session"
        pendingLabel="Cancelling session"
        errors={errors}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel session' }))

    await waitFor(() =>
      expect(cancelAttendanceOccurrenceActionMock).toHaveBeenCalledWith({
        classPeriodId: '00000000-0000-4000-8000-000000000001',
        classScheduleSlotId: '00000000-0000-4000-8000-000000000002',
        occurredOn,
      })
    )
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
  })

  it('turns a rejected cancellation request into a translated retryable error', async () => {
    cancelAttendanceOccurrenceActionMock.mockRejectedValue(new Error('network down'))
    render(
      <CancelOccurrenceForm
        classPeriodId="00000000-0000-4000-8000-000000000001"
        classScheduleSlotId="00000000-0000-4000-8000-000000000002"
        occurredOn={new Date('2026-09-17T00:00:00.000Z')}
        label="Cancel session"
        pendingLabel="Cancelling session"
        errors={errors}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel session' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(errors.unexpected)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('asks for confirmation before cancelling a scheduled occurrence', async () => {
    cancelAttendanceOccurrenceActionMock.mockResolvedValue('OK')
    render(
      <CancelOccurrenceForm
        classPeriodId="00000000-0000-4000-8000-000000000001"
        classScheduleSlotId="00000000-0000-4000-8000-000000000002"
        occurredOn={new Date('2026-09-17T00:00:00.000Z')}
        label="Cancel session"
        pendingLabel="Cancelling session"
        errors={errors}
        confirmation={confirmation}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel session' }))
    expect(screen.getByRole('dialog', { name: confirmation.title })).toBeInTheDocument()
    expect(cancelAttendanceOccurrenceActionMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: confirmation.cancelLabel }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cancelAttendanceOccurrenceActionMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel session' }))
    fireEvent.click(screen.getByRole('button', { name: confirmation.confirmLabel }))
    await waitFor(() => expect(cancelAttendanceOccurrenceActionMock).toHaveBeenCalledOnce())
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
  })

  it('keeps a failed confirmed cancellation visible', async () => {
    setAttendanceCancellationActionMock.mockResolvedValue('notFound')
    render(
      <CancelAttendanceForm
        sessionId="00000000-0000-4000-8000-000000000001"
        cancelled
        label="Cancel session"
        pendingLabel="Cancelling session"
        errors={errors}
        confirmation={confirmation}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel session' }))
    fireEvent.click(screen.getByRole('button', { name: confirmation.confirmLabel }))

    expect(await screen.findByRole('alert')).toHaveTextContent(errors.notFound)
    expect(refresh).not.toHaveBeenCalled()
  })
})
