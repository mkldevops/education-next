'use client'

import { useState } from 'react'
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

  return (
    <div>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                'py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                i === active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-6">{tabs[active]?.content}</div>
    </div>
  )
}
