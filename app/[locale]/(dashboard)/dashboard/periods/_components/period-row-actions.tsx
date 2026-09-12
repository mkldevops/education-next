'use client'

import { Button, Dialog, useDialog, useMenu } from '@peaklab/ui'
import { ArrowUpRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { DeletePeriodDialogContent } from './delete-period-dialog'
import { EditPeriodDialogContent } from './edit-period-dialog'
import { PromotePeriodDialogContent } from './promote-period-dialog'

type PeriodOption = { id: string; name: string }

type Props = {
  period: {
    id: string
    name: string
    startAt: Date | string
    endAt: Date | string
  }
  targetOptions: PeriodOption[]
  classPeriodCount: number
}

type OpenDialog = 'promote' | 'edit' | 'delete'

const MENU_WIDTH = 224

/**
 * Une seule colonne d'actions par ligne : le menu porte les trois opérations et chaque
 * dialogue n'est monté que le temps de son ouverture. Le montage conditionnel remplace
 * le `DialogTrigger` : un déclencheur vivant dans le panneau du menu disparaîtrait avec
 * lui au premier clic hors du menu, dialogue compris.
 *
 * Le panneau est positionné en `fixed` d'après le rectangle du déclencheur : `DataTable`
 * enveloppe le tableau dans un `overflow-x-auto`, qui rogne aussi la verticale et
 * couperait un menu absolu sur la dernière ligne.
 */
export function PeriodRowActions({ period, targetOptions, classPeriodCount }: Props) {
  const t = useTranslations('dashboard.pages.periods')
  const { open, close, toggle, containerRef, triggerRef, menuRef } = useMenu()
  const [dialog, setDialog] = useState<OpenDialog | null>(null)
  const [anchor, setAnchor] = useState<{ top: number; left: number }>()

  // Un panneau `fixed` ne suit pas le défilement : le refermer vaut mieux que le laisser
  // flotter loin de sa ligne.
  useEffect(() => {
    if (!open) return
    const dismiss = () => close(false)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [open, close])

  const onTriggerClick = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setAnchor({ top: rect.bottom + 4, left: rect.right - MENU_WIDTH })
    toggle()
  }

  const select = (next: OpenDialog) => {
    close()
    setDialog(next)
  }

  const inUse = classPeriodCount > 0

  const items = [
    {
      key: 'promote',
      label: t('promote.trigger'),
      icon: ArrowUpRight,
      disabled: targetOptions.length === 0,
      title: targetOptions.length === 0 ? t('promote.noTarget') : undefined,
    },
    { key: 'edit', label: t('edit.title'), icon: Pencil, disabled: false, title: undefined },
    {
      key: 'delete',
      label: t('delete.trigger'),
      icon: Trash2,
      danger: true,
      disabled: inUse,
      title: inUse ? t('delete.errors.periodInUse') : undefined,
    },
  ] as const

  return (
    <div ref={containerRef} className="inline-block text-left">
      <Button
        ref={triggerRef}
        size="sm"
        variant="outline"
        className="w-8 px-0"
        aria-label={t('actions')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onTriggerClick}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={anchor}
          className="fixed z-30 w-56 rounded border border-alabaster-700 bg-white py-1 text-left shadow-lg"
        >
          {items.map(({ key, label, icon: Icon, disabled, title, ...rest }) => {
            const danger = 'danger' in rest && rest.danger
            return (
              <button
                key={key}
                type="button"
                role="menuitem"
                disabled={disabled}
                title={title}
                onClick={() => select(key)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                  disabled && 'cursor-not-allowed text-graphite-700',
                  !disabled && !danger && 'text-graphite hover:bg-alabaster-900',
                  !disabled && danger && 'text-red-600 hover:bg-red-50'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4',
                    disabled && 'text-graphite-800',
                    !disabled && !danger && 'text-graphite-700',
                    !disabled && danger && 'text-red-500'
                  )}
                />
                {label}
              </button>
            )
          })}
        </div>
      )}

      {dialog && (
        <Dialog initialOpen>
          <DialogUnmountOnClose onClosed={() => setDialog(null)} />
          {dialog === 'promote' && (
            <PromotePeriodDialogContent sourcePeriod={period} targetOptions={targetOptions} />
          )}
          {dialog === 'edit' && <EditPeriodDialogContent period={period} />}
          {dialog === 'delete' && <DeletePeriodDialogContent period={period} />}
        </Dialog>
      )}
    </div>
  )
}

/** Rend au parent la fermeture décidée à l'intérieur du dialogue, pour le démonter. */
function DialogUnmountOnClose({ onClosed }: { onClosed: () => void }) {
  const { open } = useDialog()

  useEffect(() => {
    if (!open) onClosed()
  }, [open, onClosed])

  return null
}
