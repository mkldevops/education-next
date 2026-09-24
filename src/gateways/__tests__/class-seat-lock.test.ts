import { describe, expect, it, vi } from 'vitest'
import { reserveClassSeats, reserveClassSeatsInOrder } from '@/gateways/class-seat-lock'
import type { Prisma } from '@/generated/prisma/client'

function buildTx(capacityById: Record<string, number>, occupiedById: Record<string, number>) {
  const locked: string[] = []
  const tx = {
    $queryRaw: vi.fn(async (_sql: TemplateStringsArray, id: string) => {
      locked.push(id)
      return id in capacityById ? [{ capacity: capacityById[id] }] : []
    }),
    classAssignment: {
      count: vi.fn(async ({ where }: { where: { classPeriodId: string } }) => {
        return occupiedById[where.classPeriodId] ?? 0
      }),
    },
  }
  return { tx: tx as unknown as Prisma.TransactionClient, raw: tx, locked }
}

describe('reserveClassSeats', () => {
  it('locks the class row of the school with FOR UPDATE before counting', async () => {
    const { tx, raw } = buildTx({ 'class-1': 10 }, { 'class-1': 3 })

    expect(await reserveClassSeats(tx, 'school-1', 'class-1')).toBe('OK')

    const [sql, ...values] = raw.$queryRaw.mock.calls[0]
    expect(sql.join('?')).toMatch(/"isActive" = true\s+FOR UPDATE/)
    expect(values).toEqual(['class-1', 'school-1'])
    expect(raw.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      raw.classAssignment.count.mock.invocationCallOrder[0]
    )
  })

  it('counts every seat-holding enrollment, COMPLETED included', async () => {
    const { tx, raw } = buildTx({ 'class-1': 10 }, {})

    await reserveClassSeats(tx, 'school-1', 'class-1')

    expect(raw.classAssignment.count).toHaveBeenCalledWith({
      where: {
        schoolId: 'school-1',
        classPeriodId: 'class-1',
        endAt: null,
        enrollment: { status: { in: ['PENDING', 'ACTIVE', 'COMPLETED'] } },
      },
    })
  })

  it.each([
    { occupied: 9, seats: 1, expected: 'OK' },
    { occupied: 10, seats: 1, expected: 'classFull' },
    { occupied: 8, seats: 2, expected: 'OK' },
    { occupied: 9, seats: 2, expected: 'classFull' },
  ])(
    'answers $expected for $seats seat(s) with $occupied of 10 taken',
    async ({ occupied, seats, expected }) => {
      const { tx } = buildTx({ 'class-1': 10 }, { 'class-1': occupied })

      expect(await reserveClassSeats(tx, 'school-1', 'class-1', seats)).toBe(expected)
    }
  )

  it('returns notFound for a class archived or from another school', async () => {
    const { tx, raw } = buildTx({}, {})

    expect(await reserveClassSeats(tx, 'school-1', 'class-1')).toBe('notFound')
    expect(raw.classAssignment.count).not.toHaveBeenCalled()
  })
})

describe('reserveClassSeatsInOrder', () => {
  it('locks classes by increasing id so two commits never deadlock', async () => {
    const { tx, locked } = buildTx({ 'class-a': 5, 'class-b': 5 }, {})

    const seats = new Map([
      ['class-b', 1],
      ['class-a', 2],
    ])

    expect(await reserveClassSeatsInOrder(tx, 'school-1', seats)).toBe('OK')
    expect(locked).toEqual(['class-a', 'class-b'])
  })

  it('stops at the first class that cannot take its seats', async () => {
    const { tx, locked } = buildTx({ 'class-a': 2, 'class-b': 5 }, { 'class-a': 1 })

    const seats = new Map([
      ['class-a', 2],
      ['class-b', 1],
    ])

    expect(await reserveClassSeatsInOrder(tx, 'school-1', seats)).toBe('classFull')
    expect(locked).toEqual(['class-a'])
  })
})
