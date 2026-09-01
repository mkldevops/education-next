'use client'

import { Check, ChevronDown, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '../utils'

export interface MultiSelectOption {
  id: string
  name: string
}

export interface MultiSelectProps {
  id?: string
  name: string
  options: MultiSelectOption[]
  defaultValue?: string[]
  disabled?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  noResultsMessage?: string
  removeLabel?: string
  className?: string
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function MultiSelect({
  id,
  name,
  options,
  defaultValue = [],
  disabled = false,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  noResultsMessage,
  removeLabel,
  className,
}: MultiSelectProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listboxId = `${inputId}-listbox`

  const [selectedIds, setSelectedIds] = useState<string[]>(defaultValue)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isDisabled = disabled || options.length === 0

  const selected = useMemo(
    () =>
      selectedIds
        .map((selectedId) => options.find((option) => option.id === selectedId))
        .filter((option): option is MultiSelectOption => option !== undefined),
    [selectedIds, options]
  )

  const results = useMemo(() => {
    const search = normalize(query.trim())
    if (!search) return options
    return options.filter((option) => normalize(option.name).includes(search))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const toggle = (optionId: string) => {
    setSelectedIds((current) =>
      current.includes(optionId)
        ? current.filter((value) => value !== optionId)
        : [...current, optionId]
    )
    setQuery('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      setOpen(false)
      return
    }

    if (event.key === 'Backspace' && query === '' && selectedIds.length > 0) {
      setSelectedIds((current) => current.slice(0, -1))
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (results.length === 0) return
      setActiveIndex((current) => {
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1
        return (next + results.length) % results.length
      })
      return
    }

    if (event.key === 'Enter') {
      if (!open) return
      event.preventDefault()
      const option = results[activeIndex]
      if (option) toggle(option.id)
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {selectedIds.map((selectedId) => (
        <input key={selectedId} type="hidden" name={name} value={selectedId} />
      ))}

      <div
        className={cn(
          'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm',
          'focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-1',
          isDisabled && 'cursor-not-allowed bg-gray-50 opacity-60'
        )}
      >
        {selected.map((option) => (
          <span
            key={option.id}
            className="inline-flex items-center gap-1 rounded bg-gray-100 py-0.5 pl-2 pr-1 text-xs font-medium text-gray-800"
          >
            {option.name}
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => toggle(option.id)}
              aria-label={removeLabel ? `${removeLabel} ${option.name}` : option.name}
              className="rounded p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900 disabled:cursor-not-allowed"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          disabled={isDisabled}
          value={query}
          placeholder={
            options.length === 0
              ? emptyMessage
              : selected.length === 0
                ? placeholder
                : searchPlaceholder
          }
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
        />

        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      </div>

      {open && !isDisabled && (
        <div
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded border border-gray-200 bg-white py-1 shadow-lg"
        >
          {results.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">{noResultsMessage}</p>
          )}
          {results.map((option, index) => {
            const isSelected = selectedIds.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => toggle(option.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                  index === activeIndex ? 'bg-gray-100' : 'bg-transparent',
                  isSelected ? 'font-medium text-gray-900' : 'text-gray-700'
                )}
              >
                {option.name}
                {isSelected && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
