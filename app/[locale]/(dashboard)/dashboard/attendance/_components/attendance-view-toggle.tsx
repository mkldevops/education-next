import { Link } from '@/i18n/routing'

export function AttendanceViewToggle({
  current,
  dayHref,
  periodHref,
  labels,
}: {
  current: 'day' | 'period'
  dayHref: string
  periodHref: string
  labels: { group: string; day: string; period: string }
}) {
  const item = (active: boolean) =>
    `inline-flex min-h-11 items-center px-4 text-sm font-semibold ${active ? 'bg-graphite text-white' : 'bg-white text-graphite hover:bg-alabaster-800'}`
  return (
    <nav
      aria-label={labels.group}
      className="inline-flex overflow-hidden rounded border border-alabaster-600 print:hidden"
    >
      <Link
        href={dayHref}
        aria-current={current === 'day' ? 'page' : undefined}
        className={item(current === 'day')}
      >
        {labels.day}
      </Link>
      <Link
        href={periodHref}
        aria-current={current === 'period' ? 'page' : undefined}
        className={item(current === 'period')}
      >
        {labels.period}
      </Link>
    </nav>
  )
}
