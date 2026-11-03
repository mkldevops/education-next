import { cn } from '../utils'

export interface BarChartPoint {
  /** Libellé sous la barre, déjà localisé par l'appelant. */
  label: string
  value: number
  /** Texte affiché au survol, en complément de la valeur. */
  caption?: string
  /** Infobulle complète, à la place de « libellé · caption ». */
  tooltip?: string
}

export interface BarChartProps {
  data: BarChartPoint[]
  /** L'appelant possède le format : montant, pourcentage ou compte. */
  formatValue: (value: number) => string
  emptyMessage?: string
  /** Hauteur de la zone traçable, en pixels. */
  height?: number
  className?: string
}

/**
 * Histogramme en CSS pur, rendu côté serveur.
 *
 * Les valeurs sont écrites au-dessus de chaque barre : le graphique reste lisible sans survol,
 * donc sans JavaScript et sans lecteur d'écran spécialisé.
 */
export function BarChart({
  data,
  formatValue,
  emptyMessage,
  height = 160,
  className,
}: BarChartProps) {
  if (data.length === 0 && emptyMessage) {
    return <div className="py-12 text-center text-graphite-600">{emptyMessage}</div>
  }

  const max = Math.max(...data.map((point) => point.value), 0)

  return (
    <div className={cn('flex gap-2 overflow-x-auto pt-5', className)} style={{ height }}>
      {data.map((point) => {
        const ratio = max > 0 ? point.value / max : 0

        const barHeight = Math.max(ratio * 100, point.value > 0 ? 4 : 2)

        return (
          <div
            key={point.label}
            className="flex h-full min-w-8 flex-1 flex-col items-center gap-2"
            title={
              point.tooltip ?? (point.caption ? `${point.label} · ${point.caption}` : point.label)
            }
          >
            <div className="relative min-h-0 w-full flex-1">
              <span
                className={cn(
                  'absolute inset-x-0 text-center text-xs font-medium tabular-nums',
                  point.value > 0 ? 'text-graphite' : 'text-graphite-600'
                )}
                style={{ bottom: `calc(${barHeight}% + 0.375rem)` }}
              >
                {formatValue(point.value)}
              </span>
              <div
                className={cn(
                  'absolute inset-x-0 bottom-0 rounded-t transition-colors',
                  point.value > 0 ? 'bg-primary hover:bg-primary-hover' : 'bg-alabaster-700'
                )}
                style={{ height: `${barHeight}%` }}
              />
            </div>
            <span className="line-clamp-2 h-8 shrink-0 text-center text-xs leading-4 text-graphite-600">
              {point.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
