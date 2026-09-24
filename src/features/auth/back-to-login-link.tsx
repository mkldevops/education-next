import { ArrowLeft } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { authLinkClass } from './auth-styles'

export function BackToLoginLink({ label }: { label: string }) {
  return (
    <Link href="/login" className={`inline-flex items-center gap-1.5 text-sm ${authLinkClass}`}>
      <ArrowLeft aria-hidden className="size-4" />
      {label}
    </Link>
  )
}
