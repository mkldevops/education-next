'use client'

import { useMenu } from '@peaklab/ui'
import { Check, ChevronsUpDown, LoaderCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { switchSchoolAction } from '@/actions/school-actions'
import type { AuthorizedSchool } from '@/domain/school-scope'
import { usePathname, useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { toInitials } from './initials'
import { schoolSwitchLanding } from './school-switch-landing'
import { SidebarBrand } from './sidebar-brand'

type Props = {
  schools: AuthorizedSchool[]
  activeSchoolId?: string
  displayName: string
  logoUrl?: string
  expanded: boolean
  canSwitchSchool: boolean
}

/**
 * Tête de la barre latérale : bascule d'école, ou identité fixe.
 *
 * Un menu d'un seul choix n'en est pas un : sous deux écoles la tête reste le bandeau
 * de marque, sans déclencheur. Le drapeau plateforme éteint donne exactement le même
 * repli — l'action refuse de son côté, l'interface ne fait que ne plus le proposer.
 * La liste reçue ne contient que des écoles actives — `getAuthorizedSchools()` filtre
 * à la source — donc aucune école désactivée ne peut être proposée ici.
 */
export function SchoolSwitcher({
  schools,
  activeSchoolId,
  displayName,
  logoUrl,
  expanded,
  canSwitchSchool,
}: Props) {
  const t = useTranslations('schools.switcher')
  const { open, close, toggle, containerRef, triggerRef, menuRef } = useMenu()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [targetId, setTargetId] = useState<string | null>(null)

  if (!canSwitchSchool || schools.length <= 1) {
    return <SidebarBrand displayName={displayName} logoUrl={logoUrl} expanded={expanded} />
  }

  const active = schools.find((school) => school.id === activeSchoolId)
  const label = active?.name ?? displayName

  const target = schools.find((school) => school.id === targetId)

  const onSelect = (schoolId: string) => {
    close(false)
    if (schoolId === activeSchoolId) return

    setTargetId(schoolId)
    startTransition(async () => {
      const result = await switchSchoolAction(schoolId)
      if (result !== 'OK') {
        setTargetId(null)
        toast.error(t('error'))
        return
      }

      // React ne prolonge pas la transition au-delà de l'`await` : sans cette seconde
      // portée, `isPending` retomberait avant que le rendu serveur de la nouvelle école
      // soit revenu, et l'écran resterait sur les données de l'ancienne sans indication.
      startTransition(() => {
        const landing = schoolSwitchLanding(pathname)
        if (landing === pathname) router.refresh()
        else router.replace(landing)
      })
    })
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative shrink-0 py-4',
        expanded ? 'min-h-16 border-b border-alabaster-700 px-3' : 'px-2'
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={expanded ? undefined : label}
        className={cn(
          'flex w-full items-center rounded transition-colors hover:bg-alabaster-900',
          expanded ? 'gap-2 px-3 py-1.5' : 'justify-center p-1.5'
        )}
      >
        <SchoolMark displayName={label} logoUrl={logoUrl} />
        {expanded && (
          <>
            <span className="flex-1 truncate text-left text-sm font-bold text-primary">
              {label}
            </span>
            <ChevronsUpDown size={16} className="shrink-0 text-graphite-800" />
          </>
        )}
      </button>

      {isPending &&
        createPortal(
          // La barre latérale porte `translate-x-*` en permanence, ce qui en fait le bloc
          // conteneur de ses descendants `fixed` : rendu sur place, le voile se replierait
          // sur la colonne et laisserait l'ancienne école visible. Le portail l'ancre au
          // `body`, comme l'infobulle de `sidebar-nav-item`.
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm"
          >
            <LoaderCircle size={28} className="animate-spin text-primary" aria-hidden />
            <span className="text-sm font-medium text-graphite-600">
              {target ? t('switching', { schoolName: target.name }) : t('label')}
            </span>
          </div>,
          document.body
        )}

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t('label')}
          className={cn(
            'absolute z-40 rounded border border-alabaster-700 bg-white p-1 shadow-lg',
            expanded ? 'left-3 right-3 top-full mt-1' : 'left-full top-2 ml-2 w-56'
          )}
        >
          {schools.map((school) => (
            <button
              key={school.id}
              type="button"
              role="menuitem"
              onClick={() => onSelect(school.id)}
              className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-graphite-600 transition-colors hover:bg-alabaster-900 hover:text-graphite"
            >
              <span className="flex-1 truncate">{school.name}</span>
              {school.id === activeSchoolId && (
                <Check size={16} className="shrink-0 text-primary" aria-hidden />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SchoolMark({ displayName, logoUrl }: { displayName: string; logoUrl?: string }) {
  if (logoUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: dynamic logo URL from config
      <img src={logoUrl} alt="" aria-hidden className="size-8 rounded object-contain" />
    )
  }

  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded bg-gradient-to-br from-primary to-primary/70 text-[13px] font-extrabold text-white"
    >
      {toInitials(displayName)}
    </span>
  )
}
