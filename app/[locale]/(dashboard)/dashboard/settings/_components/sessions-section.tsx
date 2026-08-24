'use client'

import { Button, Card } from '@peaklab/ui'
import { Monitor, Smartphone, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { revokeSessionAction } from '@/actions'

type SessionData = {
  id: string
  token: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: string
  expiresAt: string
  isCurrent: boolean
}

type Props = {
  sessions: SessionData[]
}

function parseUserAgent(ua: string | null): { device: string; browser: string } {
  if (!ua) return { device: 'Unknown', browser: 'Unknown' }

  const isMobile = /mobile|android|iphone|ipad/i.test(ua)
  const device = isMobile ? 'Mobile' : 'Desktop'

  let browser = 'Unknown'
  if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Edg')) browser = 'Edge'
  else if (ua.includes('Chrome')) browser = 'Chrome'
  else if (ua.includes('Safari')) browser = 'Safari'

  return { device, browser }
}

export function SessionsSection({ sessions }: Props) {
  const t = useTranslations('settings')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [revokingToken, setRevokingToken] = useState<string | null>(null)

  const handleRevoke = (token: string) => {
    setError(null)
    setRevokingToken(token)

    startTransition(async () => {
      const result = await revokeSessionAction(token)

      if (result.success) {
        router.refresh()
      } else {
        setError(result.error)
      }
      setRevokingToken(null)
    })
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-gray-900">{t('sessions.title')}</h2>
      <p className="mt-1 text-sm text-gray-500">{t('sessions.description')}</p>

      {error && (
        <div className="mt-4 rounded bg-red-50 p-3 text-sm text-red-600">
          {t(`errors.${error}`)}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {sessions.map((session) => {
          const { device, browser } = parseUserAgent(session.userAgent)
          const isMobile = device === 'Mobile'

          return (
            <div
              key={session.id}
              className="flex items-center justify-between rounded border border-gray-200 p-4"
            >
              <div className="flex items-center gap-3">
                {isMobile ? (
                  <Smartphone size={20} className="text-gray-400" />
                ) : (
                  <Monitor size={20} className="text-gray-400" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {browser} — {device}
                    </span>
                    {session.isCurrent && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        {t('sessions.current')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {session.ipAddress || t('sessions.unknownIp')} —{' '}
                    {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {!session.isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(session.token)}
                  disabled={isPending && revokingToken === session.token}
                >
                  <X size={16} />
                  <span className="ml-1">{t('sessions.revoke')}</span>
                </Button>
              )}
            </div>
          )
        })}

        {sessions.length === 0 && (
          <p className="text-sm text-gray-500">{t('sessions.noSessions')}</p>
        )}
      </div>
    </Card>
  )
}
