'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../utils'

export type Tab = {
  /** Ancre d'URL (`#id`) qui ouvre cet onglet et que la sélection de l'onglet écrit. */
  id?: string
  /** Autres ancres qui ouvrent cet onglet, comme celle d'une section qu'il contient. */
  anchors?: string[]
  label: string
  icon?: React.ComponentType<{ size?: number }>
  content: React.ReactNode
}

export type TabsProps = {
  tabs: Tab[]
  defaultIndex?: number
  ariaLabel?: string
}

export function Tabs({ tabs, defaultIndex = 0, ariaLabel }: TabsProps) {
  const [active, setActive] = useState(defaultIndex)
  const idPrefix = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  // Clé stable : un tableau `tabs` recréé à chaque rendu ne doit pas relancer la synchronisation.
  const anchorKey = tabs.map((tab) => [tab.id ?? '', ...(tab.anchors ?? [])].join(' ')).join('|')

  // L'ancre n'est lue qu'après l'hydratation : le serveur ignore le fragment d'URL.
  useEffect(() => {
    const anchors = anchorKey.split('|').map((group) => group.split(' ').filter(Boolean))
    if (anchors.every((group) => group.length === 0)) return
    const syncFromHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1))
      const index = anchors.findIndex((group) => group.includes(hash))
      if (index >= 0) setActive(index)
    }
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [anchorKey])

  const select = (index: number) => {
    setActive(index)
    const id = tabs[index]?.id
    if (id) window.history.replaceState(window.history.state, '', `#${id}`)
  }

  const activate = (index: number) => {
    select(index)
    tabRefs.current[index]?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        activate((index + 1) % tabs.length)
        break
      case 'ArrowLeft':
        event.preventDefault()
        activate((index - 1 + tabs.length) % tabs.length)
        break
      case 'Home':
        event.preventDefault()
        activate(0)
        break
      case 'End':
        event.preventDefault()
        activate(tabs.length - 1)
        break
    }
  }

  return (
    <div>
      <div className="border-b border-alabaster-700">
        <div className="overflow-x-auto">
          <div
            className="-mb-px flex gap-6 px-1"
            role="tablist"
            aria-label={ariaLabel}
            aria-orientation="horizontal"
          >
            {tabs.map((tab, i) => (
              <button
                key={tab.label}
                ref={(el) => {
                  tabRefs.current[i] = el
                }}
                type="button"
                role="tab"
                id={`${idPrefix}-tab-${i}`}
                aria-controls={`${idPrefix}-panel`}
                aria-selected={i === active}
                tabIndex={i === active ? 0 : -1}
                onClick={() => select(i)}
                onKeyDown={(event) => handleKeyDown(event, i)}
                className={cn(
                  'flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  'rounded-t focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  i === active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-graphite-600 hover:text-graphite hover:border-alabaster'
                )}
              >
                {tab.icon ? (
                  <span aria-hidden="true">
                    <tab.icon size={16} />
                  </span>
                ) : null}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        className="mt-6"
        role="tabpanel"
        id={`${idPrefix}-panel`}
        aria-labelledby={`${idPrefix}-tab-${active}`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA tabpanel must stay keyboard-reachable when its content has no focusable element
        tabIndex={0}
      >
        {tabs[active]?.content}
      </div>
    </div>
  )
}
