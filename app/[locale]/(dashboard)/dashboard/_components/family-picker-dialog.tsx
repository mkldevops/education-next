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
  useDialog,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ReactNode, useId, useState } from 'react'

export interface FamilyOption {
  id: string
  name: string
}

interface FamilyPickerDialogProps {
  families: FamilyOption[]
  /** Libellé du bouton et titre du sélecteur, repris du dialogue ouvert ensuite. */
  label: string
  /** Dialogue existant à ouvrir pour la famille choisie, monté ouvert. */
  renderDialog: (family: FamilyOption) => ReactNode
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Point d'entrée hors fiche famille : la famille est choisie d'abord, puis le dialogue
 * existant s'ouvre pour elle. Chaque choix remonte le dialogue, si bien qu'il rouvre même
 * quand la même famille est choisie deux fois de suite.
 */
export function FamilyPickerDialog({ families, label, renderDialog }: FamilyPickerDialogProps) {
  const t = useTranslations('dashboard.familyPicker')
  const [selection, setSelection] = useState<{ family: FamilyOption; key: number } | null>(null)

  return (
    <>
      <Dialog>
        <DialogTrigger>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            {label}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <p className="text-sm text-graphite-600">{t('description')}</p>
          </DialogHeader>
          <FamilyPickerList
            families={families}
            onPick={(family) =>
              setSelection((previous) => ({ family, key: (previous?.key ?? 0) + 1 }))
            }
          />
        </DialogContent>
      </Dialog>
      {selection && <div key={selection.key}>{renderDialog(selection.family)}</div>}
    </>
  )
}

function FamilyPickerList({
  families,
  onPick,
}: {
  families: FamilyOption[]
  onPick: (family: FamilyOption) => void
}) {
  const t = useTranslations('dashboard.familyPicker')
  const { setOpen } = useDialog()
  const [query, setQuery] = useState('')
  const inputId = useId()
  const needle = normalize(query)
  const matches = needle
    ? families.filter((family) => normalize(family.name).includes(needle))
    : families

  if (families.length === 0) {
    return (
      <DialogBody>
        <p className="text-sm text-graphite-600">{t('noFamilies')}</p>
      </DialogBody>
    )
  }

  return (
    <DialogBody>
      <div className="space-y-2">
        <Label htmlFor={inputId}>{t('search')}</Label>
        <Input
          id={inputId}
          type="search"
          autoComplete="off"
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {matches.length === 0 ? (
        <p className="text-sm text-graphite-600">{t('noResults')}</p>
      ) : (
        <ul className="max-h-72 divide-y divide-alabaster-700 overflow-y-auto rounded border border-alabaster-700">
          {matches.map((family) => (
            <li key={family.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-alabaster-900 focus-visible:bg-alabaster-900 focus-visible:outline-none"
                onClick={() => {
                  setOpen(false)
                  onPick(family)
                }}
              >
                {family.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </DialogBody>
  )
}
