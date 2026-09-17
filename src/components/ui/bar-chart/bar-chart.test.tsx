import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarChart } from './bar-chart'

describe('BarChart', () => {
  it('reserves the same two-line label height for every bar', () => {
    render(
      <BarChart
        data={[
          { label: 'Niveau 1', value: 0 },
          { label: 'Niveau Maternelle', value: 0 },
        ]}
        formatValue={String}
      />
    )

    for (const label of ['Niveau 1', 'Niveau Maternelle']) {
      expect(screen.getByText(label)).toHaveClass('h-8', 'line-clamp-2', 'text-center')
    }
  })
})
