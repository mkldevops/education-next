'use client'

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../utils'

interface DialogContextType {
  open: boolean
  setOpen: (open: boolean) => void
  titleId: string
}

const DialogStateContext = createContext<DialogContextType | null>(null)

export function useDialog() {
  const context = useContext(DialogStateContext)
  if (!context) {
    throw new Error('useDialog must be used within Dialog')
  }
  return context
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

export interface DialogProps {
  children: React.ReactNode
  initialOpen?: boolean
}

export function Dialog({ children, initialOpen = false }: DialogProps) {
  const [open, setOpen] = useState(initialOpen)
  const titleId = useId()

  return (
    <DialogStateContext.Provider value={{ open, setOpen, titleId }}>
      {children}
    </DialogStateContext.Provider>
  )
}

export interface DialogRouteOpenerProps {
  open: boolean
  cleanUrl?: string
}

export function DialogRouteOpener({ open, cleanUrl }: DialogRouteOpenerProps) {
  const { setOpen } = useDialog()

  useEffect(() => {
    if (!open) return
    setOpen(true)
    if (cleanUrl) window.history.replaceState(null, '', cleanUrl)
  }, [open, cleanUrl, setOpen])

  return null
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
  const { open, setOpen, titleId } = useDialog()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const [firstFocusable] = panel ? getFocusableElements(panel) : []
    ;(firstFocusable ?? panel)?.focus()

    return () => {
      previouslyFocused?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const focusable = getFocusableElements(panel)
      if (focusable.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full max-w-lg rounded-xl bg-white text-gray-900 shadow-2xl ring-1 ring-gray-900/5',
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

export interface DialogHeaderProps {
  children: React.ReactNode
  className?: string
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return (
    <div className={cn('space-y-1.5 border-b border-gray-200 px-6 py-4', className)}>
      {children}
    </div>
  )
}

export interface DialogTitleProps {
  children: React.ReactNode
  className?: string
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  const { titleId } = useDialog()
  return (
    <h2 id={titleId} className={cn('text-lg font-semibold leading-none tracking-tight', className)}>
      {children}
    </h2>
  )
}

export interface DialogBodyProps {
  children: React.ReactNode
  className?: string
}

export function DialogBody({ children, className }: DialogBodyProps) {
  return (
    <div className={cn('max-h-[65vh] space-y-4 overflow-y-auto px-6 py-4', className)}>
      {children}
    </div>
  )
}

export interface DialogFooterProps {
  children: React.ReactNode
  className?: string
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div
      className={cn(
        'flex justify-end gap-3 rounded-b-xl border-t border-gray-200 bg-gray-50 px-6 py-4',
        className
      )}
    >
      {children}
    </div>
  )
}
