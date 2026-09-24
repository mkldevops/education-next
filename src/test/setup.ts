import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Les chargeurs `next/font` ne s'exécutent qu'une fois compilés par Next : hors build, ils ne sont
// pas des fonctions. Le stub rend la forme utilisée par les layouts (`variable`, `className`).
vi.mock('next/font/google', () => {
  const loader = (options?: { variable?: string }) => ({
    className: 'font-stub',
    variable: options?.variable?.replace(/^--/, 'font-var-') ?? '',
    style: { fontFamily: 'stub' },
  })
  return { Inter: loader, Geist_Mono: loader }
})

afterEach(() => {
  cleanup()
})
