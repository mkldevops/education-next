import { headers } from 'next/headers'
import QRCode from 'qrcode'

async function resolveOrigin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'localhost'
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http'
  return `${protocol}://${host}`
}

export async function buildScheduleQrCode(pathname: string) {
  const url = new URL(pathname, await resolveOrigin()).toString()
  const svg = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
  return { url, src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }
}
