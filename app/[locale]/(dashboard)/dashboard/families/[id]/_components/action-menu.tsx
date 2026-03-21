'use client'

import { Button } from '@peaklab/ui'
import { CreditCard, GraduationCap, Plus, UserPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

type Props = {
  familyId: string
}

const actions = [
  { key: 'addChild', icon: UserPlus },
  { key: 'addEnrollment', icon: GraduationCap },
  { key: 'addPayment', icon: CreditCard },
] as const

export function ActionMenu({ familyId: _familyId }: Props) {
  const t = useTranslations('dashboard.pages.familyDetails.actions')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button size="sm" onClick={() => setOpen(!open)}>
        <Plus className="mr-1.5 h-4 w-4" />
        {t('new')}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {actions.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Icon className="h-4 w-4 text-gray-400" />
              {t(key)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
