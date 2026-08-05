'use client'

import { useId, useRef, useState } from 'react'
import { cn } from '../utils'

type Tab = {
  label: string
  content: React.ReactNode
}

type Props = {
  tabs: Tab[]
  defaultIndex?: number
}

export function Tabs({ tabs, defaultIndex = 0 }: Props) {
  const [active, setActive] = useState(defaultIndex)
  const idPrefix = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const activate = (index: number) => {
    setActive(index)
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
      <div className="border-b border-gray-200">
        <div className="-mb-px flex gap-6" role="tablist" aria-orientation="horizontal">
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
              onClick={() => setActive(i)}
              onKeyDown={(event) => handleKeyDown(event, i)}
              className={cn(
                'px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                'rounded-t-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                i === active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
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
