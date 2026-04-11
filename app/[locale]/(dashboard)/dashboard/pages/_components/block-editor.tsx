'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { Block, BlockType } from '@/use-cases/pages/schemas'

const BLOCK_TYPES: { type: BlockType; labelKey: string }[] = [
  { type: 'hero', labelKey: 'hero' },
  { type: 'text', labelKey: 'text' },
  { type: 'features', labelKey: 'features' },
  { type: 'cta', labelKey: 'cta' },
  { type: 'stats', labelKey: 'stats' },
  { type: 'contact', labelKey: 'contact' },
]

function defaultBlock(type: BlockType): Block {
  switch (type) {
    case 'hero':
      return { type: 'hero', title: '', subtitle: '', ctaLabel: '', ctaHref: '' }
    case 'text':
      return { type: 'text', title: '', content: '' }
    case 'features':
      return { type: 'features', title: '', items: [{ title: '', description: '' }] }
    case 'cta':
      return { type: 'cta', title: '', subtitle: '', ctaLabel: '', ctaHref: '' }
    case 'stats':
      return { type: 'stats', title: '', items: [{ label: '', value: '' }] }
    case 'contact':
      return { type: 'contact', title: '', showEmail: true, showPhone: true, showAddress: true }
  }
}

type BlockEditorProps = {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
}

export function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const t = useTranslations('dashboard.pages.pages.blockEditor')
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const addBlock = (type: BlockType) => {
    const next = [...blocks, defaultBlock(type)]
    onChange(next)
    setExpandedIndex(next.length - 1)
  }

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index))
    if (expandedIndex === index) setExpandedIndex(null)
  }

  const updateBlock = (index: number, block: Block) => {
    const next = [...blocks]
    next[index] = block
    onChange(next)
  }

  const moveBlock = (index: number, direction: -1 | 1) => {
    const next = [...blocks]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
    setExpandedIndex(target)
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocks have no stable id
        <div key={`${block.type}-${i}`} className="rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-gray-900"
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            >
              {t(block.type)}
              {expandedIndex === i ? (
                <ChevronUp size={14} className="text-gray-400" />
              ) : (
                <ChevronDown size={14} className="text-gray-400" />
              )}
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveBlock(i, -1)}
                disabled={i === 0}
                className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label="Move up"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => moveBlock(i, 1)}
                disabled={i === blocks.length - 1}
                className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label="Move down"
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => removeBlock(i)}
                className="rounded p-1 text-red-400 hover:text-red-600"
                aria-label="Remove block"
              >
                ✕
              </button>
            </div>
          </div>

          {expandedIndex === i && (
            <div className="border-t border-gray-100 px-4 py-4">
              <BlockForm block={block} onChange={(b) => updateBlock(i, b)} />
            </div>
          )}
        </div>
      ))}

      <div className="rounded-xl border border-dashed border-gray-300 p-4">
        <p className="mb-3 text-xs font-medium uppercase text-gray-500">{t('addBlock')}</p>
        <div className="flex flex-wrap gap-2">
          {BLOCK_TYPES.map(({ type }) => (
            <button
              key={type}
              type="button"
              onClick={() => addBlock(type)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              + {t(type)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-600">{label}</p>
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  required,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
    />
  )
}

function Textarea({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
    />
  )
}

function HeroForm({
  block,
  onChange,
}: {
  block: Extract<Block, { type: 'hero' }>
  onChange: (b: Block) => void
}) {
  const t = useTranslations('dashboard.pages.pages.blockEditor.fields')
  return (
    <div className="space-y-3">
      <Field label={`${t('title')} *`}>
        <TextInput
          value={block.title}
          onChange={(v) => onChange({ ...block, title: v })}
          required
        />
      </Field>
      <Field label={t('subtitle')}>
        <TextInput
          value={block.subtitle ?? ''}
          onChange={(v) => onChange({ ...block, subtitle: v })}
        />
      </Field>
      <Field label={t('ctaLabel')}>
        <TextInput
          value={block.ctaLabel ?? ''}
          onChange={(v) => onChange({ ...block, ctaLabel: v })}
        />
      </Field>
      <Field label={t('ctaHref')}>
        <TextInput
          value={block.ctaHref ?? ''}
          onChange={(v) => onChange({ ...block, ctaHref: v })}
          placeholder="/auth/login"
        />
      </Field>
      <Field label={t('backgroundImage')}>
        <TextInput
          value={block.backgroundImage ?? ''}
          onChange={(v) => onChange({ ...block, backgroundImage: v || undefined })}
          placeholder="https://..."
        />
      </Field>
    </div>
  )
}

function TextForm({
  block,
  onChange,
}: {
  block: Extract<Block, { type: 'text' }>
  onChange: (b: Block) => void
}) {
  const t = useTranslations('dashboard.pages.pages.blockEditor.fields')
  return (
    <div className="space-y-3">
      <Field label={t('title')}>
        <TextInput value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v })} />
      </Field>
      <Field label={`${t('content')} *`}>
        <Textarea value={block.content} onChange={(v) => onChange({ ...block, content: v })} />
      </Field>
    </div>
  )
}

function FeaturesForm({
  block,
  onChange,
}: {
  block: Extract<Block, { type: 'features' }>
  onChange: (b: Block) => void
}) {
  const t = useTranslations('dashboard.pages.pages.blockEditor.fields')
  return (
    <div className="space-y-4">
      <Field label={t('title')}>
        <TextInput value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v })} />
      </Field>
      <div className="space-y-3">
        {block.items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: list index is position key
          <div key={i} className="space-y-2 rounded-lg border border-gray-100 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Item {i + 1}</span>
              {block.items.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...block, items: block.items.filter((_, j) => j !== i) })
                  }
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  {t('remove')}
                </button>
              )}
            </div>
            <Field label={`${t('itemTitle')} *`}>
              <TextInput
                value={item.title}
                onChange={(v) => {
                  const items = [...block.items]
                  items[i] = { ...item, title: v }
                  onChange({ ...block, items })
                }}
                required
              />
            </Field>
            <Field label={t('itemDescription')}>
              <TextInput
                value={item.description}
                onChange={(v) => {
                  const items = [...block.items]
                  items[i] = { ...item, description: v }
                  onChange({ ...block, items })
                }}
              />
            </Field>
            <Field label={t('icon')}>
              <TextInput
                value={item.icon ?? ''}
                onChange={(v) => {
                  const items = [...block.items]
                  items[i] = { ...item, icon: v || undefined }
                  onChange({ ...block, items })
                }}
                placeholder="🎓"
              />
            </Field>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({ ...block, items: [...block.items, { title: '', description: '' }] })
          }
          className="text-xs font-medium text-primary hover:underline"
        >
          + {t('addItem')}
        </button>
      </div>
    </div>
  )
}

function CtaForm({
  block,
  onChange,
}: {
  block: Extract<Block, { type: 'cta' }>
  onChange: (b: Block) => void
}) {
  const t = useTranslations('dashboard.pages.pages.blockEditor.fields')
  return (
    <div className="space-y-3">
      <Field label={`${t('title')} *`}>
        <TextInput
          value={block.title}
          onChange={(v) => onChange({ ...block, title: v })}
          required
        />
      </Field>
      <Field label={t('subtitle')}>
        <TextInput
          value={block.subtitle ?? ''}
          onChange={(v) => onChange({ ...block, subtitle: v })}
        />
      </Field>
      <Field label={`${t('ctaLabel')} *`}>
        <TextInput
          value={block.ctaLabel}
          onChange={(v) => onChange({ ...block, ctaLabel: v })}
          required
        />
      </Field>
      <Field label={`${t('ctaHref')} *`}>
        <TextInput
          value={block.ctaHref}
          onChange={(v) => onChange({ ...block, ctaHref: v })}
          placeholder="/auth/login"
          required
        />
      </Field>
    </div>
  )
}

function StatsForm({
  block,
  onChange,
}: {
  block: Extract<Block, { type: 'stats' }>
  onChange: (b: Block) => void
}) {
  const t = useTranslations('dashboard.pages.pages.blockEditor.fields')
  return (
    <div className="space-y-4">
      <Field label={t('title')}>
        <TextInput value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v })} />
      </Field>
      <div className="space-y-2">
        {block.items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: list index is position key
          <div key={i} className="flex items-center gap-3">
            <TextInput
              value={item.value}
              onChange={(v) => {
                const items = [...block.items]
                items[i] = { ...item, value: v }
                onChange({ ...block, items })
              }}
              placeholder={t('statValue')}
            />
            <TextInput
              value={item.label}
              onChange={(v) => {
                const items = [...block.items]
                items[i] = { ...item, label: v }
                onChange({ ...block, items })
              }}
              placeholder={t('statLabel')}
            />
            {block.items.length > 1 && (
              <button
                type="button"
                onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
                className="text-red-400 hover:text-red-600"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...block, items: [...block.items, { label: '', value: '' }] })}
          className="text-xs font-medium text-primary hover:underline"
        >
          + {t('addItem')}
        </button>
      </div>
    </div>
  )
}

function ContactForm({
  block,
  onChange,
}: {
  block: Extract<Block, { type: 'contact' }>
  onChange: (b: Block) => void
}) {
  const t = useTranslations('dashboard.pages.pages.blockEditor.fields')
  const checkboxFields = [
    { key: 'showEmail', label: t('showEmail') },
    { key: 'showPhone', label: t('showPhone') },
    { key: 'showAddress', label: t('showAddress') },
  ] as const

  return (
    <div className="space-y-3">
      <Field label={t('title')}>
        <TextInput value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v })} />
      </Field>
      <div className="space-y-2">
        {checkboxFields.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={block[key]}
              onChange={(e) => onChange({ ...block, [key]: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  )
}

function BlockForm({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  switch (block.type) {
    case 'hero':
      return <HeroForm block={block} onChange={onChange} />
    case 'text':
      return <TextForm block={block} onChange={onChange} />
    case 'features':
      return <FeaturesForm block={block} onChange={onChange} />
    case 'cta':
      return <CtaForm block={block} onChange={onChange} />
    case 'stats':
      return <StatsForm block={block} onChange={onChange} />
    case 'contact':
      return <ContactForm block={block} onChange={onChange} />
  }
}
