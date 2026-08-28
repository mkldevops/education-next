'use client'

import { Button, Card, Input, Label } from '@peaklab/ui'
import { startRegistration } from '@simplewebauthn/browser'
import { KeyRound, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState, useTransition } from 'react'
import {
  deletePasskey,
  getPasskeyRegistrationOptions,
  getUserPasskeys,
  verifyPasskeyRegistration,
} from '@/actions'
import { formatDate } from '@/lib/date'

type Passkey = {
  id: string
  name: string
  deviceType: string
  createdAt: Date
}

export function PasskeySection() {
  const t = useTranslations('settings.passkey')
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadPasskeys = useCallback(() => {
    startTransition(async () => {
      const data = await getUserPasskeys()
      setPasskeys(data)
    })
  }, [])

  useEffect(() => {
    loadPasskeys()
  }, [loadPasskeys])

  const handleRegister = () => {
    if (!newName.trim()) {
      setError(t('nameRequired'))
      return
    }

    setError(null)
    setSuccess(null)

    startTransition(async () => {
      const result = await getPasskeyRegistrationOptions(newName.trim())
      if ('error' in result) {
        setError(t('error'))
        return
      }

      let response: Awaited<ReturnType<typeof startRegistration>>
      try {
        response = await startRegistration({ optionsJSON: result.options })
      } catch {
        setError(t('cancelled'))
        return
      }

      const verifyResult = await verifyPasskeyRegistration(response, newName.trim())
      if (verifyResult !== 'OK') {
        setError(t('error'))
        return
      }

      setNewName('')
      setSuccess(t('registered'))
      loadPasskeys()
      router.refresh()
    })
  }

  const handleDelete = (passkeyId: string) => {
    setError(null)
    setSuccess(null)

    startTransition(async () => {
      const result = await deletePasskey(passkeyId)
      if (result !== 'OK') {
        setError(t('deleteError'))
        return
      }
      setSuccess(t('deleted'))
      loadPasskeys()
    })
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <KeyRound className="h-5 w-5 text-gray-600" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
          <p className="text-sm text-gray-500">{t('description')}</p>
        </div>
      </div>

      {error && <div className="mt-4 rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      {success && (
        <div className="mt-4 rounded bg-green-50 p-3 text-sm text-green-600">{success}</div>
      )}

      {passkeys.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-sm font-medium text-gray-700">{t('registeredPasskeys')}</p>
          {passkeys.map((pk) => (
            <div
              key={pk.id}
              className="flex items-center justify-between rounded border border-gray-200 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{pk.name}</p>
                <p className="text-xs text-gray-500">
                  {pk.deviceType} — {formatDate(pk.createdAt, locale)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(pk.id)}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <div className="flex-1">
          <Label htmlFor="passkey-name">{t('namePlaceholder')}</Label>
          <Input
            id="passkey-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('namePlaceholder')}
            className="mt-1"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={handleRegister} disabled={isPending || !newName.trim()}>
            {isPending ? '...' : t('register')}
          </Button>
        </div>
      </div>
    </Card>
  )
}
