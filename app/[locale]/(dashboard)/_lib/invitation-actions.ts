'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'

const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(['ADMIN', 'PARENT']),
})

export async function inviteUserAction(input: { email: string; role: string }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return 'unauthorized'

  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return 'invalidInput'

  const { email, role } = parsed.data

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return 'emailAlreadyUsed'

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

  await db.invitation.create({
    data: {
      email,
      role,
      token,
      expiresAt,
      createdById: session.user.id,
    },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8550'
  const inviteUrl = `${appUrl}/fr/invite/${token}`

  const result = await sendEmail({
    to: email,
    subject: "Invitation à rejoindre l'école",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Vous avez été invité(e)</h2>
        <p>Vous avez été invité(e) à créer un compte sur la plateforme de l'école.</p>
        <p>
          <a href="${inviteUrl}" style="display: inline-block; background: #3c6e71; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
            Créer mon compte
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">Ce lien expire dans 48 heures.</p>
      </div>
    `,
    text: `Vous avez été invité(e). Créez votre compte ici: ${inviteUrl} (expire dans 48h)`,
  })

  if (result !== 'OK') return 'emailError'

  revalidatePath('/dashboard/users')
  return 'OK'
}
