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
  cancelLabel?: string
  onConfirm: () => Promise<void> | void
  variant?: 'destructive' | 'default'
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

function ConfirmDialogContent({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
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
          <p className="text-sm text-graphite-600">{description}</p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button type="submit" variant={variant} disabled={pending}>
            {pending ? '...' : confirmLabel}
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
