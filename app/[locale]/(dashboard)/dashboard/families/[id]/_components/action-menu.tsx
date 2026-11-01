'use client'

import { Button, useMenu } from '@peaklab/ui'
import type { LucideIcon } from 'lucide-react'
import { Archive, CreditCard, Merge, MoreHorizontal, Pencil, Trash2, UserPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { useRouter } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { type FamilyAction, familyActionHref } from '../_lib/family-action-href'

type Props = {
  familyId: string
  paymentsEnabled: boolean
  canRecordPayment: boolean
  /** Suppression définitive, réservée à l'administration. */
  canDelete: boolean
}

type FamilyActionItem = {
  key: string
  label: string
  icon: LucideIcon
  action?: FamilyAction
  danger?: boolean
  disabled?: boolean
  title?: string
}

export function ActionMenu({ familyId, paymentsEnabled, canRecordPayment, canDelete }: Props) {
  const t = useTranslations('dashboard.pages.familyDetails.actions')
  const router = useRouter()

  const handleAction = useCallback(
    (action: FamilyAction) => {
      router.push(familyActionHref(familyId, action))
    },
    [familyId, router]
  )

  const primaryActions: FamilyActionItem[] = [
    // `paymentsEnabled` retire l'action : école sans gestion d'argent, pas de « payer »
    // du tout. `canRecordPayment` ne fait que la désactiver — rien à devoir, l'action
    // reste visible pour rester découvrable une fois un solde ouvert.
    ...(paymentsEnabled
      ? [
          {
            key: 'pay',
            label: t('pay'),
            icon: CreditCard,
            action: 'addPayment' as const,
            disabled: !canRecordPayment,
            title: canRecordPayment ? undefined : t('payUnavailable'),
          },
        ]
      : []),
    {
      key: 'newStudent',
      label: t('newStudent'),
      icon: UserPlus,
      action: 'addStudent',
    },
  ]

  const managementActions: FamilyActionItem[] = [
    {
      key: 'edit',
      label: t('edit'),
      icon: Pencil,
      action: 'editFamily',
    },
    {
      key: 'archive',
      label: t('archive'),
      icon: Archive,
      action: 'archiveFamily',
    },
    ...(canDelete
      ? [
          { key: 'merge', label: t('merge'), icon: Merge, action: 'mergeFamily' as const },
          {
            key: 'delete',
            label: t('delete'),
            icon: Trash2,
            action: 'deleteFamily' as const,
            danger: true,
          },
        ]
      : []),
  ]

  const mobileActions = [...primaryActions, ...managementActions]

  return (
    <>
      <div className="hidden items-center gap-2 md:flex">
        {/* Un seul bouton plein en en-tête : le premier (le règlement quand l'école gère
            l'argent), les suivants en contour pour ne pas se disputer l'attention. */}
        {primaryActions.map(({ key, label, icon: Icon, action, disabled, title }, index) => (
          <Button
            key={key}
            size="sm"
            variant={index === 0 ? 'default' : 'outline'}
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
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded border border-alabaster-700 bg-white py-1 shadow-lg"
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
                disabled && 'cursor-not-allowed text-graphite-700',
                !disabled && !danger && 'text-graphite hover:bg-alabaster-900',
                !disabled && danger && 'text-red-600 hover:bg-red-50'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4',
                  disabled && 'text-graphite-800',
                  !disabled && !danger && 'text-graphite-700',
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
