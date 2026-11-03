import { Card, ProgressBar } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { classFillRate, type SchoolInsights } from '../_lib/school-insights'

interface Props {
  classes: SchoolInsights['classes']
}

const CLASSES_LISTED = 6

function sameLabel(name: string, level: string) {
  return name.includes(level) || level.includes(name)
}

export async function SchoolInsightsSection({ classes }: Props) {
  const t = await getTranslations('dashboard.insights')

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t('classFillTitle')}</h2>
        <Link
          href="/dashboard/classes"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('viewClasses')}
        </Link>
      </div>
      {classes.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t('noClasses')}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {classes.slice(0, CLASSES_LISTED).map((classPeriod) => (
            <li key={classPeriod.id}>
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/dashboard/classes/${classPeriod.id}`}
                  className="truncate text-sm font-medium text-foreground hover:underline"
                >
                  {classPeriod.name}
                </Link>
                <span className="shrink-0 text-sm text-foreground tabular-nums">
                  {classPeriod.enrolled}/{classPeriod.capacity}
                  {!sameLabel(classPeriod.name, classPeriod.level) && (
                    <span className="ml-2 text-xs text-muted-foreground">{classPeriod.level}</span>
                  )}
                </span>
              </div>
              <div className="mt-2">
                <ProgressBar value={classFillRate(classPeriod) * 100} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
