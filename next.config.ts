import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    // Le défaut de Next est 1 Mo pour le corps COMPLET d'une action serveur, pièce jointe
    // comprise. Sans ce relèvement, un envoi d'image dépassant ce plafond est coupé avant
    // que l'action soit invoquée : l'appelant reçoit un 500 opaque au lieu du refus typé
    // `fileTooLarge`, et la limite annoncée (10 Mo par image, avant conversion en WebP)
    // est inatteignable. La marge couvre l'enveloppe multipart.
    serverActions: { bodySizeLimit: '11mb' },
  },
  async redirects() {
    return [{ source: '/:locale/signin', destination: '/:locale/login', permanent: true }]
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default withNextIntl(nextConfig)
