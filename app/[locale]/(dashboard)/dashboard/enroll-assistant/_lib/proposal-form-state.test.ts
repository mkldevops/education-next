import { describe, expect, it } from 'vitest'
import {
  emptyProposalForm,
  formFingerprint,
  formToPreviewInput,
  proposalToForm,
} from './proposal-form-state'

describe('proposalToForm', () => {
  it('turns a partial proposal into editable strings with one student at least', () => {
    const form = proposalToForm({
      familyName: 'Durand',
      parents: [{ name: 'Alice', lastname: 'Durand', sex: 'FEMALE' }],
      missing: [{ field: 'students.0.birthday', reason: 'illegible' }],
      notes: 'Fiche froissée',
    })

    expect(form.family).toEqual({ id: null, name: 'Durand' })
    expect(form.parents).toEqual([
      { name: 'Alice', lastname: 'Durand', sex: 'FEMALE', email: '', phoneNumber: '' },
    ])
    expect(form.students).toHaveLength(1)
    expect(form.students[0].className).toBe('')
    expect(form.missing).toEqual([{ field: 'students.0.birthday', reason: 'illegible' }])
    expect(form.notes).toBe('Fiche froissée')
    expect(form.payment).toBeNull()
  })

  it('never attaches to an existing family on its own', () => {
    const form = proposalToForm({ familyName: 'Durand' })

    expect(form.family.id).toBeNull()
  })

  it('keeps numbers as typed text', () => {
    const form = proposalToForm({
      discount: 20,
      payment: { amount: 150.5, method: 'CHECK', reference: 'CHQ-1', paidAt: '2026-09-01' },
    })

    expect(form.discount).toBe('20')
    expect(form.payment).toEqual({
      amount: '150.5',
      method: 'CHECK',
      reference: 'CHQ-1',
      paidAt: '2026-09-01',
      cashedAt: '',
    })
  })
})

describe('formToPreviewInput', () => {
  it('drops empty fields and parses numbers', () => {
    const form = emptyProposalForm()
    form.family.name = ' Durand '
    form.students[0] = {
      name: 'Léo',
      lastname: 'Durand',
      sex: '',
      birthday: '',
      birthplace: '',
      className: 'CE1',
      planName: '',
    }
    form.planName = 'Annuel'
    form.discount = '12,5'

    expect(formToPreviewInput(form, true)).toEqual({
      familyName: 'Durand',
      parents: [],
      emergencyContactName: undefined,
      emergencyContactPhone: undefined,
      students: [
        {
          name: 'Léo',
          lastname: 'Durand',
          sex: undefined,
          birthday: undefined,
          birthplace: undefined,
          className: 'CE1',
          planName: undefined,
        },
      ],
      planName: 'Annuel',
      discount: 12.5,
      payment: undefined,
    })
  })

  it('sends only the family id when attached, without parents or emergency contact', () => {
    const form = emptyProposalForm()
    form.family = { id: 'family-1', name: 'Martin' }
    form.parents = [{ name: 'Paul', lastname: 'Martin', sex: '', email: '', phoneNumber: '' }]
    form.emergencyContactName = 'Mamie'

    const input = formToPreviewInput(form, false) as Record<string, unknown>

    expect(input.familyId).toBe('family-1')
    expect(input).not.toHaveProperty('familyName')
    expect(input).not.toHaveProperty('parents')
    expect(input).not.toHaveProperty('emergencyContactName')
  })

  it('omits plan, discount and payment when payments are disabled', () => {
    const form = emptyProposalForm()
    form.planName = 'Annuel'
    form.discount = '10'
    form.payment = {
      amount: '50',
      method: 'CASH',
      reference: '',
      paidAt: '2026-09-01',
      cashedAt: '',
    }
    form.students[0].planName = 'Réduit'

    const input = formToPreviewInput(form, false) as Record<string, unknown>

    expect(input).not.toHaveProperty('planName')
    expect(input).not.toHaveProperty('discount')
    expect(input).not.toHaveProperty('payment')
    expect((input.students as { planName?: string }[])[0].planName).toBeUndefined()
  })

  it('only carries the cashing date for a check', () => {
    const form = emptyProposalForm()
    form.payment = {
      amount: '50',
      method: 'CARD',
      reference: '',
      paidAt: '2026-09-01',
      cashedAt: '2026-09-10',
    }

    const input = formToPreviewInput(form, true) as { payment: { cashedAt?: string } }

    expect(input.payment.cashedAt).toBeUndefined()
  })
})

describe('formFingerprint', () => {
  it('changes with any field that reaches the preview and ignores whitespace', () => {
    const a = emptyProposalForm()
    const b = emptyProposalForm()
    b.family.name = ' '

    expect(formFingerprint(a, true)).toBe(formFingerprint(b, true))

    b.students[0].className = 'CE1'
    expect(formFingerprint(a, true)).not.toBe(formFingerprint(b, true))
  })
})
