import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ArchiveStudentDialog } from './archive-student-dialog'

const { archiveStudentAction, previewStudentArchiveAction, push } = vi.hoisted(() => ({
  archiveStudentAction: vi.fn(),
  previewStudentArchiveAction: vi.fn(),
  push: vi.fn(),
}))

vi.mock('next-intl', () => {
  const t = Object.assign((key: string) => key, { has: () => true })
  return { useLocale: () => 'fr', useTranslations: () => t }
})
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push }) }))
vi.mock('../../../_lib/student-actions', () => ({
  archiveStudentAction,
  previewStudentArchiveAction,
}))

const studentId = '550e8400-e29b-41d4-a716-446655440000'
const preview = (remaining: number) => ({
  months: ['2026-09', '2026-10', '2026-11', '2026-12'],
  defaultMonth: '2026-11',
  endMonth: '2026-11',
  currency: 'EUR',
  openEnrollments: 1,
  owed: 300,
  paid: 300 - remaining,
  remaining,
  prorated: true,
})

async function open() {
  render(<ArchiveStudentDialog studentId={studentId} studentName="Yanis Parti" />)
  fireEvent.click(screen.getByRole('button', { name: 'trigger' }))
  await screen.findByText('remaining')
  await waitFor(() => expect(screen.getByRole('button', { name: 'confirm' })).toBeEnabled())
}

describe('ArchiveStudentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    archiveStudentAction.mockResolvedValue('OK')
  })

  it('keeps the remainder by default and archives through the default month', async () => {
    previewStudentArchiveAction.mockResolvedValue(preview(150))
    await open()

    expect(previewStudentArchiveAction).toHaveBeenCalledTimes(1)
    expect(previewStudentArchiveAction).toHaveBeenCalledWith(studentId, undefined)
    expect(screen.getByRole('radio', { name: 'remainders.keep' })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() =>
      expect(archiveStudentAction).toHaveBeenCalledWith({
        studentId,
        endMonth: '2026-11',
        remainder: 'keep',
        reason: undefined,
      })
    )
    expect(push).toHaveBeenCalledWith('/dashboard/students')
  })

  it('requires a reason before writing the remainder off', async () => {
    previewStudentArchiveAction.mockResolvedValue(preview(150))
    await open()

    fireEvent.click(screen.getByRole('radio', { name: 'remainders.writeOff' }))
    expect(screen.getByRole('button', { name: 'confirm' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('reason'), { target: { value: 'Déménagement' } })
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() =>
      expect(archiveStudentAction).toHaveBeenCalledWith(
        expect.objectContaining({ remainder: 'writeOff', reason: 'Déménagement' })
      )
    )
  })

  it('offers no remainder choice when nothing stays owed', async () => {
    previewStudentArchiveAction.mockResolvedValue(preview(0))
    await open()

    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('keeps the dialog open when the archive is refused', async () => {
    previewStudentArchiveAction.mockResolvedValue(preview(0))
    archiveStudentAction.mockResolvedValue('endMonthOutsidePeriod')
    await open()

    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(archiveStudentAction).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
