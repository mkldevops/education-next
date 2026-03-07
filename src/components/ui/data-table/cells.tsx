const dotColors: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  gray: 'bg-gray-500',
}

const textColors: Record<string, string> = {
  green: 'text-green-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
  blue: 'text-blue-700',
  gray: 'text-gray-700',
}

export function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${dotColors[color] ?? 'bg-gray-500'}`} />
      <span className={textColors[color] ?? 'text-gray-700'}>{label}</span>
    </div>
  )
}

export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.min(Math.max(value, 0), 100)

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <div className="h-2 rounded-full bg-gray-200">
          <div className="h-2 rounded-full bg-primary" style={{ width: `${clamped}%` }} />
        </div>
      </div>
      <span className="text-xs text-gray-600">{Math.round(clamped)}%</span>
    </div>
  )
}
