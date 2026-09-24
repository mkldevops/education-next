'use client'

import { cn, Input, type InputProps } from '@peaklab/ui'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

type Props = Omit<InputProps, 'type'> & { id: string }

/**
 * Champ mot de passe avec bascule afficher/masquer. Le libellé du bouton reste fixe et
 * `aria-pressed` porte l'état, comme le recommande le motif de bouton bascule.
 */
export function PasswordInput({ className, disabled, ...props }: Props) {
  const t = useTranslations('auth.password')
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        disabled={disabled}
        type={visible ? 'text' : 'password'}
        className={cn('pr-11', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={t('show')}
        aria-pressed={visible}
        aria-controls={props.id}
        disabled={disabled}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
      >
        {visible ? (
          <EyeOff aria-hidden className="size-4" />
        ) : (
          <Eye aria-hidden className="size-4" />
        )}
      </button>
    </div>
  )
}
