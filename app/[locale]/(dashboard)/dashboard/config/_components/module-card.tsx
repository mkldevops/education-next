'use client'

import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@peaklab/ui'
import { Settings2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ComponentProps, ReactNode } from 'react'
import { FlagToggle } from '../../../_components/flag-toggle'

type Props = {
  title: string
  description: string
  enabled: boolean
  onSave: (enabled: boolean) => Promise<string>
  confirmDisable?: ComponentProps<typeof FlagToggle>['confirmDisable']
  /** Valeurs courantes des options, lisibles sans ouvrir le dialogue. */
  summary?: string
  /** Signale une option à compléter pour que le module fonctionne. */
  attention?: string
  /** Options du module, rangées sous son interrupteur dans le dialogue. */
  children?: ReactNode
}

/**
 * Un module de l'école : son interrupteur, et ses options derrière « Configurer ». Le
 * dialogue reprend l'interrupteur en tête pour que les options restent lues sous le module
 * qu'elles règlent, comme dans la carte.
 *
 * Les deux interrupteurs ont chacun leur état optimiste : la clé les remonte quand le drapeau
 * enregistré change, sans quoi l'un contredirait l'autre après `router.refresh()`.
 */
export function ModuleCard({
  title,
  description,
  enabled,
  onSave,
  confirmDisable,
  summary,
  attention,
  children,
}: Props) {
  const t = useTranslations('dashboard.pages.config.modules')
  const toggle = { title, description, enabled, onSave, confirmDisable }

  return (
    <Card className="flex flex-col rounded border border-alabaster-700 p-0">
      <div className="flex-1">
        <FlagToggle key={String(enabled)} {...toggle} />
      </div>
      {children && enabled && (
        <div className="flex items-center justify-between gap-3 border-t border-alabaster-700 px-6 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {summary && <p className="truncate text-xs text-graphite-600">{summary}</p>}
            {attention && (
              <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                {attention}
              </span>
            )}
          </div>
          <Dialog>
            <DialogTrigger>
              <Button type="button" variant="outline" size="sm" className="shrink-0">
                <Settings2 aria-hidden="true" className="size-4" />
                {t('configure')}
              </Button>
            </DialogTrigger>
            <ModuleDialog title={title}>
              <FlagToggle key={String(enabled)} {...toggle}>
                <div className="divide-y divide-alabaster-700">{children}</div>
              </FlagToggle>
            </ModuleDialog>
          </Dialog>
        </div>
      )}
    </Card>
  )
}

function ModuleDialog({ title, children }: { title: string; children: ReactNode }) {
  const t = useTranslations('dashboard.pages.config.modules')
  const { setOpen } = useDialog()

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{t('dialogTitle', { module: title })}</DialogTitle>
      </DialogHeader>
      <div className="max-h-[65vh] overflow-y-auto">{children}</div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          {t('close')}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
