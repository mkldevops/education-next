'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognitionConstructor = new () => Recognition

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

export type DictationError = 'notAllowed' | 'noSpeech' | 'failed'

function dictationError(code: SpeechRecognitionErrorCode): DictationError | null {
  if (code === 'aborted') return null
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'notAllowed'
  if (code === 'no-speech') return 'noSpeech'
  return 'failed'
}

/**
 * Dictée par la reconnaissance vocale du navigateur : le texte reconnu est remis à
 * `onText`, jamais envoyé seul ; `interim` montre la phrase encore en cours. Sans prise en charge (Firefox), `supported` reste faux.
 */
export function useDictation(lang: string, onText: (text: string) => void) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<DictationError | null>(null)
  const [interim, setInterim] = useState('')
  const recognitionRef = useRef<Recognition | null>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  useEffect(() => {
    setSupported(recognitionConstructor() !== null)
    return () => recognitionRef.current?.abort()
  }, [])

  const stop = useCallback(() => recognitionRef.current?.stop(), [])
  const cancel = useCallback(() => recognitionRef.current?.abort(), [])

  const start = useCallback(() => {
    const Constructor = recognitionConstructor()
    if (!Constructor || recognitionRef.current) return
    const recognition = new Constructor()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let pending = ''
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index]
        if (result.isFinal) onTextRef.current(result[0].transcript.trim())
        else pending += result[0].transcript
      }
      setInterim(pending.trim())
    }
    recognition.onerror = (event) => setError(dictationError(event.error))
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
      setInterim('')
    }
    recognitionRef.current = recognition
    setError(null)
    setListening(true)
    recognition.start()
  }, [lang])

  return { supported, listening, interim, error, start, stop, cancel }
}
