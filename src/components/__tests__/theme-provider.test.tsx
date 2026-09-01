import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from '../theme-provider'

describe('ThemeProvider', () => {
  it('emits the custom properties of a valid theme', () => {
    const { container } = render(
      <ThemeProvider configs={[{ name: 'theme_primary', value: '#3c6e71' }]} />
    )

    expect(container.querySelector('style')?.textContent).toBe(
      ':root { --theme-primary: #3c6e71; }'
    )
  })

  it('drops a value that would escape the style rule', () => {
    const { container } = render(
      <ThemeProvider
        configs={[
          { name: 'theme_primary', value: '#fff; } body { display: none } :root {' },
          { name: 'theme_background', value: '#ffffff' },
        ]}
      />
    )

    expect(container.querySelector('style')?.textContent).toBe(
      ':root { --theme-background: #ffffff; }'
    )
  })

  it('renders nothing when no value survives', () => {
    const { container } = render(<ThemeProvider configs={[{ name: 'theme_primary', value: '' }]} />)

    expect(container.querySelector('style')).toBeNull()
  })
})
