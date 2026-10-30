import manifest from '@/lib/manifest'

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(await manifest(), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie',
    },
  })
}
