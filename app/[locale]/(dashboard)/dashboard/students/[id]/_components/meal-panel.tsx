import { Card } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { summarizeMealAccount } from '@/domain/meal-account-summary'
import { isSchoolClosed } from '@/domain/school-closure'
import { schoolToday } from '@/domain/school-date'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { MealService } from '@/generated/prisma/enums'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { MealDialog } from './meal-dialogs'

type Props = {
  schoolId: string
  studentId: string
  locale: string
  selectedPeriodId: string | null
}

const SERVICES = Object.values(MealService)

/** Abonnements cantine et goûter d'un élève : jours servis, payé jusqu'au, reprise. */
export async function MealPanel({ schoolId, studentId, locale, selectedPeriodId }: Props) {
  const t = await getTranslations('dashboard.pages.studentDetails.meals')
  const tServices = await getTranslations('dashboard.pages.meals.services')
  const tWeekdays = await getTranslations('dashboard.pages.meals.weekdays')

  const [{ currency, timeZone }, settings, prices, accounts, period] = await Promise.all([
    getSchoolRegionalSettings(schoolId),
    db.mealServiceSetting.findMany({
      where: { schoolId },
      select: { service: true, isEnabled: true, allowedWeekdays: true },
    }),
    db.mealPrice.findMany({
      where: { schoolId },
      select: { service: true, amount: true, effectiveFrom: true },
    }),
    mealAccountGateway.findStudentAccounts(schoolId, studentId),
    selectedPeriodId ? mealAccountGateway.findPeriod(schoolId, selectedPeriodId) : null,
  ])
  const today = schoolToday(timeZone)
  const schedules = accounts.flatMap((account) => account.schedules)
  const closures =
    schedules.length > 0
      ? await mealAccountGateway.findClosures(
          schoolId,
          schedules.reduce((first, s) => (s.startOn < first ? s.startOn : first), today),
          schedules.reduce((last, s) => (s.periodEnd > last ? s.periodEnd : last), today)
        )
      : []
  const isClosed = (day: string) => isSchoolClosed(closures, new Date(`${day}T00:00:00.000Z`))
  // Les dates `@db.Date` sont à minuit UTC : formatées en UTC, elles gardent leur jour.
  const formatDay = (day: string) =>
    new Date(`${day}T00:00:00.000Z`).toLocaleDateString(locale, { timeZone: 'UTC' })

  const rows = SERVICES.map((service) => {
    const setting = settings.find((s) => s.service === service)
    const account = accounts.find((a) => a.service === service)
    const summary = account
      ? summarizeMealAccount({
          segments: account.schedules,
          adjustments: account.adjustments,
          prices: prices
            .filter((price) => price.service === service)
            .map((price) => ({
              amount: Number(price.amount),
              effectiveFrom: price.effectiveFrom.toISOString().slice(0, 10),
            })),
          isClosed,
          today,
        })
      : null
    const upcoming =
      summary?.current && account
        ? (account.schedules.find((s) => s.startOn > (summary.current?.startOn ?? today)) ?? null)
        : null
    return { service, setting, summary, upcoming }
  }).filter(({ setting, summary }) => setting?.isEnabled || summary?.current)

  if (rows.length === 0) return null

  return (
    <Card className="p-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-graphite-600">
        {t('title')}
      </h2>
      <div className="mt-3 divide-y divide-graphite-100">
        {rows.map(({ service, setting, summary, upcoming }) => {
          const current = summary?.current ?? null
          const coverage = summary?.coverage
          const dialog = {
            studentId,
            service,
            allowedWeekdays: setting?.allowedWeekdays ?? [],
            weekdays: current?.weekdays ?? [],
            today,
            period: period && selectedPeriodId ? { id: selectedPeriodId, ...period } : null,
          }
          return (
            <section key={service} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <h3 className="text-sm font-semibold text-graphite">{tServices(service)}</h3>
              {current ? (
                <dl className="space-y-1 text-sm">
                  <div>
                    <dt className="text-xs text-graphite-600">{t('days')}</dt>
                    <dd className="text-graphite">
                      {current.weekdays.map((day) => tWeekdays(String(day))).join(', ')}
                    </dd>
                    <dd className="text-xs text-graphite-600">
                      {current.endOn
                        ? t('between', {
                            start: formatDay(current.startOn),
                            end: formatDay(current.endOn),
                          })
                        : t('since', { start: formatDay(current.startOn) })}
                    </dd>
                    {upcoming && (
                      <dd className="text-xs text-graphite-600">
                        {t('upcoming', {
                          start: formatDay(upcoming.startOn),
                          days: upcoming.weekdays.map((day) => tWeekdays(String(day))).join(', '),
                        })}
                      </dd>
                    )}
                  </div>
                  <div>
                    <dt className="text-xs text-graphite-600">{t('paidThrough')}</dt>
                    <dd className="text-graphite">
                      {coverage?.paidThrough ? formatDay(coverage.paidThrough) : t('nothingPaid')}
                    </dd>
                    {coverage && coverage.dueDays > 0 && (
                      <dd className="text-xs text-amber-600">
                        {t('due', {
                          days: coverage.dueDays,
                          amount: formatCurrency(coverage.dueAmount, locale, currency),
                        })}
                      </dd>
                    )}
                  </div>
                  {summary?.opening && (
                    <div>
                      <dt className="text-xs text-graphite-600">{t('opening')}</dt>
                      <dd className="text-graphite">
                        {t('openingDays', { days: summary.opening.days })}
                        <span className="text-graphite-600"> · {summary.opening.reason}</span>
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-graphite-600">
                  {dialog.period ? t('notSubscribed') : t('selectPeriod')}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {!current && setting?.isEnabled && dialog.period && (
                  <MealDialog kind="subscribe" {...dialog} />
                )}
                {current && setting?.isEnabled && <MealDialog kind="change" {...dialog} />}
                {current && <MealDialog kind="stop" {...dialog} />}
                {current && <MealDialog kind="opening" {...dialog} />}
              </div>
            </section>
          )
        })}
      </div>
    </Card>
  )
}
