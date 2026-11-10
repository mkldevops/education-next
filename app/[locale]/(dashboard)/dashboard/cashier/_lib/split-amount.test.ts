import { describe, expect, it } from 'vitest'
import { splitAmount } from './split-amount'

describe('splitAmount', () => {
  it('splits a KMF amount evenly between two children', () => {
    expect(splitAmount(10000, 2, 0)).toEqual([5000, 5000])
  })

  it('gives the leftover units to the first shares', () => {
    expect(splitAmount(10000, 3, 0)).toEqual([3334, 3333, 3333])
  })

  it('splits a euro amount to the cent', () => {
    expect(splitAmount(10, 3, 2)).toEqual([3.34, 3.33, 3.33])
  })

  it('returns nothing without an amount or a share', () => {
    expect(splitAmount(0, 2, 0)).toEqual([])
    expect(splitAmount(100, 0, 0)).toEqual([])
  })
})
