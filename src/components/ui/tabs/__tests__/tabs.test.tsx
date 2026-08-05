import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tabs } from '../tabs'

const tabs = [
  { label: 'Overview', content: <div>Overview content</div> },
  { label: 'Children', content: <div>Children content</div> },
  { label: 'Payments', content: <div>Payments content</div> },
]

describe('Tabs', () => {
  it('renders tablist and tab roles for each tab', () => {
    render(<Tabs tabs={tabs} />)

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(tabs.length)
  })

  it('selects defaultIndex on initial render', () => {
    render(<Tabs tabs={tabs} defaultIndex={1} />)

    const tabButtons = screen.getAllByRole('tab')
    expect(tabButtons[1]).toHaveAttribute('aria-selected', 'true')
    expect(tabButtons[1]).toHaveAttribute('tabIndex', '0')
    expect(tabButtons[0]).toHaveAttribute('aria-selected', 'false')
    expect(tabButtons[0]).toHaveAttribute('tabIndex', '-1')
    expect(screen.getByText('Children content')).toBeInTheDocument()
  })

  it('activates a tab on click', () => {
    render(<Tabs tabs={tabs} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Payments' }))

    expect(screen.getByRole('tab', { name: 'Payments' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Payments content')).toBeInTheDocument()
  })

  it('moves selection with ArrowRight and wraps to the first tab', () => {
    render(<Tabs tabs={tabs} defaultIndex={2} />)

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Payments' }), { key: 'ArrowRight' })

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
  })

  it('moves selection with ArrowLeft and wraps to the last tab', () => {
    render(<Tabs tabs={tabs} />)

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Overview' }), { key: 'ArrowLeft' })

    expect(screen.getByRole('tab', { name: 'Payments' })).toHaveAttribute('aria-selected', 'true')
  })

  it('jumps to the first and last tab with Home and End', () => {
    render(<Tabs tabs={tabs} defaultIndex={1} />)

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Children' }), { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Payments' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Payments' }), { key: 'Home' })
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
  })

  it('pairs the active tab and panel via aria-controls/id and aria-labelledby/id', () => {
    render(<Tabs tabs={tabs} />)

    const activeTab = screen.getByRole('tab', { name: 'Overview' })
    const panel = screen.getByRole('tabpanel')

    expect(activeTab).toHaveAttribute('aria-controls', panel.id)
    expect(panel).toHaveAttribute('aria-labelledby', activeTab.id)
  })
})
