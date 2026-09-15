'use client'

import { Button, cn } from '@peaklab/ui'
import { Check, ChevronDown, Pipette } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import { useRouter } from '@/i18n/routing'
import {
  isHexColor,
  THEME_COLOR_KEYS,
  THEME_PALETTES,
  type ThemeColorKey,
  type ThemeColors,
} from '@/lib/theme-palettes'
import { toast, toastActionError } from '@/lib/toast'
import { setThemeColorsAction } from '../../../_lib/config-actions'

/** `null` : couleur jamais posée, que les jetons CSS dérivent encore de la principale. */
type Draft = Record<ThemeColorKey, string | null>

type Props = {
  colors: Partial<ThemeColors>
}

const FALLBACK_PRIMARY = '#3c6e71'
const DEFAULT_BACKGROUND = '#f7f7f7'

type EyeDropperWindow = Window & {
  EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> }
}

function toDraft(colors: Partial<ThemeColors>): Draft {
  return Object.fromEntries(
    THEME_COLOR_KEYS.map((key) => {
      const value = colors[key]?.toLowerCase()
      if (!value || !isHexColor(value)) return [key, null]
      return [key, value.length === 4 ? value.replace(/[0-9a-f]/g, '$&$&') : value]
    })
  ) as Draft
}

/** Reprend les mélanges de `globals.css` pour montrer ce qu'un jeton non posé affiche. */
function derivedCss(key: ThemeColorKey, primary: string) {
  if (key === 'theme_primary_hover') return `color-mix(in oklab, ${primary} 82%, black)`
  if (key === 'theme_primary_light') return `color-mix(in oklab, ${primary} 16%, white)`
  return DEFAULT_BACKGROUND
}

function mix(hex: string, target: number, weight: number) {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
  return `#${channels
    .map((c) => Math.round(c * weight + target * (1 - weight)))
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`
}

/** Point de départ du sélecteur sur un jeton non posé : une approximation sRGB suffit. */
function derivedHex(key: ThemeColorKey, primary: string) {
  if (key === 'theme_primary_hover') return mix(primary, 0, 0.82)
  if (key === 'theme_primary_light') return mix(primary, 255, 0.16)
  return DEFAULT_BACKGROUND
}

function isDark(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4
}

/**
 * Les quatre couleurs d'école dans un seul nuancier, à la manière de coolors.co : chaque
 * bande ouvre un sélecteur, une palette prête remplit les quatre d'un clic, et rien ne part
 * au serveur avant l'enregistrement. Seules les couleurs changées sont écrites, pour qu'un
 * jeton jamais posé continue de suivre la couleur principale.
 */
export function ThemePaletteEditor({ colors }: Props) {
  const t = useTranslations('dashboard.pages.config.theme')
  const router = useRouter()
  const initial = toDraft(colors)
  const [draft, setDraft] = useState<Draft>(initial)
  const [openKey, setOpenKey] = useState<ThemeColorKey | null>(null)
  const [pending, startTransition] = useTransition()
  const [supportsEyeDropper, setSupportsEyeDropper] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const presetsId = useId()

  const primary = draft.theme_primary ?? FALLBACK_PRIMARY
  const changed = THEME_COLOR_KEYS.filter(
    (key) => draft[key] !== null && draft[key] !== initial[key]
  )
  const dirty = THEME_COLOR_KEYS.some((key) => draft[key] !== initial[key])
  const activePalette = THEME_PALETTES.find((palette) =>
    THEME_COLOR_KEYS.every((key) => draft[key] === palette.colors[key])
  )

  // Lu après l'hydratation : le serveur ne sait pas si le navigateur porte la pipette.
  useEffect(() => {
    setSupportsEyeDropper(Boolean((window as EyeDropperWindow).EyeDropper))
  }, [])

  useEffect(() => {
    if (!openKey) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenKey(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenKey(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openKey])

  const setColor = (key: ThemeColorKey, value: string) =>
    setDraft((current) => ({ ...current, [key]: value.toLowerCase() }))

  const pickFromScreen = async (key: ThemeColorKey) => {
    const EyeDropper = (window as EyeDropperWindow).EyeDropper
    if (!EyeDropper) return
    try {
      const { sRGBHex } = await new EyeDropper().open()
      setColor(key, sRGBHex)
    } catch {
      // Pipette refermée sans choix : rien à appliquer.
    }
  }

  const save = () => {
    startTransition(async () => {
      try {
        const result = await setThemeColorsAction({
          colors: Object.fromEntries(changed.map((key) => [key, draft[key]])),
        })
        if (result !== 'OK') {
          toastActionError(t, result)
          return
        }
        toast.success(t('success'))
        setOpenKey(null)
        router.refresh()
      } catch {
        toast.error(t('error'))
      }
    })
  }

  return (
    <div className="space-y-5 px-6 py-5">
      <div>
        <h3 className="text-sm font-semibold text-graphite">{t('title')}</h3>
        <p className="mt-1 text-sm text-graphite-600">{t('description')}</p>
      </div>

      <div ref={containerRef} className="relative">
        <div className="flex h-24 overflow-hidden rounded-lg border border-alabaster-700">
          {THEME_COLOR_KEYS.map((key) => {
            const value = draft[key]
            const shownHex = value ?? derivedHex(key, primary)
            const role = t(`roles.${key}.label`)
            return (
              <button
                key={key}
                type="button"
                aria-label={t('editRole', { role })}
                aria-expanded={openKey === key}
                onClick={() => setOpenKey((current) => (current === key ? null : key))}
                className={cn(
                  'group relative flex flex-1 flex-col items-center justify-end gap-0.5 pb-2 text-xs transition-[flex-grow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-graphite',
                  openKey === key && 'grow-[1.4]',
                  isDark(shownHex) ? 'text-white' : 'text-graphite'
                )}
                style={{ backgroundColor: value ?? derivedCss(key, primary) }}
              >
                {openKey === key && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-1/2 size-2 -translate-y-1/2 rounded-full',
                      isDark(shownHex) ? 'bg-white' : 'bg-graphite'
                    )}
                  />
                )}
                <span className="font-medium">{role}</span>
                <span className="font-mono uppercase opacity-80">{value ?? t('auto')}</span>
              </button>
            )
          })}
        </div>

        {openKey && (
          <div
            role="dialog"
            aria-label={t('editRole', { role: t(`roles.${openKey}.label`) })}
            className="absolute top-full z-20 mt-2 w-64 space-y-3 rounded-xl border border-alabaster-700 bg-white p-3 shadow-lg [&_.react-colorful]:w-full"
            style={{
              left: `clamp(0px, calc(${(THEME_COLOR_KEYS.indexOf(openKey) + 0.5) * 25}% - 8rem), calc(100% - 16rem))`,
            }}
          >
            <p className="text-xs text-graphite-600">{t(`roles.${openKey}.description`)}</p>
            <HexColorPicker
              color={draft[openKey] ?? derivedHex(openKey, primary)}
              onChange={(value) => setColor(openKey, value)}
            />
            <div className="flex items-center gap-2">
              <HexColorInput
                aria-label={t('hex')}
                prefixed
                color={draft[openKey] ?? derivedHex(openKey, primary)}
                onChange={(value) => isHexColor(value) && setColor(openKey, value)}
                className="h-9 min-w-0 flex-1 rounded border border-alabaster-500 px-2 font-mono text-sm uppercase text-graphite focus:border-primary focus:outline-none"
              />
              {supportsEyeDropper && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  aria-label={t('eyedropper')}
                  onClick={() => pickFromScreen(openKey)}
                >
                  <Pipette className="size-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-alabaster-700">
        <button
          type="button"
          aria-expanded={presetsOpen}
          aria-controls={presetsId}
          onClick={() => setPresetsOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-graphite-600">
            {t('presets')}
          </span>
          <span className="flex items-center gap-2 text-xs text-graphite-600">
            {activePalette && (
              <>
                <span aria-hidden className="flex h-3 w-10 overflow-hidden rounded-sm">
                  {THEME_COLOR_KEYS.map((key) => (
                    <span
                      key={key}
                      className="flex-1"
                      style={{ backgroundColor: activePalette.colors[key] }}
                    />
                  ))}
                </span>
                {t(`palettes.${activePalette.id}`)}
              </>
            )}
            <ChevronDown
              aria-hidden
              className={cn('size-4 transition-transform', presetsOpen && 'rotate-180')}
            />
          </span>
        </button>
        {presetsOpen && (
          <div
            id={presetsId}
            className="grid grid-cols-2 gap-3 border-t border-alabaster-700 p-3 sm:grid-cols-3 lg:grid-cols-5"
          >
            {THEME_PALETTES.map((palette) => {
              const active = palette.id === activePalette?.id
              return (
                <button
                  key={palette.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setDraft({ ...palette.colors })
                    setOpenKey(null)
                  }}
                  className={cn(
                    'group rounded-lg border p-1.5 text-left transition-colors hover:border-graphite-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'border-graphite' : 'border-alabaster-700'
                  )}
                >
                  <span className="flex h-10 overflow-hidden rounded">
                    {THEME_COLOR_KEYS.map((key) => (
                      <span
                        key={key}
                        className="flex-1 transition-[flex-grow] group-hover:first:grow-[1.6]"
                        style={{ backgroundColor: palette.colors[key] }}
                      />
                    ))}
                  </span>
                  <span className="mt-1.5 flex items-center justify-between px-0.5 text-xs text-graphite">
                    {t(`palettes.${palette.id}`)}
                    {active && <Check aria-hidden className="size-3.5" />}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!dirty || pending}
          onClick={() => {
            setDraft(initial)
            setOpenKey(null)
          }}
        >
          {t('reset')}
        </Button>
        <Button type="button" size="sm" disabled={changed.length === 0 || pending} onClick={save}>
          {pending ? t('saving') : t('submit')}
        </Button>
      </div>
    </div>
  )
}
