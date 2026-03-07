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

export interface FormDialogProps {
  trigger: ReactNode
  title: string
  children: ReactNode
  submitLabel: string
  cancelLabel?: string
  onSubmit: () => Promise<void> | void
  className?: string
}

function FormDialogContent({
  title,
  children,
  submitLabel,
  cancelLabel = 'Cancel',
  onSubmit,
  className,
}: Omit<FormDialogProps, 'trigger'>) {
  const { setOpen } = useDialog()
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      await onSubmit()
      setOpen(false)
    })
  }

  return (
    <DialogContent className={className}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? '...' : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

export function FormDialog({ trigger, ...props }: FormDialogProps) {
  return (
    <Dialog>
      <DialogTrigger>{trigger}</DialogTrigger>
      <FormDialogContent {...props} />
    </Dialog>
  )
}
