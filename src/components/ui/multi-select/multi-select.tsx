'use client'

import { Check, ChevronDown, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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

interface ListPosition {
  top: number
  left: number
  width: number
  maxHeight: number
}

const LIST_MAX_HEIGHT = 224
const LIST_GAP = 4

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function computePosition(anchor: HTMLElement): ListPosition {
  const rect = anchor.getBoundingClientRect()
  const below = window.innerHeight - rect.bottom - LIST_GAP * 2
  const above = rect.top - LIST_GAP * 2
  const openAbove = below < Math.min(LIST_MAX_HEIGHT, above)
  const maxHeight = Math.min(LIST_MAX_HEIGHT, Math.max(openAbove ? above : below, 96))

  return {
    top: openAbove ? rect.top - LIST_GAP - maxHeight : rect.bottom + LIST_GAP,
    left: rect.left,
    width: rect.width,
    maxHeight,
  }
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
  const optionId = (optionValue: string) => `${listboxId}-${optionValue}`

  const [selectedIds, setSelectedIds] = useState<string[]>(defaultValue)
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState<ListPosition | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isDisabled = disabled || options.length === 0
  const open = position !== null

  const selected = selectedIds
    .map((selectedId) => options.find((option) => option.id === selectedId))
    .filter((option): option is MultiSelectOption => option !== undefined)

  const search = normalize(query.trim())
  const results = search
    ? options.filter((option) => normalize(option.name).includes(search))
    : options
  const activeOption = activeIndex >= 0 ? results[activeIndex] : undefined

  const openList = () => {
    if (isDisabled || !containerRef.current) return
    setPosition(computePosition(containerRef.current))
  }

  const closeList = () => {
    setPosition(null)
    setActiveIndex(-1)
  }

  useEffect(() => {
    if (!open) return

    const reposition = () => {
      if (containerRef.current) setPosition(computePosition(containerRef.current))
    }
    const closeOnOutside = (event: MouseEvent | FocusEvent) => {
      const target = event.target as Node
      if (containerRef.current?.contains(target) || listRef.current?.contains(target)) return
      setPosition(null)
      setActiveIndex(-1)
    }

    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('focusin', closeOnOutside)

    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('focusin', closeOnOutside)
    }
  }, [open])

  const activeOptionId = activeOption ? optionId(activeOption.id) : undefined

  useEffect(() => {
    if (!activeOptionId) return
    document.getElementById(activeOptionId)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeOptionId])

  const toggle = (optionValue: string) => {
    setSelectedIds((current) =>
      current.includes(optionValue)
        ? current.filter((value) => value !== optionValue)
        : [...current, optionValue]
    )
    setQuery('')
    setActiveIndex(-1)
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      closeList()
      return
    }

    if (event.key === 'Backspace' && query === '' && selected.length > 0) {
      toggle(selected[selected.length - 1].id)
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openList()
        setActiveIndex(0)
        return
      }
      if (results.length === 0) return
      setActiveIndex((current) => {
        if (current < 0) return event.key === 'ArrowDown' ? 0 : results.length - 1
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1
        return (next + results.length) % results.length
      })
      return
    }

    if (event.key === 'Enter' && activeOption) {
      event.preventDefault()
      toggle(activeOption.id)
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {selected.map((option) => (
        <input key={option.id} type="hidden" name={name} value={option.id} />
      ))}

      <div
        className={cn(
          'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded border border-input bg-white px-2 py-1.5 text-sm',
          'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25',
          isDisabled && 'cursor-not-allowed bg-alabaster-900 opacity-60'
        )}
      >
        {selected.map((option) => (
          <span
            key={option.id}
            className="inline-flex items-center gap-1 rounded bg-alabaster-800 py-0.5 pl-2 pr-1 text-xs font-medium text-graphite"
          >
            {option.name}
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => toggle(option.id)}
              aria-label={removeLabel ? `${removeLabel} ${option.name}` : option.name}
              className="rounded p-0.5 text-graphite-600 hover:bg-alabaster-700 hover:text-graphite disabled:cursor-not-allowed"
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
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={activeOptionId}
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
            setActiveIndex(event.target.value ? 0 : -1)
            openList()
          }}
          onFocus={openList}
          onKeyDown={handleKeyDown}
          className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-placeholder disabled:cursor-not-allowed"
        />

        <ChevronDown className="h-4 w-4 shrink-0 text-graphite-700" aria-hidden="true" />
      </div>

      {position !== null &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={placeholder}
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            className="fixed z-[60] overflow-y-auto rounded border border-alabaster-700 bg-white py-1 shadow-lg"
          >
            {results.length === 0 && (
              <p className="px-3 py-2 text-sm text-graphite-600">{noResultsMessage}</p>
            )}
            {results.map((option, index) => {
              const isSelected = selectedIds.includes(option.id)
              return (
                <button
                  key={option.id}
                  id={optionId(option.id)}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => toggle(option.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                    index === activeIndex ? 'bg-alabaster-800' : 'bg-transparent',
                    isSelected ? 'font-medium text-graphite' : 'text-graphite'
                  )}
                >
                  {option.name}
                  {isSelected && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </div>
  )
}
