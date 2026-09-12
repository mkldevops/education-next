'use client'

import { useTranslations } from 'next-intl'
import { PlatformFlagToggle } from '../../../_components/platform-flag-toggle'
import { setMcpEnabledAction } from '../../../_lib/platform-settings-actions'

type Props = {
  mcpEnabled: boolean
}

export function IntegrationsForm({ mcpEnabled }: Props) {
  const t = useTranslations('dashboard.pages.integrations')

  return (
    <div className="space-y-6">
      <PlatformFlagToggle
        title={t('mcp.title')}
        description={t('mcp.description')}
        hint={t('mcp.hint')}
        enabled={mcpEnabled}
        onSave={setMcpEnabledAction}
      />
    </div>
  )
}
