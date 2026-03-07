'use client'

import { createContext, useContext, useRef, useState } from 'react'
import { cn } from '../utils'

interface DialogContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogStateContext = createContext<DialogContextType | null>(null)

export function useDialog() {
  const context = useContext(DialogStateContext)
  if (!context) {
    throw new Error('useDialog must be used within Dialog')
  }
  return context
}

export interface DialogProps {
  children: React.ReactNode
}

export function Dialog({ children }: DialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <DialogStateContext.Provider value={{ open, setOpen }}>{children}</DialogStateContext.Provider>
  )
}

export interface DialogTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

export function DialogTrigger({ children, asChild }: DialogTriggerProps) {
  const { setOpen } = useDialog()

  if (asChild) {
    return (
      <button
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setOpen(true)
          }
        }}
        type="button"
      >
        {children}
      </button>
    )
  }

  return (
    <button onClick={() => setOpen(true)} type="button">
      {children}
    </button>
  )
}

export interface DialogContentProps {
  children: React.ReactNode
  className?: string
}

export function DialogContent({ children, className }: DialogContentProps) {
  const { open, setOpen } = useDialog()
  const dialogRef = useRef<HTMLDialogElement>(null)

  if (!open) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      setOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        'fixed inset-0 z-50 m-auto w-full max-w-lg rounded-lg bg-white shadow-lg',
        'backdrop:bg-black/40 backdrop:backdrop-blur-sm',
        className
      )}
      open={open}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      {children}
      <style>{`
        dialog::backdrop {
          background-color: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
        }
      `}</style>
    </dialog>
  )
}

export interface DialogHeaderProps {
  children: React.ReactNode
  className?: string
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return <div className={cn('space-y-1.5 border-b px-6 py-4', className)}>{children}</div>
}

export interface DialogTitleProps {
  children: React.ReactNode
  className?: string
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  return (
    <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)}>
      {children}
    </h2>
  )
}

export interface DialogBodyProps {
  children: React.ReactNode
  className?: string
}

export function DialogBody({ children, className }: DialogBodyProps) {
  return <div className={cn('space-y-4 px-6 py-4', className)}>{children}</div>
}

export interface DialogFooterProps {
  children: React.ReactNode
  className?: string
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div className={cn('flex justify-end gap-3 border-t px-6 py-4', className)}>{children}</div>
  )
}
