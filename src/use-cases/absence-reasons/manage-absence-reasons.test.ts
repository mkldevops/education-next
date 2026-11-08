import { describe, expect, it, vi } from 'vitest'
import {
  archiveAbsenceReason,
  createAbsenceReason,
  MAX_ABSENCE_REASONS,
  reorderAbsenceReasons,
  updateAbsenceReason,
} from './manage-absence-reasons'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'

function gatewaySpy(
  rows = [
    { id: A, label: 'Maladie', justified: true, position: 0 },
    { id: B, label: 'Sans nouvelles', justified: false, position: 1 },
  ]
) {
  return {
    listActive: vi.fn(async () => rows),
    findActive: vi.fn(),
    create: vi.fn(async (_schoolId: string, data: object) => ({ id: 'new', ...data })),
    update: vi.fn(async () => 1),
    archive: vi.fn(async () => 1),
    reorder: vi.fn(async () => []),
    createDefaults: vi.fn(),
  }
}
type Gateway = Parameters<typeof createAbsenceReason>[1]

describe('createAbsenceReason', () => {
  it('appends a normalized reason after the last position of the school', async () => {
    const gateway = gatewaySpy()
    const result = await createAbsenceReason(
      { schoolId: 's', label: '  Rendez-vous   médical ', justified: true },
      gateway as unknown as Gateway
    )
    expect(result).toMatchObject({ label: 'Rendez-vous médical', position: 2 })
    expect(gateway.listActive).toHaveBeenCalledWith('s')
    expect(gateway.create).toHaveBeenCalledWith('s', {
      label: 'Rendez-vous médical',
      justified: true,
      position: 2,
    })
  })

  it('refuses a label already used by an active reason, whatever its case', async () => {
    const gateway = gatewaySpy()
    expect(
      await createAbsenceReason(
        { schoolId: 's', label: 'MALADIE', justified: true },
        gateway as unknown as Gateway
      )
    ).toBe('labelTaken')
    expect(gateway.create).not.toHaveBeenCalled()
  })

  it('refuses an empty label', async () => {
    const gateway = gatewaySpy()
    expect(
      await createAbsenceReason(
        { schoolId: 's', label: '   ', justified: true },
        gateway as unknown as Gateway
      )
    ).toBe('validationError')
  })

  it('caps the number of reasons per school', async () => {
    const rows = Array.from({ length: MAX_ABSENCE_REASONS }, (_, position) => ({
      id: `${position}`,
      label: `Motif ${position}`,
      justified: true,
      position,
    }))
    expect(
      await createAbsenceReason(
        { schoolId: 's', label: 'Encore', justified: true },
        gatewaySpy(rows) as unknown as Gateway
      )
    ).toBe('tooManyReasons')
  })
})

describe('updateAbsenceReason', () => {
  it('renames a reason unless another active reason has the label', async () => {
    const gateway = gatewaySpy()
    expect(
      await updateAbsenceReason({ schoolId: 's', id: A, label: 'sans nouvelles' }, gateway as never)
    ).toBe('labelTaken')
    expect(
      await updateAbsenceReason({ schoolId: 's', id: A, label: 'maladie' }, gateway as never)
    ).toBe('OK')
    expect(gateway.update).toHaveBeenCalledWith('s', A, { label: 'maladie', justified: undefined })
  })

  it('reports a reason outside the school as not found', async () => {
    const gateway = gatewaySpy()
    gateway.update.mockResolvedValue(0)
    expect(
      await updateAbsenceReason({ schoolId: 's', id: A, justified: false }, gateway as never)
    ).toBe('notFound')
  })

  it('refuses an update that changes nothing', async () => {
    expect(await updateAbsenceReason({ schoolId: 's', id: A }, gatewaySpy() as never)).toBe(
      'validationError'
    )
  })
})

describe('archiveAbsenceReason', () => {
  it('archives a reason of the school', async () => {
    const gateway = gatewaySpy()
    expect(await archiveAbsenceReason({ schoolId: 's', id: A }, gateway as never)).toBe('OK')
    expect(gateway.archive).toHaveBeenCalledWith('s', A)
  })

  it('reports a reason of another school as not found', async () => {
    const gateway = gatewaySpy()
    gateway.archive.mockResolvedValue(0)
    expect(await archiveAbsenceReason({ schoolId: 's', id: A }, gateway as never)).toBe('notFound')
  })
})

describe('reorderAbsenceReasons', () => {
  it('stores the order when it names exactly the active reasons', async () => {
    const gateway = gatewaySpy()
    expect(await reorderAbsenceReasons({ schoolId: 's', ids: [B, A] }, gateway as never)).toBe('OK')
    expect(gateway.reorder).toHaveBeenCalledWith('s', [B, A])
  })

  it.each([[[A]], [[A, A]], [[A, '00000000-0000-4000-8000-00000000000c']]])(
    'refuses a stale or foreign order %j',
    async (ids) => {
      const gateway = gatewaySpy()
      expect(await reorderAbsenceReasons({ schoolId: 's', ids }, gateway as never)).toBe(
        'staleOrder'
      )
      expect(gateway.reorder).not.toHaveBeenCalled()
    }
  )
})
