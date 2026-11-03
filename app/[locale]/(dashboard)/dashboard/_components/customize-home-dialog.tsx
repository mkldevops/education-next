'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@peaklab/ui'
import { SlidersHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import { saveHiddenWidgetsAction } from '../_lib/home-widget-actions'
import type { HomeWidget } from '../_lib/home-widgets'

interface Props {
  available: HomeWidget[]
  hidden: HomeWidget[]
}

export function CustomizeHomeDialog({ available, hidden }: Props) {
  const t = useTranslations('dashboard.home.customize')

  return (
    <Dialog>
      <DialogTrigger>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t('open')}
          title={t('open')}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <p className="text-sm text-graphite-600">{t('description')}</p>
        </DialogHeader>
        <CustomizeHomeForm available={available} hidden={hidden} />
      </DialogContent>
    </Dialog>
  )
}

function CustomizeHomeForm({ available, hidden }: Props) {
  const t = useTranslations('dashboard.home.customize')
  const { setOpen } = useDialog()
  const [selection, setSelection] = useState(() => new Set(hidden))
  const [pending, startTransition] = useTransition()

  const toggle = (widget: HomeWidget, visible: boolean) => {
    setSelection((current) => {
      const next = new Set(current)
      if (visible) next.delete(widget)
      else next.add(widget)
      return next
    })
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveHiddenWidgetsAction([...selection])
      if (result !== 'OK') {
        toast.error(t('error'))
        return
      }
      setOpen(false)
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <DialogBody>
        <ul className="space-y-1">
          {available.map((widget) => (
            <li key={widget}>
              <label className="flex items-start gap-3 rounded-md px-2 py-2 text-sm text-graphite hover:bg-alabaster-900">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded"
                  checked={!selection.has(widget)}
                  disabled={pending}
                  onChange={(event) => toggle(widget, event.target.checked)}
                />
                <span>
                  <span className="font-medium">{t(`widgets.${widget}.label`)}</span>
                  <span className="block text-xs text-graphite-600">
                    {t(`widgets.${widget}.hint`)}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </DialogBody>
      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          disabled={pending || selection.size === 0}
          onClick={() => setSelection(new Set())}
        >
          {t('showAll')}
        </Button>
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
      </DialogFooter>
    </form>
  )
}
