'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { cn } from '../utils'

interface DrawerContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const DrawerContext = createContext<DrawerContextType | null>(null)

export function useDrawer() {
  const context = useContext(DrawerContext)
  if (!context) {
    throw new Error('useDrawer must be used within Drawer')
  }
  return context
}

export interface DrawerProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Drawer({ children, open: controlledOpen, onOpenChange }: DrawerProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined

  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (val: boolean) => {
    if (isControlled) {
      onOpenChange?.(val)
    } else {
      setInternalOpen(val)
    }
  }

  return <DrawerContext.Provider value={{ open, setOpen }}>{children}</DrawerContext.Provider>
}

export interface DrawerTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

export function DrawerTrigger({ children, asChild }: DrawerTriggerProps) {
  const { setOpen } = useDrawer()

  if (asChild) {
    return (
      <button onClick={() => setOpen(true)} type="button">
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

export interface DrawerContentProps {
  children: React.ReactNode
  className?: string
  side?: 'left' | 'right'
}

export function DrawerContent({ children, className, side = 'right' }: DrawerContentProps) {
  const { open, setOpen } = useDrawer()
  const overlayRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, setOpen])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        ref={overlayRef}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default"
        onClick={() => setOpen(false)}
        aria-label="Close drawer"
        tabIndex={-1}
      />
      <div
        className={cn(
          'absolute inset-y-0 flex w-full max-w-lg flex-col bg-white shadow-xl',
          side === 'right' ? 'right-0' : 'left-0',
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  )
}

export interface DrawerHeaderProps {
  children: React.ReactNode
  className?: string
}

export function DrawerHeader({ children, className }: DrawerHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between border-b px-6 py-4', className)}>
      {children}
    </div>
  )
}

export interface DrawerTitleProps {
  children: React.ReactNode
  className?: string
}

export function DrawerTitle({ children, className }: DrawerTitleProps) {
  return (
    <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)}>
      {children}
    </h2>
  )
}

export interface DrawerBodyProps {
  children: React.ReactNode
  className?: string
}

export function DrawerBody({ children, className }: DrawerBodyProps) {
  return <div className={cn('flex-1 overflow-y-auto px-6 py-4', className)}>{children}</div>
}

export interface DrawerFooterProps {
  children: React.ReactNode
  className?: string
}

export function DrawerFooter({ children, className }: DrawerFooterProps) {
  return (
    <div className={cn('flex justify-end gap-3 border-t px-6 py-4', className)}>{children}</div>
  )
}

export interface DrawerCloseProps {
  children: React.ReactNode
  className?: string
}

export function DrawerClose({ children, className }: DrawerCloseProps) {
  const { setOpen } = useDrawer()
  return (
    <button onClick={() => setOpen(false)} type="button" className={cn('', className)}>
      {children}
    </button>
  )
}
