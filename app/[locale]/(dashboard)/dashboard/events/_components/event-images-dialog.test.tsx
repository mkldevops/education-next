import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({
  uploadEventImageAction: vi.fn(),
  removeEventImageAction: vi.fn(),
  setEventCoverAction: vi.fn(),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }))
const toastActionError = vi.hoisted(() => vi.fn())

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // biome-ignore lint/performance/noImgElement: test double for next/image
    <img src={src} alt={alt} />
  ),
}))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/toast', () => ({ toast, toastActionError }))
vi.mock('../../../_lib/event-actions', () => actions)

import { MAX_EVENT_IMAGE_BYTES } from '@/domain/event'
import { EventImagesDialog } from './event-images-dialog'

const image = (id: string, position: number) => ({
  id,
  storageKey: `events/school/${id}.png`,
  alt: id,
  position,
})

function openDialog(images = [image('cover', 0), image('second', 1)]) {
  render(<EventImagesDialog eventId="event-1" eventTitle="Kermesse" images={images} />)
  fireEvent.click(screen.getByRole('button', { name: /trigger/ }))
}

describe('EventImagesDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('offers to promote only the images that are not already the cover', () => {
    openDialog()

    expect(screen.getAllByRole('button', { name: 'images.setCover' })).toHaveLength(1)
  })

  it('shows the new order returned after changing the cover', async () => {
    actions.setEventCoverAction.mockResolvedValue([image('second', 0), image('cover', 1)])
    openDialog()

    fireEvent.click(screen.getByRole('button', { name: 'images.setCover' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('success.coverChanged'))
    expect(actions.setEventCoverAction).toHaveBeenCalledWith('event-1', 'second')
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual([
      'second',
      'cover',
    ])
  })

  it('uploads every selected file one after the other, within the remaining slots', async () => {
    let uploaded = 0
    actions.uploadEventImageAction.mockImplementation(async () => image(`new-${uploaded++}`, 0))
    openDialog([0, 1, 2, 3].map((position) => image(`existing-${position}`, position)))

    const files = ['a', 'b', 'c'].map(
      (name) => new File(['x'], `${name}.png`, { type: 'image/png' })
    )
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files } })

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('success.imageAdded'))
    expect(toast.warning).toHaveBeenCalledWith('images.tooManySelected')
    expect(actions.uploadEventImageAction).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: 'images.add' })).not.toBeInTheDocument()
  })

  it('stops uploading after the first failure', async () => {
    actions.uploadEventImageAction.mockResolvedValue('fileTooLarge')
    openDialog([])

    const files = ['a', 'b'].map((name) => new File(['x'], `${name}.png`, { type: 'image/png' }))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files } })

    await waitFor(() => expect(actions.uploadEventImageAction).toHaveBeenCalledTimes(1))
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('never sends a file over the size limit, which Next.js would cut before the action', async () => {
    actions.uploadEventImageAction.mockImplementation(async () => image('small', 0))
    openDialog([])

    const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: MAX_EVENT_IMAGE_BYTES + 1 })
    const small = new File(['x'], 'small.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [big, small] } })

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('success.imageAdded'))
    expect(toast.error).toHaveBeenCalledWith('images.tooLarge')
    expect(actions.uploadEventImageAction).toHaveBeenCalledTimes(1)
    const [sent] = actions.uploadEventImageAction.mock.calls[0] as [FormData]
    expect(sent.get('file')).toBe(small)
  })

  it('reports an upload the server rejects outright instead of failing silently', async () => {
    actions.uploadEventImageAction.mockRejectedValue(new Error('Body exceeded limit'))
    openDialog([])

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    })

    await waitFor(() =>
      expect(toastActionError).toHaveBeenCalledWith(expect.anything(), 'unexpected')
    )
    expect(toast.success).not.toHaveBeenCalled()
  })
})
