'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@peaklab/ui'
import { Plus, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, useState, useTransition } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { toast, toastActionError } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  attachChildcareFamilyAction,
  createChildcareFamilyAction,
  saveChildcareSubscriptionAction,
  searchChildcareStudentsAction,
} from '../../../_lib/childcare-actions'
import { MONTH_PATTERN, RateField } from './childcare-form-fields'
import { FamilyCombobox, type FamilyOption } from './family-combobox'

type FoundStudent = Awaited<ReturnType<typeof searchChildcareStudentsAction>>[number]

export function AddChildDialog({
  rates,
  families,
  currentMonth,
}: {
  rates: number[]
  families: FamilyOption[]
  currentMonth: string
}) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline">
          <Plus className="size-4" aria-hidden="true" />
          {t('add.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('add.title')}</DialogTitle>
        </DialogHeader>
        <AddChildForm rates={rates} families={families} currentMonth={currentMonth} />
      </DialogContent>
    </Dialog>
  )
}

function AddChildForm({
  rates,
  families,
  currentMonth,
}: {
  rates: number[]
  families: FamilyOption[]
  currentMonth: string
}) {
  const t = useTranslations('dashboard.pages.childcare')
  const id = useId()
  const { isPending, close, startTransition } = useDialogForm(t)
  const [searching, startSearch] = useTransition()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoundStudent[] | null>(null)
  const [selected, setSelected] = useState<FoundStudent | null>(null)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [newFamily, setNewFamily] = useState<string | null>(null)

  const search = () => {
    if (query.trim().length < 2) return
    startSearch(async () => {
      setResults(await searchChildcareStudentsAction(query))
      setSelected(null)
    })
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!selected) return
        const formData = new FormData(event.currentTarget)
        startTransition(async () => {
          const saved = await saveChildcareSubscriptionAction({
            studentId: selected.id,
            monthlyAmount: Number(formData.get('monthlyAmount')),
            startMonth: formData.get('startMonth') as string,
            endMonth: null,
          })
          if (saved !== 'OK') {
            toastActionError(t, saved)
            return
          }
          const linked = newFamily
            ? await createChildcareFamilyAction(selected.id, { name: newFamily })
            : familyId
              ? await attachChildcareFamilyAction(selected.id, familyId)
              : ('OK' as const)
          if (linked !== 'OK') {
            toastActionError(t, linked)
            close()
            return
          }
          toast.success(t('add.success', { name: selected.name }))
          close()
        })
      }}
    >
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-query`}>{t('add.student')}</Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-query`}
                type="search"
                value={query}
                placeholder={t('add.searchPlaceholder')}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  search()
                }}
                disabled={isPending}
              />
              <Button
                type="button"
                variant="outline"
                onClick={search}
                disabled={isPending || searching || query.trim().length < 2}
                aria-label={t('add.searchSubmit')}
              >
                <Search className="size-4" aria-hidden="true" />
              </Button>
            </div>
            {results &&
              (results.length === 0 ? (
                <p className="text-sm text-graphite-600">{t('noResult')}</p>
              ) : (
                <ul className="max-h-56 divide-y divide-alabaster-700 overflow-y-auto rounded border border-alabaster-700">
                  {results.map((student) => (
                    <li key={student.id}>
                      <label
                        className={cn(
                          'flex items-center justify-between gap-3 px-3 py-2 text-sm',
                          student.subscribed
                            ? 'text-graphite-600'
                            : 'cursor-pointer hover:bg-alabaster-900',
                          selected?.id === student.id && 'bg-primary/15'
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="radio"
                            name="student"
                            value={student.id}
                            checked={selected?.id === student.id}
                            disabled={student.subscribed || isPending}
                            onChange={() => {
                              setSelected(student)
                              setFamilyId(null)
                              setNewFamily(null)
                            }}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-graphite">
                              {student.name}
                            </span>
                            <span className="block truncate text-xs text-graphite-600">
                              {student.className ?? t('noClass')} ·{' '}
                              {student.familyName ?? t('family.none')}
                            </span>
                          </span>
                        </span>
                        {student.subscribed && (
                          <span className="shrink-0 text-xs">{t('alreadySubscribed')}</span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              ))}
          </div>

          {selected && selected.familyName === null && (
            <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
              <Label htmlFor={`${id}-family`} className="text-sm font-normal text-amber-900">
                {t('family.missingHint')}
              </Label>
              {newFamily === null ? (
                <FamilyCombobox
                  id={`${id}-family`}
                  families={families}
                  value={familyId}
                  onValueChange={setFamilyId}
                  onCreate={setNewFamily}
                  disabled={isPending}
                />
              ) : (
                <p className="home-rise flex flex-wrap items-center justify-between gap-2 rounded border border-primary/40 bg-white px-3 py-2 text-sm">
                  <span>{t('family.willCreate', { name: newFamily })}</span>
                  <button
                    type="button"
                    onClick={() => setNewFamily(null)}
                    disabled={isPending}
                    className="text-primary hover:underline"
                  >
                    {t('family.change')}
                  </button>
                </p>
              )}
            </div>
          )}

          <RateField id={`${id}-amount`} rates={rates} disabled={isPending} />
          <div className="space-y-2">
            <Label htmlFor={`${id}-start`}>{t('form.startMonth')}</Label>
            <Input
              id={`${id}-start`}
              name="startMonth"
              type="month"
              pattern={MONTH_PATTERN}
              defaultValue={currentMonth}
              required
              disabled={isPending}
            />
            <p className="text-xs text-graphite-600">{t('add.hint')}</p>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        submitDisabled={!selected}
        onCancel={close}
        submitKey="add.submit"
      />
    </form>
  )
}
