import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'

export type StudentsStatus = 'active' | 'former'

type Props = {
  status: StudentsStatus
  activeCount: number
  formerCount: number
}

/** Bascule « Actifs / Anciens » de la liste des élèves, portée par `?status=former`. */
export async function StudentsStatusToggle({ status, activeCount, formerCount }: Props) {
  const t = await getTranslations('dashboard.pages.students')
  const options = [
    { value: 'active', href: '/dashboard/students', label: t('statusActive'), count: activeCount },
    {
      value: 'former',
      href: '/dashboard/students?status=former',
      label: t('statusFormer'),
      count: formerCount,
    },
  ] as const

  return (
    <nav
      aria-label={t('statusLabel')}
      className="inline-flex rounded-lg border border-border bg-white p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === status
        return (
          <Link
            key={option.value}
            href={option.href}
            aria-current={selected ? 'page' : undefined}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm ${selected ? 'bg-graphite text-white' : 'text-graphite hover:bg-alabaster-900'}`}
          >
            {option.label}
            <span className="tabular-nums opacity-70">{option.count}</span>
          </Link>
        )
      })}
    </nav>
  )
}
