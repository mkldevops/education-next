'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './voice-meter.module.css'

const BARS = 5
const BAND_WEIGHTS = [0.7, 1, 1.2, 1, 0.7]

export const voiceRingClass = styles.listening

/**
 * Onde de la dictée, pilotée par le volume réel du micro : le flux est analysé sur place
 * (Web Audio) et n'est ni enregistré ni envoyé. Sans accès au flux, l'onde reste animée
 * en boucle ; le mouvement réduit du système la fige.
 */
export function VoiceMeter() {
  const barsRef = useRef<Array<HTMLSpanElement | null>>([])
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') return

    let cancelled = false
    let frame = 0
    let stream: MediaStream | null = null
    let context: AudioContext | null = null

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((media) => {
        if (cancelled) {
          for (const track of media.getTracks()) track.stop()
          return
        }
        stream = media
        context = new AudioContext()
        const analyser = context.createAnalyser()
        analyser.fftSize = 64
        analyser.smoothingTimeConstant = 0.7
        context.createMediaStreamSource(media).connect(analyser)
        const bins = new Uint8Array(analyser.frequencyBinCount)
        const band = Math.floor(bins.length / (BARS + 1))
        setLive(true)

        const draw = () => {
          analyser.getByteFrequencyData(bins)
          for (let index = 0; index < BARS; index++) {
            let sum = 0
            for (let bin = index * band + 1; bin < (index + 1) * band + 1; bin++) sum += bins[bin]
            const level = Math.min(1, (sum / band / 255) * 1.8 * BAND_WEIGHTS[index])
            const bar = barsRef.current[index]
            if (bar) bar.style.transform = `scaleY(${0.2 + level * 0.8})`
          }
          frame = requestAnimationFrame(draw)
        }
        draw()
      })
      .catch(() => {})

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      for (const track of stream?.getTracks() ?? []) track.stop()
      void context?.close()
    }
  }, [])

  return (
    <span className={`${styles.meter} ${live ? '' : styles.idle}`} aria-hidden>
      {Array.from({ length: BARS }, (_, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: barres fixes, jamais réordonnées
          key={index}
          ref={(element) => {
            barsRef.current[index] = element
          }}
          className={styles.bar}
        />
      ))}
    </span>
  )
}
