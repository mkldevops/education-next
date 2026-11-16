import { Button } from '@peaklab/ui'
import { useTranslations } from 'next-intl'

export function RosterRefreshBar({
  className,
  disabled,
  notice,
  onRefresh,
}: {
  className: string
  disabled: boolean
  notice: string | null
  onRefresh: () => void
}) {
  const t = useTranslations('dashboard.pages.attendance')
  return (
    <div className={className}>
      <Button variant="outline" size="sm" disabled={disabled} onClick={onRefresh}>
        {t('refreshRoster')}
      </Button>
      {notice ? (
        <p role="status" className="text-sm text-graphite-600">
          {notice}
        </p>
      ) : null}
    </div>
  )
}
