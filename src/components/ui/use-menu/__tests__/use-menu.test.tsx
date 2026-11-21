import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useMenu } from '../use-menu'

function Menu({ withInput = false }: { withInput?: boolean }) {
  const { open, toggle, containerRef, triggerRef, menuRef } = useMenu()
  return (
    <>
      <div ref={containerRef}>
        <button ref={triggerRef} type="button" aria-expanded={open} onClick={toggle}>
          Actions
        </button>
        {open && (
          <div ref={menuRef} role="menu">
            <button type="button" role="menuitem">
              First
            </button>
            <button type="button" role="menuitem" disabled>
              Disabled
            </button>
            <button type="button" role="menuitem">
              Middle
            </button>
            <button type="button" role="menuitem">
              Last
            </button>
            {withInput && <input aria-label="Date" type="date" />}
          </div>
        )}
      </div>
      <button type="button">Outside</button>
    </>
  )
}

function openMenu(withInput = false) {
  render(<Menu withInput={withInput} />)
  fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
}

const item = (name: string) => screen.getByRole('menuitem', { name })

describe('useMenu', () => {
  it('focuses the first enabled item on open', () => {
    openMenu()

    expect(item('First')).toHaveFocus()
  })

  it('moves through enabled items with the arrow keys and wraps around', () => {
    openMenu()

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(item('Middle')).toHaveFocus()

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(item('First')).toHaveFocus()

    fireEvent.keyDown(document, { key: 'ArrowUp' })
    expect(item('Last')).toHaveFocus()
  })

  it('jumps to the first and last items with Home and End', () => {
    openMenu()

    fireEvent.keyDown(document, { key: 'End' })
    expect(item('Last')).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Home' })
    expect(item('First')).toHaveFocus()
  })

  it('closes on Escape and returns focus to the trigger', () => {
    openMenu()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus()
  })

  it('closes when focus leaves the menu, without pulling focus back', () => {
    openMenu()
    const outside = screen.getByRole('button', { name: 'Outside' })

    act(() => outside.focus())

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(outside).toHaveFocus()
  })

  it('leaves the keys of a field inside the menu to that field', () => {
    openMenu(true)
    const field = screen.getByLabelText('Date')
    field.focus()

    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      field.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    }
    expect(field).toHaveFocus()
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })
})
