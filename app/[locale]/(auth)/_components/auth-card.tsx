import type { ReactNode } from 'react'

export function AuthCard({
  title,
  subtitle,
  logo,
  children,
  footer,
}: {
  title: string
  subtitle: string
  logo?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded bg-white shadow-lg">
          <div className="bg-[var(--color-primary)] px-8 py-6 text-center">
            {logo}
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="mt-1 text-sm text-white/80">{subtitle}</p>
          </div>
          <div className="px-8 py-8">{children}</div>
        </div>
        {footer}
      </div>
    </div>
  )
}
