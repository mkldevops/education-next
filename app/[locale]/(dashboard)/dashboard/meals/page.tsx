import { Breadcrumbs, Card, CardContent, CardHeader, CardTitle } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { priceOn } from '@/domain/meal-price'
import { schoolToday } from '@/domain/school-date'
import { staffMealGateway } from '@/gateways/staff-meal-gateway'
import { MealService } from '@/generated/prisma/enums'
import { Link } from '@/i18n/routing'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { dailyMealHeadcount } from '@/use-cases/meals/daily-meal-headcount'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { AddMealPriceDialog } from './_components/add-meal-price-dialog'
import { MealServiceSettingsForm } from './_components/meal-service-settings-form'
import { RemoveMealPriceButton } from './_components/remove-meal-price-button'
import { RemoveStaffMealButton } from './_components/remove-staff-meal-button'
import { StaffMealDialog } from './_components/staff-meal-dialog'

type Props = {
  params: Promise<{ locale: string }>
}

const SERVICES = Object.values(MealService)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.meals.title')
}

export default async function MealsPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.meals')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { schoolId } = await requireSchoolAdmin()

  if (!(await isMealsEnabled(schoolId))) notFound()

  const [{ currency, timeZone }, settings, prices, staffMeals, teachers] = await Promise.all([
    getSchoolRegionalSettings(schoolId),
    db.mealServiceSetting.findMany({
      where: { schoolId },
      select: { service: true, isEnabled: true, allowedWeekdays: true },
    }),
    db.mealPrice.findMany({
      where: { schoolId },
      select: { id: true, service: true, amount: true, effectiveFrom: true },
      orderBy: { effectiveFrom: 'desc' },
    }),
    staffMealGateway.listActive(schoolId),
    staffMealGateway.listActiveTeachers(schoolId),
  ])
  const today = schoolToday(timeZone)
  const headcount = await dailyMealHeadcount({ schoolId, day: today })
  const fullName = (person: { firstName: string; lastName: string }) =>
    `${person.firstName} ${person.lastName}`.trim()
  const staffServices = settings
    .filter((setting) => setting.isEnabled && setting.allowedWeekdays.length > 0)
    .map(({ service, allowedWeekdays }) => ({ service, allowedWeekdays }))
  // Les dates `@db.Date` sont à minuit UTC : formatées en UTC, elles gardent leur jour.
  const formatDay = (day: string) =>
    new Date(`${day}T00:00:00.000Z`).toLocaleDateString(locale, { timeZone: 'UTC' })

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('meals') },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
          <p className="text-sm text-graphite-600">{t('intro')}</p>
        </div>
        <Link href="/dashboard/cashier/debtors" className="text-sm text-foreground hover:underline">
          {t('debtorsLink')}
        </Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {SERVICES.map((service) => {
          const setting = settings.find((row) => row.service === service)
          const history = prices
            .filter((price) => price.service === service)
            .map((price) => ({
              id: price.id,
              amount: Number(price.amount),
              effectiveFrom: price.effectiveFrom.toISOString().slice(0, 10),
            }))
          const current = priceOn(history, today)
          const served = typeof headcount === 'string' ? null : headcount[service]

          return (
            <Card key={service} className="rounded border border-alabaster-700">
              <CardHeader>
                <CardTitle>{t(`services.${service}`)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {served && (
                  <p className="text-sm text-graphite">
                    {t('headcount.today', {
                      students: served.students,
                      staff: served.staff,
                      free: served.staffFree,
                    })}
                  </p>
                )}
                <MealServiceSettingsForm
                  service={service}
                  isEnabled={setting?.isEnabled ?? false}
                  allowedWeekdays={setting?.allowedWeekdays ?? []}
                />
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-medium text-graphite">
                      {current === null
                        ? t('prices.none')
                        : t('prices.current', {
                            amount: formatCurrency(current, locale, currency),
                          })}
                    </h2>
                    <AddMealPriceDialog
                      service={service}
                      currency={currency}
                      today={today}
                      hasPrice={history.length > 0}
                    />
                  </div>
                  {history.length > 0 && (
                    <ul className="divide-y divide-alabaster-700 text-sm">
                      {history.map((price) => {
                        const upcoming = price.effectiveFrom > today
                        return (
                          <li key={price.id} className="flex items-center gap-3 py-2">
                            <span className="font-medium text-graphite">
                              {formatCurrency(price.amount, locale, currency)}
                            </span>
                            <span className="text-graphite-600">
                              {t('prices.from', { date: formatDay(price.effectiveFrom) })}
                            </span>
                            {upcoming && (
                              <span className="ml-auto flex items-center gap-2">
                                <span className="text-xs text-graphite-600">
                                  {t('prices.upcoming')}
                                </span>
                                <RemoveMealPriceButton id={price.id} />
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <Card className="rounded border border-alabaster-700">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{t('staff.title')}</CardTitle>
            <StaffMealDialog
              teachers={teachers.map((teacher) => ({ id: teacher.id, name: fullName(teacher) }))}
              services={staffServices}
            />
          </div>
          <p className="text-sm text-graphite-600">{t('staff.intro')}</p>
        </CardHeader>
        <CardContent>
          {staffMeals.length === 0 ? (
            <p className="text-sm text-graphite-600">{t('staff.empty')}</p>
          ) : (
            <ul className="divide-y divide-alabaster-700 text-sm">
              {staffMeals.map((meal) => (
                <li
                  key={`${meal.teacherId}-${meal.service}`}
                  className="flex flex-wrap items-center gap-3 py-2"
                >
                  <span className="font-medium text-graphite">{fullName(meal.teacher)}</span>
                  <span className="text-graphite-600">{t(`services.${meal.service}`)}</span>
                  <span className="text-graphite-600">
                    {meal.weekdays.map((day) => t(`weekdays.${day}`)).join(', ')}
                  </span>
                  {meal.isFree && (
                    <span className="text-xs font-medium text-graphite">{t('staff.free')}</span>
                  )}
                  <span className="ml-auto">
                    <RemoveStaffMealButton
                      teacherId={meal.teacherId}
                      service={meal.service}
                      name={fullName(meal.teacher)}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
