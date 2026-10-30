'use client'

import { Button, Card, Input, Label } from '@peaklab/ui'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { updateProfileAction } from '@/actions'
import type { Locale } from '@/i18n/routing'
import { useRouter as useI18nRouter, usePathname } from '@/i18n/routing'
import { cn } from '@/lib/utils'

type Props = {
  user: {
    name: string
    email: string
  }
}

const locales: { value: Locale; label: string; flag: string }[] = [
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
]

export function ProfileSection({ user }: Props) {
  const t = useTranslations('settings')
  const router = useRouter()
  const i18nRouter = useI18nRouter()
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLocaleChange = (newLocale: Locale) => {
    i18nRouter.replace(pathname, { locale: newLocale })
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string

    startTransition(async () => {
      const result = await updateProfileAction({ name })

      if (result.success) {
        setSuccess(true)
        router.refresh()
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-graphite">{t('profile.title')}</h2>
        <p className="mt-1 text-sm text-graphite-600">{t('profile.description')}</p>

        <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4">
          {success && (
            <div className="rounded bg-green-50 p-3 text-sm text-green-600">
              {t('profile.success')}
            </div>
          )}

          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-600">{t(`errors.${error}`)}</div>
          )}

          <div>
            <Label htmlFor="name">{t('profile.name')}</Label>
            <Input id="name" name="name" defaultValue={user.name} className="mt-1" required />
          </div>

          <div>
            <Label htmlFor="email">{t('profile.email')}</Label>
            <Input id="email" type="email" defaultValue={user.email} disabled className="mt-1" />
            <p className="mt-1 text-xs text-graphite-600">{t('profile.emailHint')}</p>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? '...' : t('profile.save')}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-graphite">{t('language.title')}</h2>
        <p className="mt-1 text-sm text-graphite-600">{t('language.description')}</p>

        <div className="mt-4 flex gap-3">
          {locales.map((loc) => (
            <Button
              key={loc.value}
              type="button"
              variant="outline"
              onClick={() => handleLocaleChange(loc.value)}
              className={cn(
                'h-auto px-4 py-3',
                locale === loc.value
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'text-graphite-600 hover:border-alabaster'
              )}
            >
              <span className="text-lg">{loc.flag}</span>
              {loc.label}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  )
}
