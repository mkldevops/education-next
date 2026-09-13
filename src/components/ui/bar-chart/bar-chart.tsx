import { cn } from '../utils'

export interface BarChartPoint {
  /** Libellé sous la barre, déjà localisé par l'appelant. */
  label: string
  value: number
  /** Texte affiché au survol, en complément de la valeur. */
  caption?: string
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
    <div className={cn('flex items-end gap-2 overflow-x-auto', className)} style={{ height }}>
      {data.map((point) => {
        const ratio = max > 0 ? point.value / max : 0

        return (
          <div
            key={point.label}
            className="flex h-full min-w-10 flex-1 flex-col items-center justify-end gap-2"
            title={point.caption ? `${point.label} · ${point.caption}` : point.label}
          >
            <span
              className={cn(
                'text-xs font-medium tabular-nums',
                point.value > 0 ? 'text-graphite' : 'text-graphite-600'
              )}
            >
              {formatValue(point.value)}
            </span>
            <div
              className={cn(
                'w-full rounded-t transition-colors',
                point.value > 0 ? 'bg-primary hover:bg-primary-hover' : 'bg-alabaster-700'
              )}
              style={{ height: `${Math.max(ratio * 100, point.value > 0 ? 4 : 2)}%` }}
            />
            <span className="text-xs text-graphite-600">{point.label}</span>
          </div>
        )
      })}
    </div>
  )
}
