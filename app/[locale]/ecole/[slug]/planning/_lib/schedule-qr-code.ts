import { headers } from 'next/headers'
import QRCode from 'qrcode'

async function resolveOrigin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.NODE_ENV === 'production') return null
  const requestHeaders = await headers()
  return `http://${requestHeaders.get('host') ?? 'localhost'}`
}

export async function buildScheduleQrCode(pathname: string) {
  const origin = await resolveOrigin()
  if (!origin) return null
  const url = new URL(pathname, origin).toString()
  const svg = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
  return { url, src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }
}
