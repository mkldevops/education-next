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
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../utils'

interface DialogContextType {
  open: boolean
  setOpen: (open: boolean) => void
  titleId: string
  restoreFocusRef?: React.RefObject<HTMLElement | null>
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

/**
 * Un navigateur refuse silencieusement `focus()` sur un élément masqué (`display: none`), non
 * connecté au document, ou désactivé : `document.activeElement` reste alors inchangé. C'est
 * l'observable fiable, contrairement à `offsetParent` — toujours `null` en jsdom, indépendamment
 * de toute mise en page réelle.
 */
function focusIfPossible(element: HTMLElement | null | undefined) {
  if (!element) return false
  element.focus()
  return document.activeElement === element
}

export interface DialogProps {
  children: React.ReactNode
  initialOpen?: boolean
  /**
   * Cible de repli quand l'élément qui avait le focus à l'ouverture est devenu inaccessible à la
   * fermeture — par exemple un déclencheur masqué en CSS parce que le menu qui le contient s'est
   * refermé pendant que le dialogue était ouvert.
   */
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

export function Dialog({ children, initialOpen = false, restoreFocusRef }: DialogProps) {
  const [open, setOpen] = useState(initialOpen)
  const titleId = useId()

  return (
    <DialogStateContext.Provider value={{ open, setOpen, titleId, restoreFocusRef }}>
      {children}
    </DialogStateContext.Provider>
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

const subscribeNoop = () => () => {}

/**
 * `false` au rendu serveur et pendant l'hydratation, `true` ensuite. Un dialogue ouvert dès le
 * rendu serveur (lien `?action=`) ne peut pas être portalisé côté serveur : le client doit donc
 * rendre la même absence de contenu à l'hydratation, puis le portail au rendu suivant.
 */
function useIsClient() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )
}

export interface DialogContentProps {
  children: React.ReactNode
  className?: string
}

export function DialogContent({ children, className }: DialogContentProps) {
  const { open, setOpen, titleId, restoreFocusRef } = useDialog()
  const panelRef = useRef<HTMLDivElement>(null)
  const isClient = useIsClient()

  // `isClient` en dépendance : un dialogue hydraté ouvert (`?action=`) n'a pas encore de
  // portail au premier passage de l'effet ; il faut le relancer quand le panneau existe.
  useEffect(() => {
    if (!open || !isClient) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const [firstFocusable] = panel ? getFocusableElements(panel) : []
    ;(firstFocusable ?? panel)?.focus()

    return () => {
      // L'élément qui avait le focus à l'ouverture a pu devenir inaccessible pendant que le
      // dialogue était ouvert — par exemple masqué en CSS par le menu qui le contenait.
      if (!focusIfPossible(previouslyFocused)) focusIfPossible(restoreFocusRef?.current)
    }
  }, [open, isClient, restoreFocusRef])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return

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
      if (!panel.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
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

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open || !isClient) return null

  return createPortal(
    <div className="dialog-viewport fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-graphite/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 max-h-[calc(var(--app-available-height,100dvh)-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white text-graphite shadow-2xl ring-1 ring-graphite/5',
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
    <div className={cn('space-y-1.5 border-b border-alabaster-700 px-6 py-4', className)}>
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
        'flex justify-end gap-3 rounded-b-xl border-t border-alabaster-700 bg-alabaster-900 px-6 py-4',
        className
      )}
    >
      {children}
    </div>
  )
}
