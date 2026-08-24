import type { useTranslations } from 'next-intl'
import { toast } from 'sonner'

export { toast }

type Translator = ReturnType<typeof useTranslations>

export function toastActionError(t: Translator, code: string) {
  toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t('error'))
}
