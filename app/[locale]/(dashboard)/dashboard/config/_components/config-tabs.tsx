'use client'

import { type Tab, Tabs } from '@peaklab/ui'
import { CreditCard, LayoutGrid, School, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { INTEGRATIONS_ANCHOR } from './platform-anchors'

type Props = {
  identity: ReactNode
  modules: ReactNode
  payments: ReactNode
  /** Absent hors super-admin : l'onglet Plateforme n'existe alors pas. */
  platform?: ReactNode
}

/** Un onglet par domaine, ouvrable par ancre (`/dashboard/config#paiements`). */
export function ConfigTabs({ identity, modules, payments, platform }: Props) {
  const t = useTranslations('dashboard.pages.config.tabs')

  const tabs: Tab[] = [
    { id: 'identite', label: t('identity'), icon: School, content: identity },
    { id: 'modules', label: t('modules'), icon: LayoutGrid, content: modules },
    { id: 'paiements', label: t('payments'), icon: CreditCard, content: payments },
  ]
  if (platform) {
    tabs.push({
      id: 'plateforme',
      anchors: [INTEGRATIONS_ANCHOR],
      label: t('platform'),
      icon: ShieldCheck,
      content: platform,
    })
  }

  return <Tabs tabs={tabs} ariaLabel={t('label')} />
}
