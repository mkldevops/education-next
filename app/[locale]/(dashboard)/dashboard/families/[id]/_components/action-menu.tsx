'use client'

import { Button, useMenu } from '@peaklab/ui'
import type { LucideIcon } from 'lucide-react'
import {
  Archive,
  BookPlus,
  CreditCard,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { useRouter } from '@/i18n/routing'
import { cn } from '@/lib/utils'

type Props = {
  familyId: string
  canEnroll: boolean
  canRecordPayment: boolean
  hasUnpayableBalance?: boolean
}

type FamilyAction = 'addPayment' | 'addStudent' | 'addEnrollment' | 'editFamily' | 'archiveFamily'

type FamilyActionItem = {
  key: string
  label: string
  icon: LucideIcon
  action?: FamilyAction
  danger?: boolean
  disabled?: boolean
  title?: string
}

export function ActionMenu({ familyId, canEnroll, canRecordPayment, hasUnpayableBalance }: Props) {
  const t = useTranslations('dashboard.pages.familyDetails.actions')
  const router = useRouter()

  const handleAction = useCallback(
    (action: FamilyAction) => {
      router.push(`/dashboard/families/${familyId}?action=${action}`)
    },
    [familyId, router]
  )

  const primaryActions: FamilyActionItem[] = [
    {
      key: 'pay',
      label: t('pay'),
      icon: CreditCard,
      action: 'addPayment',
      disabled: !canRecordPayment,
      title: canRecordPayment
        ? undefined
        : hasUnpayableBalance
          ? t('payNoActiveEnrollment')
          : t('payUnavailable'),
    },
    {
      key: 'newStudent',
      label: t('newStudent'),
      icon: UserPlus,
      action: 'addStudent',
    },
    ...(canEnroll
      ? [
          {
            key: 'newEnrollment',
            label: t('newEnrollment'),
            icon: BookPlus,
            action: 'addEnrollment' as const,
          },
        ]
      : []),
  ]

  const managementActions: FamilyActionItem[] = [
    {
      key: 'edit',
      label: t('edit'),
      icon: Pencil,
      action: 'editFamily',
    },
    {
      key: 'delete',
      label: t('delete'),
      icon: Trash2,
      disabled: true,
      title: t('deleteUnavailable'),
    },
    {
      key: 'archive',
      label: t('archive'),
      icon: Archive,
      action: 'archiveFamily',
      danger: true,
    },
  ]

  const mobileActions = [...primaryActions, ...managementActions]

  return (
    <>
      <div className="hidden items-center gap-2 md:flex">
        {primaryActions.map(({ key, label, icon: Icon, action, disabled, title }) => (
          <Button
            key={key}
            size="sm"
            disabled={disabled}
            title={title ?? label}
            aria-label={label}
            className="px-2 lg:px-3"
            onClick={() => action && handleAction(action)}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden lg:inline">{label}</span>
          </Button>
        ))}
        <ActionDropdown ariaLabel={t('manage')} items={managementActions} onSelect={handleAction} />
      </div>

      <div className="md:hidden">
        <ActionDropdown ariaLabel={t('manage')} items={mobileActions} onSelect={handleAction} />
      </div>
    </>
  )
}

function ActionDropdown({
  ariaLabel,
  items,
  onSelect,
}: {
  ariaLabel: string
  items: FamilyActionItem[]
  onSelect: (action: FamilyAction) => void
}) {
  const { open, close, toggle, containerRef, triggerRef, menuRef } = useMenu()

  return (
    <div ref={containerRef} className="relative">
      <Button
        ref={triggerRef}
        size="sm"
        variant="outline"
        className="w-8 px-0"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded border border-gray-200 bg-white py-1 shadow-lg"
        >
          {items.map(({ key, label, icon: Icon, action, danger, disabled, title }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              disabled={disabled}
              title={title}
              onClick={() => {
                if (!action) return
                close()
                onSelect(action)
              }}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                disabled && 'cursor-not-allowed text-gray-400',
                !disabled && !danger && 'text-gray-700 hover:bg-gray-50',
                !disabled && danger && 'text-red-600 hover:bg-red-50'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4',
                  disabled && 'text-gray-300',
                  !disabled && !danger && 'text-gray-400',
                  !disabled && danger && 'text-red-500'
                )}
              />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
