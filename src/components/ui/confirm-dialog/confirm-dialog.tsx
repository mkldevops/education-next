'use client'

import type { FormEvent, ReactNode } from 'react'
import { useTransition } from 'react'
import { Button } from '../button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '../dialog/dialog'

export interface ConfirmDialogProps {
  trigger: ReactNode
  title: string
  description: string
  confirmLabel: string
  /** Obligatoire : une primitive ne traduit pas, l'appelant fournit le libellé localisé. */
  cancelLabel: string
  onConfirm: () => Promise<void> | void
  variant?: 'destructive' | 'default'
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

function ConfirmDialogContent({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  variant = 'destructive',
}: Omit<ConfirmDialogProps, 'trigger' | 'restoreFocusRef'>) {
  const { setOpen } = useDialog()
  const [pending, startTransition] = useTransition()

  const handleConfirm = (e: FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      await onConfirm()
      setOpen(false)
    })
  }

  return (
    <DialogContent>
      <form onSubmit={handleConfirm}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground">{description}</p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

export function ConfirmDialog({ trigger, restoreFocusRef, ...props }: ConfirmDialogProps) {
  return (
    <Dialog restoreFocusRef={restoreFocusRef}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <ConfirmDialogContent {...props} />
    </Dialog>
  )
}
