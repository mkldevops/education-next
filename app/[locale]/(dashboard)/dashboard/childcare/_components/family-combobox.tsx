'use client'

import { Combobox } from '@base-ui/react/combobox'
import { cn } from '@peaklab/ui'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

export type FamilyOption = { id: string; name: string }

type Item = FamilyOption & { create?: true }

const CREATE_ID = '__create__'

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .trim()

/**
 * Famille cherchée par son nom. Quand aucune famille ne porte exactement le nom saisi, une dernière
 * option propose de la créer : le choix remonte via `onCreate`, la création reste au formulaire.
 */
export function FamilyCombobox({
  id,
  families,
  value,
  onValueChange,
  onCreate,
  disabled,
}: {
  id: string
  families: FamilyOption[]
  value: string | null
  onValueChange: (value: string | null) => void
  onCreate: (name: string) => void
  disabled?: boolean
}) {
  const t = useTranslations('dashboard.pages.childcare.family')
  const [query, setQuery] = useState('')
  const selected = families.find((family) => family.id === value) ?? null
  const typed = query.trim()
  const exists = families.some((family) => normalize(family.name) === normalize(typed))
  const items: Item[] =
    typed && !exists && typed !== selected?.name
      ? [...families, { id: CREATE_ID, name: typed, create: true }]
      : families

  return (
    <Combobox.Root<Item>
      items={items}
      value={selected}
      inputValue={query}
      onInputValueChange={setQuery}
      onValueChange={(next) => {
        if (next?.create) {
          onCreate(next.name)
          return
        }
        onValueChange(next?.id ?? null)
      }}
      itemToStringLabel={(item) => item.name}
      itemToStringValue={(item) => item.id}
      isItemEqualToValue={(item, current) => item.id === current.id}
      filter={(item, search) =>
        item.create === true || normalize(item.name).includes(normalize(search))
      }
      disabled={disabled}
      autoHighlight
    >
      <div className="relative">
        <Combobox.Input
          id={id}
          autoComplete="off"
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
              'max-h-[min(var(--available-height),18rem)] w-(--anchor-width) min-w-36 overflow-y-auto',
              'rounded border border-alabaster-700 bg-popover py-1 text-graphite shadow-lg',
              'origin-(--transform-origin) transition-[transform,opacity] duration-150',
              'data-ending-style:scale-95 data-ending-style:opacity-0',
              'data-starting-style:scale-95 data-starting-style:opacity-0'
            )}
          >
            <Combobox.Empty className="px-3 py-2 text-sm text-graphite-600 empty:hidden">
              {t('empty')}
            </Combobox.Empty>
            <Combobox.List>
              {(item: Item) =>
                item.create ? (
                  <Combobox.Item
                    key={item.id}
                    value={item}
                    className={cn(
                      'mt-1 flex w-full cursor-default items-center gap-2 border-t border-alabaster-700 px-3 py-2 text-sm text-primary outline-hidden select-none',
                      'data-highlighted:bg-primary/10'
                    )}
                  >
                    <Plus className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{t('createNamed', { name: item.name })}</span>
                  </Combobox.Item>
                ) : (
                  <Combobox.Item
                    key={item.id}
                    value={item}
                    className={cn(
                      'relative flex w-full cursor-default items-center py-2 pr-9 pl-3 text-sm outline-hidden select-none',
                      'data-highlighted:bg-alabaster-800 data-selected:font-medium'
                    )}
                  >
                    <span className="truncate">{item.name}</span>
                    <Combobox.ItemIndicator className="pointer-events-none absolute right-3 flex size-4 items-center justify-center">
                      <Check className="size-4 text-foreground" aria-hidden="true" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )
              }
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
