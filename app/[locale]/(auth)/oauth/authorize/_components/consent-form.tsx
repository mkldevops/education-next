'use client'

import { Button, cn } from '@peaklab/ui'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { authButtonClass } from '@/features/auth/auth-styles'
import { FormAlert } from '@/features/auth/form-alert'
import { AUTHORIZE_PARAMS, type AuthorizeQuery } from '../_lib/authorize-query'
import { consentAction } from '../_lib/consent-action'

type Props = {
  query: AuthorizeQuery
  schools: { id: string; name: string }[]
  account: string
  clientName: string
  callbackHost: string
}

/**
 * Le choix de l'école est le cœur du consentement : une connexion n'en couvre qu'une, et
 * c'est la seule décision que ChatGPT ne peut pas prendre à la place de l'administrateur.
 * La requête d'autorisation voyage en champs cachés et est revalidée côté serveur.
 */
export function ConsentForm({ query, schools, account, clientName, callbackHost }: Props) {
  const t = useTranslations('auth.oauth')
  const [state, formAction, pending] = useActionState(consentAction, null)
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? '')

  const noSchool = schools.length === 0

  return (
    <form action={formAction} className="space-y-6">
      {AUTHORIZE_PARAMS.map((name) =>
        query[name] === undefined ? null : (
          <input key={name} type="hidden" name={name} value={query[name]} />
        )
      )}

      {state?.error && <FormAlert>{t(`errors.${state.error}`)}</FormAlert>}

      <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-6">
        <p className="text-muted-foreground">{t('account')}</p>
        <p className="font-medium text-foreground">{account}</p>
      </div>

      <fieldset className="space-y-3" disabled={pending}>
        <legend className="text-sm font-medium text-foreground">{t('schoolLabel')}</legend>
        {noSchool ? (
          <FormAlert>{t('errors.noSchool')}</FormAlert>
        ) : (
          <ul className="space-y-2">
            {schools.map((school) => (
              <li key={school.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors',
                    schoolId === school.id
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-surface text-foreground hover:border-primary/50'
                  )}
                >
                  <input
                    type="radio"
                    name="schoolId"
                    value={school.id}
                    checked={schoolId === school.id}
                    onChange={() => setSchoolId(school.id)}
                    className="size-4 accent-primary"
                  />
                  <span className="font-medium">{school.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <div className="space-y-2 text-sm leading-6 text-muted-foreground">
        <p className="font-medium text-foreground">{t('permissions.title', { clientName })}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('permissions.read')}</li>
          <li>{t('permissions.write')}</li>
          <li>{t('permissions.revoke')}</li>
        </ul>
        <p className="text-xs">{t('callback', { host: callbackHost })}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          name="decision"
          value="deny"
          variant="outline"
          className={authButtonClass}
          disabled={pending}
        >
          {t('deny')}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="allow"
          className={authButtonClass}
          disabled={pending || noSchool}
        >
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : t('allow')}
        </Button>
      </div>
    </form>
  )
}
