'use client'

import { Button, Input, Label, Select } from '@peaklab/ui'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { MISSING_FIELD_REASONS } from '@/use-cases/ai-assistant/schemas'
import {
  EMPTY_PARENT,
  EMPTY_PAYMENT,
  EMPTY_STUDENT,
  type MethodValue,
  type ParentForm,
  type PaymentForm,
  type ProposalForm as ProposalFormState,
  type SexValue,
  type StudentForm,
} from '../_lib/proposal-form-state'

const METHODS: MethodValue[] = ['CASH', 'CARD', 'TRANSFER', 'CHECK']
const SEXES: SexValue[] = ['', 'MALE', 'FEMALE']

type Props = {
  form: ProposalFormState
  onChange: (form: ProposalFormState) => void
  paymentsEnabled: boolean
  invalidFields: string[]
  edited: boolean
  disabled: boolean
  previewPending: boolean
  onRequestPreview: () => void
}

export function ProposalForm({
  form,
  onChange,
  paymentsEnabled,
  invalidFields,
  edited,
  disabled,
  previewPending,
  onRequestPreview,
}: Props) {
  const t = useTranslations('dashboard.pages.enrollAssistant.proposal')
  const invalid = (path: string) => invalidFields.includes(path)

  const update = (patch: Partial<ProposalFormState>) => onChange({ ...form, ...patch })
  const updateParent = (index: number, patch: Partial<ParentForm>) =>
    update({ parents: form.parents.map((p, i) => (i === index ? { ...p, ...patch } : p)) })
  const updateStudent = (index: number, patch: Partial<StudentForm>) =>
    update({ students: form.students.map((s, i) => (i === index ? { ...s, ...patch } : s)) })
  const updatePayment = (patch: Partial<PaymentForm>) =>
    update({ payment: { ...(form.payment ?? EMPTY_PAYMENT), ...patch } })

  const attached = form.family.id !== null

  return (
    <section className="flex flex-col gap-5" aria-label={t('title')}>
      <p className="text-sm text-muted-foreground">{t('hint')}</p>

      {form.missing.length > 0 ? (
        <div className="rounded border border-warning/40 bg-warning-subtle px-3 py-2 text-sm">
          <p className="font-medium">{t('missing.title')}</p>
          <ul className="mt-1 list-disc pl-5">
            {form.missing.map((item) => (
              <li key={`${item.field}-${item.reason}`}>
                <code className="text-xs">{item.field}</code> —{' '}
                {MISSING_FIELD_REASONS.includes(item.reason)
                  ? t(`missing.${item.reason}`)
                  : item.reason}
                {item.note ? ` (${item.note})` : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {form.notes ? (
        <div className="rounded border border-border bg-surface-2 px-3 py-2 text-sm">
          <p className="font-medium">{t('notes')}</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{form.notes}</p>
        </div>
      ) : null}

      <Fieldset legend={t('family.title')}>
        {attached ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{t('family.selected', { name: form.family.name })}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => update({ family: { id: null, name: form.family.name } })}
            >
              {t('family.clear')}
            </Button>
            <p className="basis-full text-xs text-muted-foreground">{t('family.existingHint')}</p>
          </div>
        ) : (
          <>
            <Field label={t('family.name')} id="familyName" invalid={invalid('familyName')}>
              <Input
                id="familyName"
                value={form.family.name}
                disabled={disabled}
                aria-invalid={invalid('familyName')}
                onChange={(e) => update({ family: { id: null, name: e.target.value } })}
              />
            </Field>
            <p className="text-xs text-muted-foreground">{t('family.none')}</p>
          </>
        )}
      </Fieldset>

      {!attached ? (
        <Fieldset
          legend={t('parents.title')}
          action={
            <AddButton
              label={t('parents.add')}
              disabled={disabled || form.parents.length >= 4}
              onClick={() => update({ parents: [...form.parents, { ...EMPTY_PARENT }] })}
            />
          }
        >
          {form.parents.map((parent, index) => {
            const path = `parents.${index}`
            return (
              <div
                key={path}
                className="grid gap-3 rounded border border-border p-3 sm:grid-cols-2"
              >
                <Field
                  label={t('parents.name')}
                  id={`${path}.name`}
                  invalid={invalid(`${path}.name`)}
                >
                  <Input
                    id={`${path}.name`}
                    value={parent.name}
                    disabled={disabled}
                    aria-invalid={invalid(`${path}.name`)}
                    onChange={(e) => updateParent(index, { name: e.target.value })}
                  />
                </Field>
                <Field
                  label={t('parents.lastname')}
                  id={`${path}.lastname`}
                  invalid={invalid(`${path}.lastname`)}
                >
                  <Input
                    id={`${path}.lastname`}
                    value={parent.lastname}
                    disabled={disabled}
                    aria-invalid={invalid(`${path}.lastname`)}
                    onChange={(e) => updateParent(index, { lastname: e.target.value })}
                  />
                </Field>
                <Field label={t('parents.sex')} id={`${path}.sex`} invalid={invalid(`${path}.sex`)}>
                  <SexSelect
                    id={`${path}.sex`}
                    value={parent.sex}
                    disabled={disabled}
                    onChange={(sex) => updateParent(index, { sex })}
                  />
                </Field>
                <Field
                  label={t('parents.email')}
                  id={`${path}.email`}
                  invalid={invalid(`${path}.email`)}
                >
                  <Input
                    id={`${path}.email`}
                    type="email"
                    value={parent.email}
                    disabled={disabled}
                    aria-invalid={invalid(`${path}.email`)}
                    onChange={(e) => updateParent(index, { email: e.target.value })}
                  />
                </Field>
                <Field
                  label={t('parents.phone')}
                  id={`${path}.phoneNumber`}
                  invalid={invalid(`${path}.phoneNumber`)}
                >
                  <Input
                    id={`${path}.phoneNumber`}
                    value={parent.phoneNumber}
                    disabled={disabled}
                    aria-invalid={invalid(`${path}.phoneNumber`)}
                    onChange={(e) => updateParent(index, { phoneNumber: e.target.value })}
                  />
                </Field>
                <RemoveButton
                  label={t('parents.remove')}
                  disabled={disabled}
                  onClick={() => update({ parents: form.parents.filter((_, i) => i !== index) })}
                />
              </div>
            )
          })}
        </Fieldset>
      ) : null}

      <Fieldset
        legend={t('students.title')}
        action={
          <AddButton
            label={t('students.add')}
            disabled={disabled || form.students.length >= 10}
            onClick={() => update({ students: [...form.students, { ...EMPTY_STUDENT }] })}
          />
        }
      >
        {form.students.map((student, index) => {
          const path = `students.${index}`
          return (
            <div key={path} className="grid gap-3 rounded border border-border p-3 sm:grid-cols-2">
              <Field
                label={t('students.name')}
                id={`${path}.name`}
                invalid={invalid(`${path}.name`)}
              >
                <Input
                  id={`${path}.name`}
                  value={student.name}
                  disabled={disabled}
                  aria-invalid={invalid(`${path}.name`)}
                  onChange={(e) => updateStudent(index, { name: e.target.value })}
                />
              </Field>
              <Field
                label={t('students.lastname')}
                id={`${path}.lastname`}
                invalid={invalid(`${path}.lastname`)}
              >
                <Input
                  id={`${path}.lastname`}
                  value={student.lastname}
                  disabled={disabled}
                  aria-invalid={invalid(`${path}.lastname`)}
                  onChange={(e) => updateStudent(index, { lastname: e.target.value })}
                />
              </Field>
              <Field label={t('students.sex')} id={`${path}.sex`} invalid={invalid(`${path}.sex`)}>
                <SexSelect
                  id={`${path}.sex`}
                  value={student.sex}
                  disabled={disabled}
                  onChange={(sex) => updateStudent(index, { sex })}
                />
              </Field>
              <Field
                label={t('students.birthday')}
                id={`${path}.birthday`}
                invalid={invalid(`${path}.birthday`)}
              >
                <Input
                  id={`${path}.birthday`}
                  type="date"
                  value={student.birthday}
                  disabled={disabled}
                  aria-invalid={invalid(`${path}.birthday`)}
                  onChange={(e) => updateStudent(index, { birthday: e.target.value })}
                />
              </Field>
              <Field
                label={t('students.birthplace')}
                id={`${path}.birthplace`}
                invalid={invalid(`${path}.birthplace`)}
              >
                <Input
                  id={`${path}.birthplace`}
                  value={student.birthplace}
                  disabled={disabled}
                  aria-invalid={invalid(`${path}.birthplace`)}
                  onChange={(e) => updateStudent(index, { birthplace: e.target.value })}
                />
              </Field>
              <Field
                label={t('students.className')}
                id={`${path}.className`}
                invalid={invalid(`${path}.className`)}
              >
                <Input
                  id={`${path}.className`}
                  value={student.className}
                  disabled={disabled}
                  aria-invalid={invalid(`${path}.className`)}
                  onChange={(e) => updateStudent(index, { className: e.target.value })}
                />
              </Field>
              {paymentsEnabled ? (
                <Field
                  label={t('students.planName')}
                  id={`${path}.planName`}
                  invalid={invalid(`${path}.planName`)}
                >
                  <Input
                    id={`${path}.planName`}
                    value={student.planName}
                    disabled={disabled}
                    aria-invalid={invalid(`${path}.planName`)}
                    onChange={(e) => updateStudent(index, { planName: e.target.value })}
                  />
                </Field>
              ) : null}
              {form.students.length > 1 ? (
                <RemoveButton
                  label={t('students.remove')}
                  disabled={disabled}
                  onClick={() => update({ students: form.students.filter((_, i) => i !== index) })}
                />
              ) : null}
            </div>
          )
        })}
      </Fieldset>

      {!attached ? (
        <Fieldset legend={t('emergency.title')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('emergency.name')}
              id="emergencyContactName"
              invalid={invalid('emergencyContactName')}
            >
              <Input
                id="emergencyContactName"
                value={form.emergencyContactName}
                disabled={disabled}
                aria-invalid={invalid('emergencyContactName')}
                onChange={(e) => update({ emergencyContactName: e.target.value })}
              />
            </Field>
            <Field
              label={t('emergency.phone')}
              id="emergencyContactPhone"
              invalid={invalid('emergencyContactPhone')}
            >
              <Input
                id="emergencyContactPhone"
                value={form.emergencyContactPhone}
                disabled={disabled}
                aria-invalid={invalid('emergencyContactPhone')}
                onChange={(e) => update({ emergencyContactPhone: e.target.value })}
              />
            </Field>
          </div>
        </Fieldset>
      ) : null}

      <Fieldset legend={t('pricing.title')}>
        {paymentsEnabled ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('pricing.planName')} id="planName" invalid={invalid('planName')}>
              <Input
                id="planName"
                value={form.planName}
                disabled={disabled}
                aria-invalid={invalid('planName')}
                onChange={(e) => update({ planName: e.target.value })}
              />
            </Field>
            <Field label={t('pricing.discount')} id="discount" invalid={invalid('discount')}>
              <Input
                id="discount"
                type="number"
                min={0}
                step="0.01"
                value={form.discount}
                disabled={disabled}
                aria-invalid={invalid('discount')}
                onChange={(e) => update({ discount: e.target.value })}
              />
            </Field>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('pricing.disabled')}</p>
        )}
      </Fieldset>

      {paymentsEnabled ? (
        <Fieldset
          legend={t('payment.title')}
          action={
            form.payment ? (
              <RemoveButton
                label={t('payment.remove')}
                disabled={disabled}
                onClick={() => update({ payment: null })}
              />
            ) : (
              <AddButton
                label={t('payment.add')}
                disabled={disabled}
                onClick={() => update({ payment: { ...EMPTY_PAYMENT } })}
              />
            )
          }
        >
          {form.payment ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={t('payment.amount')}
                id="payment.amount"
                invalid={invalid('payment.amount')}
              >
                <Input
                  id="payment.amount"
                  type="number"
                  step="0.01"
                  value={form.payment.amount}
                  disabled={disabled}
                  aria-invalid={invalid('payment.amount')}
                  onChange={(e) => updatePayment({ amount: e.target.value })}
                />
              </Field>
              <Field
                label={t('payment.method')}
                id="payment.method"
                invalid={invalid('payment.method')}
              >
                <Select
                  id="payment.method"
                  value={form.payment.method}
                  disabled={disabled}
                  onChange={(e) => updatePayment({ method: e.target.value as MethodValue })}
                >
                  {METHODS.map((method) => (
                    <option key={method} value={method}>
                      {t(`methods.${method}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t('payment.reference')}
                id="payment.reference"
                invalid={invalid('payment.reference')}
              >
                <Input
                  id="payment.reference"
                  value={form.payment.reference}
                  disabled={disabled}
                  aria-invalid={invalid('payment.reference')}
                  onChange={(e) => updatePayment({ reference: e.target.value })}
                />
              </Field>
              <Field
                label={t('payment.paidAt')}
                id="payment.paidAt"
                invalid={invalid('payment.paidAt')}
              >
                <Input
                  id="payment.paidAt"
                  type="date"
                  value={form.payment.paidAt}
                  disabled={disabled}
                  aria-invalid={invalid('payment.paidAt')}
                  onChange={(e) => updatePayment({ paidAt: e.target.value })}
                />
              </Field>
              {form.payment.method === 'CHECK' ? (
                <Field
                  label={t('payment.cashedAt')}
                  id="payment.cashedAt"
                  invalid={invalid('payment.cashedAt')}
                >
                  <Input
                    id="payment.cashedAt"
                    type="date"
                    value={form.payment.cashedAt}
                    disabled={disabled}
                    aria-invalid={invalid('payment.cashedAt')}
                    onChange={(e) => updatePayment({ cashedAt: e.target.value })}
                  />
                </Field>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('payment.none')}</p>
          )}
        </Fieldset>
      ) : null}

      {edited ? (
        <p
          className="rounded border border-warning/40 bg-warning-subtle px-3 py-2 text-sm"
          role="status"
        >
          {t('edited')}
        </p>
      ) : null}

      <div>
        <Button type="button" onClick={onRequestPreview} disabled={disabled || previewPending}>
          {previewPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {previewPending ? t('requestingPreview') : t('requestPreview')}
        </Button>
      </div>
    </section>
  )
}

function Fieldset({
  legend,
  action,
  children,
}: {
  legend: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-sm font-semibold">{legend}</legend>
        {action}
      </div>
      {children}
    </fieldset>
  )
}

function Field({
  label,
  id,
  invalid,
  children,
}: {
  label: string
  id: string
  invalid: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className={invalid ? 'text-danger' : undefined}>
        {label}
      </Label>
      {children}
    </div>
  )
}

function SexSelect({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string
  value: SexValue
  disabled: boolean
  onChange: (value: SexValue) => void
}) {
  const t = useTranslations('dashboard.pages.enrollAssistant.proposal')
  return (
    <Select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as SexValue)}
    >
      {SEXES.map((sex) => (
        <option key={sex || 'unspecified'} value={sex}>
          {sex === '' ? t('sex.unspecified') : t(`sex.${sex}`)}
        </option>
      ))}
    </Select>
  )
}

function AddButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onClick}>
      <Plus className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  )
}

function RemoveButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className="sm:col-span-2 sm:justify-self-end"
    >
      <Trash2 className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  )
}
