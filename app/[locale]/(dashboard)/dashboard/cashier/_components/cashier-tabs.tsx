import { cn } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'

export type CashierTab = 'collect' | 'day' | 'debtors' | 'staff'

export type CashierTabLabels = Record<CashierTab, string> & { nav: string }

type Props = {
  active: CashierTab
  labels: CashierTabLabels
}

export async function loadCashierTabLabels(): Promise<CashierTabLabels> {
  const t = await getTranslations('dashboard.pages.cashier')
  return {
    nav: t('title'),
    collect: t('tabs.collect'),
    day: t('day.title'),
    debtors: t('debtors.title'),
    staff: t('staff.title'),
  }
}

export function CashierTabs({ active, labels }: Props) {
  const tabs: Array<{ key: CashierTab; href: string }> = [
    { key: 'collect', href: '/dashboard/cashier' },
    { key: 'day', href: '/dashboard/cashier/day' },
    { key: 'debtors', href: '/dashboard/cashier/debtors' },
    { key: 'staff', href: '/dashboard/cashier/staff' },
  ]

  return (
    <nav className="flex flex-wrap gap-1 border-b border-alabaster-700" aria-label={labels.nav}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            tab.key === active
              ? 'border-primary text-graphite'
              : 'border-transparent text-graphite-600 hover:text-graphite'
          )}
        >
          {labels[tab.key]}
        </Link>
      ))}
    </nav>
  )
}
