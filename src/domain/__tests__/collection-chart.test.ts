import { describe, expect, it } from 'vitest'
import {
  changeChartView,
  collectionSeries,
  collectionWindow,
  DEFAULT_CHART_VIEW,
  readChartView,
} from '../collection-chart'

const reference = new Date('2026-11-03T10:00:00.000Z')

function dated(amount: number, paidAt: string) {
  return { amount, paidAt: new Date(paidAt) }
}

describe('readChartView', () => {
  it('keeps a stored view that reads well', () => {
    expect(readChartView('day', '30d')).toEqual({ granularity: 'day', range: '30d' })
  })

  it('falls back on the default for a missing, unknown or unreadable view', () => {
    expect(readChartView(null, null)).toEqual(DEFAULT_CHART_VIEW)
    expect(readChartView('week', '30d')).toEqual(DEFAULT_CHART_VIEW)
    expect(readChartView('day', '12m')).toEqual(DEFAULT_CHART_VIEW)
  })
})

describe('changeChartView', () => {
  it('keeps the other axis when the pair still reads well', () => {
    expect(changeChartView({ granularity: 'month', range: '12m' }, { range: '6m' })).toEqual({
      granularity: 'month',
      range: '6m',
    })
  })

  it('switches to days when a short period is picked', () => {
    expect(changeChartView({ granularity: 'month', range: '12m' }, { range: '7d' })).toEqual({
      granularity: 'day',
      range: '7d',
    })
  })

  it('switches to the first matching period when the breakdown changes', () => {
    expect(changeChartView({ granularity: 'day', range: '7d' }, { granularity: 'year' })).toEqual({
      granularity: 'year',
      range: '12m',
    })
  })
})

describe('collectionWindow', () => {
  it('covers the last seven days up to today', () => {
    expect(collectionWindow(reference, { granularity: 'day', range: '7d' }, reference)).toEqual({
      from: new Date('2026-10-28T00:00:00.000Z'),
      to: new Date('2026-11-04T00:00:00.000Z'),
      granularity: 'day',
    })
  })

  it('starts month ranges at the beginning of a month', () => {
    const window = collectionWindow(reference, { granularity: 'month', range: '3m' }, reference)

    expect(window.from).toEqual(new Date('2026-09-01T00:00:00.000Z'))
    expect(window.to).toEqual(new Date('2026-12-01T00:00:00.000Z'))
  })

  it('ends on the last payment of a past period, never after today', () => {
    const past = collectionWindow(
      new Date('2024-06-10T00:00:00.000Z'),
      { granularity: 'day', range: '7d' },
      reference
    )
    const future = collectionWindow(
      new Date('2031-01-01T00:00:00.000Z'),
      { granularity: 'day', range: '7d' },
      reference
    )

    expect(past.to).toEqual(new Date('2024-06-11T00:00:00.000Z'))
    expect(future.to).toEqual(new Date('2026-11-04T00:00:00.000Z'))
  })
})

describe('collectionSeries', () => {
  it('fills empty days and slices them in UTC', () => {
    const window = collectionWindow(reference, { granularity: 'day', range: '7d' }, reference)
    const series = collectionSeries(
      [
        dated(40, '2026-11-03T00:30:00.000Z'),
        dated(10, '2026-11-02T23:30:00.000Z'),
        dated(99, '2026-10-27T23:59:00.000Z'),
      ],
      window
    )

    expect(series).toHaveLength(7)
    expect(series[0].key).toBe('2026-10-28')
    expect(series.slice(-2)).toEqual([
      { key: '2026-11-02', amount: 10, count: 1 },
      { key: '2026-11-03', amount: 40, count: 1 },
    ])
  })

  it('groups twelve months by calendar year', () => {
    const window = collectionWindow(reference, { granularity: 'year', range: '12m' }, reference)
    const series = collectionSeries(
      [dated(100, '2025-12-15T00:00:00.000Z'), dated(50, '2026-03-01T00:00:00.000Z')],
      window
    )

    expect(series).toEqual([
      { key: '2025', amount: 100, count: 1 },
      { key: '2026', amount: 50, count: 1 },
    ])
  })
})
