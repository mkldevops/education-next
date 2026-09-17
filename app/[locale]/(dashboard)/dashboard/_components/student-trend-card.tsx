import { Card } from '@peaklab/ui'

type Point = { label: string; value: number }

export function StudentTrendCard({
  title,
  subtitle,
  total,
  points,
}: {
  title: string
  subtitle: string
  total: number
  points: Point[]
}) {
  const width = 260
  const height = 72
  const max = Math.max(...points.map((point) => point.value), 1)
  const min = Math.min(...points.map((point) => point.value), 0)
  const range = Math.max(max - min, 1)
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? width : (index / (points.length - 1)) * width,
    y: height - ((point.value - min) / range) * (height - 12) - 6,
  }))
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `0,${height} ${line} ${width},${height}`

  return (
    <Card className="rounded border border-alabaster-700 bg-white p-5">
      <div className="flex items-end justify-between gap-5">
        <div className="shrink-0">
          <p className="text-sm font-medium text-graphite-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-graphite">{total}</p>
          <p className="mt-1 text-xs text-graphite-600">{subtitle}</p>
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-20 min-w-0 flex-1"
          role="img"
          aria-label={title}
        >
          <defs>
            <linearGradient id="student-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#student-trend-fill)" />
          <polyline
            points={line}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-graphite-600">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </Card>
  )
}
