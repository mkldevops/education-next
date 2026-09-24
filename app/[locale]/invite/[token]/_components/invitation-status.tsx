import { buttonVariants, cn } from '@peaklab/ui'
import { CircleCheck, Clock, Link2Off } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { AuthHeading } from '@/features/auth/auth-heading'
import { authButtonClass } from '@/features/auth/auth-styles'
import { Link } from '@/i18n/routing'

type Props = {
  status: 'used' | 'expired' | 'invalid'
  schoolName?: string
}

const ICONS = {
  used: { icon: CircleCheck, tone: 'success' },
  expired: { icon: Clock, tone: 'warning' },
  invalid: { icon: Link2Off, tone: 'warning' },
} as const

/**
 * Invitation inutilisable : ton calme, une explication, puis ce que la personne peut faire.
 * Aucune action ne dévoile quoi que ce soit au-delà de ce que le jeton désigne déjà.
 */
export async function InvitationStatus({ status, schoolName }: Props) {
  const t = await getTranslations('auth.invite')
  const { icon: Icon, tone } = ICONS[status]
  const school = schoolName ?? t('theSchool')

  return (
    <div className="space-y-8">
      <AuthHeading
        icon={<Icon />}
        tone={tone}
        title={t(`${status}.title`)}
        description={t(`${status}.description`, { schoolName: school })}
      />

      <div className="space-y-4">
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: status === 'used' ? 'default' : 'outline' }),
            authButtonClass,
            status !== 'used' && 'bg-surface',
            'shadow-xs'
          )}
        >
          {t(`${status}.action`)}
        </Link>
        <p className="text-sm leading-6 text-muted-foreground">
          {t('help', { schoolName: school })}
        </p>
      </div>
    </div>
  )
}
