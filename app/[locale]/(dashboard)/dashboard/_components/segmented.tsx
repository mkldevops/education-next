import { cn } from '@/lib/utils'

export function Segmented<T extends string>({
  label,
  options,
  value,
  format,
  onSelect,
}: {
  label: string
  options: readonly T[]
  value: T
  format: (option: T) => string
  onSelect: (option: T) => void
}) {
  return (
    <fieldset
      aria-label={label}
      className="m-0 flex min-w-0 rounded-lg border-0 bg-surface-2 p-0.5"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => option !== value && onSelect(option)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-(--duration-fast)',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            option === value
              ? 'bg-surface text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {format(option)}
        </button>
      ))}
    </fieldset>
  )
}
