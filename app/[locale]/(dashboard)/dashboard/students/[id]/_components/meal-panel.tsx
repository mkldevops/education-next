import { Card, cn } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { schoolToday } from '@/domain/school-date'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { MealService } from '@/generated/prisma/enums'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { loadMealAccountSummaries } from '@/use-cases/meals/meal-account-summaries'
import { MealCalendar } from './meal-calendar'
import { MealDialog } from './meal-dialogs'

type Props = {
  schoolId: string
  studentId: string
  locale: string
  selectedPeriodId: string | null
  /** La reprise d'un solde corrige l'historique : réservée à l'administration. */
  canRecordOpening?: boolean
}

const SERVICES = Object.values(MealService)

/** Abonnements cantine et goûter d'un élève : jours servis, payé jusqu'au, reprise. */
export async function MealPanel({
  schoolId,
  studentId,
  locale,
  selectedPeriodId,
  canRecordOpening = true,
}: Props) {
  const t = await getTranslations('dashboard.pages.studentDetails.meals')
  const tServices = await getTranslations('dashboard.pages.meals.services')
  const tWeekdays = await getTranslations('dashboard.pages.meals.weekdays')

  const [{ currency, timeZone }, settings, accounts, period] = await Promise.all([
    getSchoolRegionalSettings(schoolId),
    db.mealServiceSetting.findMany({
      where: { schoolId },
      select: { service: true, isEnabled: true, allowedWeekdays: true },
    }),
    mealAccountGateway.findStudentAccounts(schoolId, [studentId]),
    selectedPeriodId ? mealAccountGateway.findPeriod(schoolId, selectedPeriodId) : null,
  ])
  const today = schoolToday(timeZone)
  const summaries = await mealAccountGateway.transaction((tx) =>
    loadMealAccountSummaries(tx, { schoolId, accounts, today })
  )
  // Montrer aussi les fermetures hors des jours de repas de l'élève (ex. week-ends de vacances).
  const months = [
    ...new Set(
      [...summaries.values()].flatMap((summary) =>
        summary.calendar.map(({ day }) => day.slice(0, 7))
      )
    ),
  ].sort()
  const firstMonth = months[0]
  const lastMonth = months.at(-1)
  const closures =
    firstMonth && lastMonth
      ? await mealAccountGateway.findClosures(
          schoolId,
          `${firstMonth}-01`,
          new Date(Date.UTC(Number(lastMonth.slice(0, 4)), Number(lastMonth.slice(5, 7)), 0))
            .toISOString()
            .slice(0, 10)
        )
      : []
  const calendarClosures = closures.map((event) => ({
    category: event.category,
    startOn: event.startAt.toISOString().slice(0, 10),
    endOn: (event.endAt ?? event.startAt).toISOString().slice(0, 10),
  }))

  // Les dates `@db.Date` sont à minuit UTC : formatées en UTC, elles gardent leur jour.
  const formatDay = (day: string) =>
    new Date(`${day}T00:00:00.000Z`).toLocaleDateString(locale, { timeZone: 'UTC' })

  const rows = SERVICES.map((service) => {
    const setting = settings.find((s) => s.service === service)
    const account = accounts.find((a) => a.service === service)
    const summary = account ? (summaries.get(account.id) ?? null) : null
    const upcoming =
      summary?.current && account
        ? (account.schedules.find((s) => s.startOn > (summary.current?.startOn ?? today)) ?? null)
        : null
    return { service, setting, summary, upcoming }
  }).filter(({ setting, summary }) => setting?.isEnabled || summary?.current)

  if (rows.length === 0) return null

  return (
    <Card className="@container overflow-hidden p-0">
      <h2 className="border-b border-border px-5 py-4 text-base font-semibold text-graphite">
        {t('title')}
      </h2>
      <div className="divide-y divide-border">
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
            <section key={service}>
              <h3 className="px-5 pt-5 text-sm font-semibold text-graphite">
                {tServices(service)}
              </h3>
              <div
                className={cn('grid', summary && summary.calendar.length > 0 && '@xl:grid-cols-5')}
              >
                <div className="min-w-0 space-y-4 p-5 @xl:col-span-2">
                  {current ? (
                    <dl className="space-y-4 text-sm">
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
                              days: upcoming.weekdays
                                .map((day) => tWeekdays(String(day)))
                                .join(', '),
                            })}
                          </dd>
                        )}
                      </div>
                      <div>
                        <dt className="text-xs text-graphite-600">{t('paidThrough')}</dt>
                        <dd className="text-graphite">
                          {coverage?.paidThrough
                            ? formatDay(coverage.paidThrough)
                            : t('nothingPaid')}
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
                          <dd className="wrap-break-word text-graphite">
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
                </div>
                {summary && summary.calendar.length > 0 && (
                  <div className="min-w-0 border-t border-border p-5 @xl:col-span-3 @xl:border-t-0 @xl:border-l">
                    <MealCalendar
                      studentId={studentId}
                      service={service}
                      days={summary.calendar}
                      today={today}
                      locale={locale}
                      closures={calendarClosures}
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border bg-alabaster-900/40 px-5 py-3">
                {!current && setting?.isEnabled && dialog.period && (
                  <MealDialog kind="subscribe" {...dialog} />
                )}
                {current && setting?.isEnabled && <MealDialog kind="change" {...dialog} />}
                {current && <MealDialog kind="stop" {...dialog} />}
                {current && canRecordOpening && <MealDialog kind="opening" {...dialog} />}
              </div>
            </section>
          )
        })}
      </div>
    </Card>
  )
}
