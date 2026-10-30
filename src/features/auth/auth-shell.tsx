import { cn } from '@peaklab/ui'
import { CalendarDays, CircleCheckBig, GraduationCap, WalletCards } from 'lucide-react'
import { Fraunces } from 'next/font/google'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

/**
 * Fraunces n'est chargée que sous ce shell (surfaces publiques et auth, arbitrage de
 * `docs/design/README.md`) : le dashboard ne paie pas son poids.
 */
const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['opsz'],
})

type Branding = {
  schoolName?: string
  logoUrl?: string
}

type Props = Branding & {
  children: ReactNode
}

function BrandMark({ schoolName, logoUrl, fallbackName }: Branding & { fallbackName: string }) {
  const name = schoolName ?? fallbackName

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
        {logoUrl ? (
          // biome-ignore lint/performance/noImgElement: school logos are arbitrary remote URLs
          <img src={logoUrl} alt="" className="size-full object-contain p-1" />
        ) : (
          <GraduationCap aria-hidden className="size-5 text-foreground" />
        )}
      </span>
      <span className="truncate text-[0.9375rem] font-semibold tracking-tight">{name}</span>
    </div>
  )
}

/**
 * Shell des écrans d'authentification et d'invitation : l'école à gauche (logo, nom, accroche,
 * sur un aplat plein de sa couleur), le formulaire à droite sur fond neutre. Sous `lg`, une seule
 * colonne avec la marque en tête. Le texte du panneau prend `primary-foreground`, noir ou blanc
 * selon la luminance de la couleur d'école, pour rester lisible sur n'importe quel nuancier.
 */
export async function AuthShell({ schoolName, logoUrl, children }: Props) {
  const [t, tMeta] = await Promise.all([getTranslations('auth.shell'), getTranslations('metadata')])
  const fallbackName = tMeta('platformTitle')
  const features = [
    { icon: CalendarDays, label: t('features.schedule') },
    { icon: CircleCheckBig, label: t('features.attendance') },
    { icon: WalletCards, label: t('features.payments') },
  ]

  return (
    <div className={cn(fraunces.variable, 'flex flex-1 bg-surface')}>
      <aside className="relative hidden w-[44%] max-w-2xl shrink-0 flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex xl:p-14">
        {/* Motif discret : anneaux concentriques ton sur ton, sans aplat derrière le texte */}
        <div aria-hidden className="pointer-events-none absolute -right-40 -bottom-40 size-136">
          <div className="absolute inset-0 rounded-full border border-primary-foreground/15" />
          <div className="absolute inset-16 rounded-full border border-primary-foreground/10" />
          <div className="absolute inset-32 rounded-full border border-primary-foreground/10" />
        </div>

        <BrandMark schoolName={schoolName} logoUrl={logoUrl} fallbackName={fallbackName} />

        <div className="relative max-w-md space-y-8">
          <p className="font-display text-[2.5rem] font-normal leading-[1.1] tracking-tight text-balance xl:text-5xl">
            {t('tagline')}
          </p>
          <ul className="space-y-3.5">
            {features.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 text-[0.9375rem] text-primary-foreground/85"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary-foreground/20 bg-primary-foreground/10">
                  <Icon aria-hidden className="size-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-primary-foreground/75">
          {schoolName ? t('hostedBy', { schoolName }) : t('platformNote')}
        </p>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="px-5 pt-6 text-foreground sm:px-8 lg:hidden">
          <BrandMark schoolName={schoolName} logoUrl={logoUrl} fallbackName={fallbackName} />
        </header>
        <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8 lg:py-16">
          <div className="w-full max-w-100">{children}</div>
        </div>
      </main>
    </div>
  )
}
