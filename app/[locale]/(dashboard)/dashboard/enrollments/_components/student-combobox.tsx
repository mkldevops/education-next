'use client'

import { Combobox } from '@base-ui/react/combobox'
import { cn } from '@peaklab/ui'
import { Check, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { matchesStudent, type StudentOption } from '../_lib/enrollment-options'

interface StudentComboboxProps {
  id: string
  students: StudentOption[]
  value: string | null
  onValueChange: (value: string | null) => void
  disabled?: boolean
}

/**
 * Élève recherchable par son nom ou celui de sa famille, sans présélection. Un élève déjà inscrit
 * sur la période reste choisissable — « Remplacer l'inscription existante » le permet — mais il
 * est signalé.
 */
export function StudentCombobox({
  id,
  students,
  value,
  onValueChange,
  disabled,
}: StudentComboboxProps) {
  const t = useTranslations('dashboard.pages.enrollments.studentPicker')
  const selected = students.find((s) => s.id === value) ?? null

  return (
    <Combobox.Root<StudentOption>
      items={students}
      value={selected}
      onValueChange={(next) => onValueChange(next?.id ?? null)}
      itemToStringLabel={(item) => item.name}
      itemToStringValue={(item) => item.id}
      isItemEqualToValue={(item, current) => item.id === current.id}
      filter={(item, query) => matchesStudent(item, query)}
      disabled={disabled}
      autoHighlight
    >
      <div className="relative">
        <Combobox.Input
          id={id}
          placeholder={t('placeholder')}
          className={cn(
            'h-10 w-full rounded border border-input bg-white pr-9 pl-3 text-sm outline-none',
            'placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        />
        <Combobox.Trigger
          aria-label={t('open')}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-graphite-700"
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="isolate z-60">
          <Combobox.Popup
            className={cn(
              'max-h-(--available-height) w-(--anchor-width) min-w-36 overflow-y-auto',
              'rounded border border-alabaster-700 bg-popover py-1 text-graphite shadow-lg'
            )}
          >
            <Combobox.Empty className="px-3 py-2 text-sm text-graphite-600 empty:hidden">
              {t('empty')}
            </Combobox.Empty>
            <Combobox.List>
              {(student: StudentOption) => (
                <Combobox.Item
                  key={student.id}
                  value={student}
                  className={cn(
                    'relative flex w-full cursor-default items-center gap-2 py-2 pr-9 pl-3 text-sm outline-hidden select-none',
                    'data-highlighted:bg-alabaster-800 data-selected:font-medium'
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{student.name}</span>
                    {student.familyName && (
                      <span className="truncate text-xs text-graphite-600">
                        {student.familyName}
                      </span>
                    )}
                  </span>
                  {student.enrolledInPeriod && (
                    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                      {t('alreadyEnrolled')}
                    </span>
                  )}
                  <Combobox.ItemIndicator className="pointer-events-none absolute right-3 flex size-4 items-center justify-center">
                    <Check className="size-4 text-primary" aria-hidden="true" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
