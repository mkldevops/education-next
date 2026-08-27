import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../dialog'

function renderDialog() {
  return render(
    <Dialog>
      <DialogTrigger>
        <button type="button">Open</button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog title</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <input aria-label="First field" type="text" />
          <input aria-label="Second field" type="text" />
        </DialogBody>
        <DialogFooter>
          <button type="button">Cancel</button>
          <button type="button">Confirm</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function openDialog() {
  const trigger = screen.getByRole('button', { name: 'Open' })
  trigger.focus()
  fireEvent.click(trigger)
  return trigger
}

describe('DialogContent accessibility', () => {
  it('exposes role, aria-modal, and aria-labelledby pointing at the title when open', () => {
    renderDialog()
    openDialog()

    const panel = screen.getByRole('dialog')
    const title = screen.getByText('Dialog title')

    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(panel.getAttribute('aria-labelledby')).toBe(title.id)
  })

  it('moves focus to the first focusable element inside the panel on open', () => {
    renderDialog()
    openDialog()

    expect(document.activeElement).toBe(screen.getByLabelText('First field'))
  })

  it('traps Tab within the panel, wrapping last -> first and first -> last', () => {
    renderDialog()
    openDialog()

    const firstField = screen.getByLabelText('First field')
    const confirmButton = screen.getByRole('button', { name: 'Confirm' })

    confirmButton.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(firstField)

    firstField.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirmButton)
  })

  it('restores focus to the previously focused element after closing', () => {
    renderDialog()
    const trigger = openDialog()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})
