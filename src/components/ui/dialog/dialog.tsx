'use client'

import { cloneElement, createContext, isValidElement, useContext, useEffect, useState } from 'react'
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
  initialOpen?: boolean
}

export function Dialog({ children, initialOpen = false }: DialogProps) {
  const [open, setOpen] = useState(initialOpen)

  return (
    <DialogStateContext.Provider value={{ open, setOpen }}>{children}</DialogStateContext.Provider>
  )
}

export interface DialogTriggerProps {
  children: React.ReactNode
}

export function DialogTrigger({ children }: DialogTriggerProps) {
  const { setOpen } = useDialog()

  if (isValidElement<{ onClick?: React.MouseEventHandler }>(children)) {
    const childOnClick = children.props.onClick
    return cloneElement(children, {
      onClick: (e: React.MouseEvent) => {
        childOnClick?.(e)
        setOpen(true)
      },
    })
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
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className={cn('relative z-10 w-full max-w-lg rounded-lg bg-white shadow-xl', className)}>
        {children}
      </div>
    </div>
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
