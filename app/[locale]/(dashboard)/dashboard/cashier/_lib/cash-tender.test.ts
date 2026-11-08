import { describe, expect, it } from 'vitest'
import { suggestTenders } from './cash-tender'

describe('suggestTenders', () => {
  it('rounds a KMF total up to the next notes', () => {
    expect(suggestTenders(7500)).toEqual([8000, 10000])
  })

  it('rounds a euro total up to coins and notes', () => {
    expect(suggestTenders(37.5)).toEqual([38, 40, 50])
  })

  it('suggests nothing for an empty receipt', () => {
    expect(suggestTenders(0)).toEqual([])
  })
})
