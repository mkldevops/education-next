import { describe, expect, it } from 'vitest'
import { toWhatsAppNumber, whatsAppLink } from '../whatsapp-link'

describe('toWhatsAppNumber', () => {
  it('prefixes a French national number with 33', () => {
    expect(toWhatsAppNumber('06 12 34 56 78')).toBe('33612345678')
    expect(toWhatsAppNumber('04.91.00.00.00')).toBe('33491000000')
  })

  it('routes overseas mobiles to their own country code', () => {
    expect(toWhatsAppNumber('0639 12 34 56')).toBe('262639123456')
    expect(toWhatsAppNumber('0692 12 34 56')).toBe('262692123456')
    expect(toWhatsAppNumber('0690 12 34 56')).toBe('590690123456')
    expect(toWhatsAppNumber('0696 12 34 56')).toBe('596696123456')
  })

  it('keeps an international number as is', () => {
    expect(toWhatsAppNumber('+33 6 12 34 56 78')).toBe('33612345678')
    expect(toWhatsAppNumber('+269 333 12 34')).toBe('2693331234')
    expect(toWhatsAppNumber('0033 6 12 34 56 78')).toBe('33612345678')
  })

  it('rejects a number it cannot place', () => {
    expect(toWhatsAppNumber('612345678')).toBeNull()
    expect(toWhatsAppNumber('0612')).toBeNull()
    expect(toWhatsAppNumber('+33')).toBeNull()
  })
})

describe('whatsAppLink', () => {
  it('encodes the prefilled message', () => {
    expect(whatsAppLink('0612345678', 'Bonjour & merci')).toBe(
      'https://wa.me/33612345678?text=Bonjour%20%26%20merci'
    )
  })

  it('returns null without a usable number', () => {
    expect(whatsAppLink('123', 'Bonjour')).toBeNull()
  })
})
