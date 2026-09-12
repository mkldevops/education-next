'use client'

import { useTranslations } from 'next-intl'
import { PlatformFlagToggle } from '../../../_components/platform-flag-toggle'
import { setSchoolSwitchEnabledAction } from '../../../_lib/platform-settings-actions'

type Props = {
  enabled: boolean
}

export function SchoolSwitchToggle({ enabled }: Props) {
  const t = useTranslations('schools.admin.platformSwitch')

  return (
    <PlatformFlagToggle
      title={t('title')}
      description={t('description')}
      enabled={enabled}
      onSave={setSchoolSwitchEnabledAction}
    />
  )
}
