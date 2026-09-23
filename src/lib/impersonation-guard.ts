import { headers } from 'next/headers'
import { isImpersonating } from '@/domain/user'
import { auth } from '@/lib/auth'

/**
 * Relit la session de la requête et dit si elle est empruntée. Pour les actions dont la
 * garde d'accès (`requireSchoolAdmin()`…) ne remonte pas la session elle-même.
 */
export async function isImpersonatingRequest(): Promise<boolean> {
  const session = await auth.api.getSession({ headers: await headers() })
  return isImpersonating(session)
}
