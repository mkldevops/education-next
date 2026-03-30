import { PrismaClient } from '@prisma/client'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { sendEmail } from '@/lib/email'

const prisma = new PrismaClient()

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
    sendResetPassword: async (data) => {
      await sendEmail({
        to: data.user.email,
        subject: 'Réinitialisation de votre mot de passe',
        html: `<p>Cliquez <a href="${data.url}">ici</a> pour réinitialiser votre mot de passe.</p><p>Ce lien expire dans 1 heure.</p>`,
      })
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      allowDifferentEmails: true,
    },
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
