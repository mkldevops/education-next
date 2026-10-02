import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/routing', () => ({ Link: 'a' }))

const { MessageText } = await import('./message-text')

describe('MessageText', () => {
  it('turns a dashboard link into a link', () => {
    render(<MessageText text="Voir [Anrafa MOUSTOIFA](/dashboard/teachers) ici" />)

    const link = screen.getByRole('link', { name: 'Anrafa MOUSTOIFA' })
    expect(link.getAttribute('href')).toBe('/dashboard/teachers')
  })

  it('keeps the id of a detail page', () => {
    const id = 'ce256c31-d192-4980-b520-c1902a5f43b9'
    render(<MessageText text={`[C2](/dashboard/classes/${id})`} />)

    expect(screen.getByRole('link', { name: 'C2' }).getAttribute('href')).toBe(
      `/dashboard/classes/${id}`
    )
  })

  it('leaves an external or protocol-relative link as plain text', () => {
    render(<MessageText text="[a](https://evil.test) [b](//evil.test) [c](javascript:alert(1))" />)

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText(/\[a\]\(https:\/\/evil\.test\)/)).toBeTruthy()
  })

  it('renders bold without the asterisks', () => {
    const { container } = render(<MessageText text="classe **C2 - 2026/2027** ok" />)

    expect(container.querySelector('strong')?.textContent).toBe('C2 - 2026/2027')
    expect(container.textContent).toBe('classe C2 - 2026/2027 ok')
  })
})
