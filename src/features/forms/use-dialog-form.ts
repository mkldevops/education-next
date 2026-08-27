'use client'

import { useDialog } from '@peaklab/ui'
import type { useTranslations } from 'next-intl'
import type { FormEvent } from 'react'
import { useTransition } from 'react'
import { toast, toastActionError } from '@/lib/toast'

type Translator = ReturnType<typeof useTranslations>

interface RunOptions<T> {
  successKey?: string
  onSuccess?: (result: Exclude<T, string>) => void
}

const isActionError = (result: unknown): result is string =>
  typeof result === 'string' && result !== 'OK'

export function useDialogForm(t: Translator) {
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const close = () => setOpen(false)

  const run = <T>(action: () => Promise<T>, options: RunOptions<T> = {}) => {
    startTransition(async () => {
      const result = await action()
      if (isActionError(result)) {
        toastActionError(t, result)
        return
      }
      toast.success(t(options.successKey ?? 'success'))
      close()
      options.onSuccess?.(result as Exclude<T, string>)
    })
  }

  const onSubmit =
    <T>(action: (formData: FormData) => Promise<T>, options: RunOptions<T> = {}) =>
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const formData = new FormData(e.currentTarget)
      run(() => action(formData), options)
    }

  return { isPending, close, run, onSubmit, startTransition }
}
