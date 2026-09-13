'use client'

import { useMenu } from '@peaklab/ui'
import { MoreHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'

export type MenuEnrollment = {
  id: string
  /** Nom de la classe affectée, ou du plan quand l'inscription n'a pas encore de classe. */
  label: string
  classPeriodId: string | null
}

type Props = {
  studentId: string
  /** Inscriptions de l'élève, la plus récente en tête. */
  enrollments: MenuEnrollment[]
}

/**
 * Accès secondaires d'une carte enfant : l'élève, son inscription courante et la classe de
 * celle-ci.
 *
 * Un élève réinscrit d'année en année cumule les inscriptions. La plus récente porte les
 * libellés directs ; les précédentes sont listées nommément, sinon le menu leur ferait perdre
 * tout accès.
 */
export function EnrollmentMenu({ studentId, enrollments }: Props) {
  const t = useTranslations('dashboard.pages.familyDetails.childCard.menu')
  const { open, close, toggle, containerRef, triggerRef, menuRef } = useMenu()

  const [current, ...previous] = enrollments
  const itemClass = 'block px-3 py-2 text-xs text-graphite hover:bg-alabaster-900'

  return (
    <div className="relative flex-shrink-0" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        aria-label={t('label')}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded p-1 text-graphite-600 hover:bg-alabaster-800 hover:text-graphite"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 w-52 rounded border border-alabaster-700 bg-white py-1 shadow-lg"
        >
          <Link
            role="menuitem"
            href={`/dashboard/students/${studentId}`}
            onClick={() => close(false)}
            className={itemClass}
          >
            {t('viewStudent')}
          </Link>
          <Link
            role="menuitem"
            href={`/dashboard/enrollments/${current.id}`}
            onClick={() => close(false)}
            className={itemClass}
          >
            {t('viewEnrollment')}
          </Link>
          {current.classPeriodId && (
            <Link
              role="menuitem"
              href={`/dashboard/classes/${current.classPeriodId}`}
              onClick={() => close(false)}
              className={itemClass}
            >
              {t('viewClass')}
            </Link>
          )}
          {previous.length > 0 && (
            <>
              <p className="mt-1 border-t border-alabaster-700 px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-graphite-600">
                {t('previousEnrollments')}
              </p>
              {previous.map((enrollment) => (
                <Link
                  key={enrollment.id}
                  role="menuitem"
                  href={`/dashboard/enrollments/${enrollment.id}`}
                  onClick={() => close(false)}
                  className={itemClass}
                >
                  {enrollment.label}
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
