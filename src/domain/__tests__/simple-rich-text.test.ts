import { describe, expect, it } from 'vitest'
import { parseSimpleInline } from '../simple-rich-text'

describe('parseSimpleInline', () => {
  it('parses nested bold and italic formatting', () => {
    expect(parseSimpleInline('**_Rituels_**')).toEqual([
      {
        type: 'strong',
        children: [{ type: 'emphasis', children: [{ type: 'text', value: 'Rituels' }] }],
      },
    ])
    expect(parseSimpleInline('_**Chant**_')).toEqual([
      {
        type: 'emphasis',
        children: [{ type: 'strong', children: [{ type: 'text', value: 'Chant' }] }],
      },
    ])
  })

  it('keeps unmatched markers as text', () => {
    expect(parseSimpleInline('Un **marqueur')).toEqual([{ type: 'text', value: 'Un **marqueur' }])
  })
})
