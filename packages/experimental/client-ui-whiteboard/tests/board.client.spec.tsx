// @vitest-environment jsdom
/** The board saves, restores, switches theme, and sends a drawing to a session. */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WhiteboardView, type WhiteboardInjected } from '../src/client/Board.tsx'
import { en } from '../src/client/locales.ts'
import { SCENE_FILE, createWhiteboardStorage, type KeyValueStorage } from '../src/client/scene.ts'

const control = vi.hoisted(() => ({ ready: true, fail: false }))

vi.mock('../src/client/Canvas.tsx', () => ({
  WhiteboardCanvas: (props: {
    theme: string
    scene: { elements: readonly unknown[] }
    onScene: (scene: { elements: readonly unknown[]; files: Record<string, unknown> }) => void
    onReady: (handle: { exportPng: () => Promise<Blob> }) => void
  }) => {
    if (control.ready) {
      props.onReady({
        exportPng: async () => {
          if (control.fail) throw new Error('export')
          return new Blob(['png'], { type: 'image/png' })
        },
      })
    }
    return (
      <div data-testid="canvas" data-theme={props.theme} data-count={props.scene.elements.length}>
        <button type="button" onClick={() => { props.onScene({ elements: [{ id: 'stroke' }], files: {} }) }}>draw</button>
      </div>
    )
  },
}))

class Memory implements KeyValueStorage {
  readonly values = new Map<string, string>()
  writes = 0
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void {
    this.writes += 1
    this.values.set(key, value)
  }
}

const alpha = 'alpha' as SessionId
const missing = 'missing' as SessionId

function summary(id: SessionId, title: string): SessionSummary {
  return { id, displayTitle: title, running: false, blank: false, updatedAt: 1, retainedBy: {} }
}

function catalog(ids: SessionId[] = [alpha, missing]): SessionListState {
  return {
    ids,
    byId: { [alpha]: summary(alpha, 'Alpha') },
    phase: 'ready',
    projectionsBySession: {},
  }
}

function view(storage: Memory, queueDrawing: WhiteboardInjected['queueDrawing'], state = catalog(), sessionId = alpha) {
  const list = createSnapshotStore(state)
  return render(
    <WhiteboardView
      sessionId={sessionId}
      storage={createWhiteboardStorage(storage)}
      prefersDark={() => false}
      queueDrawing={queueDrawing}
      useCatalog={bindSnapshotSelector(list)}
      t={makeTranslate(en)}
    />,
  )
}

afterEach(() => {
  cleanup()
  control.ready = true
  control.fail = false
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function chooseFile(input: HTMLInputElement, file: File | undefined): void {
  const files = file === undefined ? [] : [file]
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  fireEvent.change(input)
}

function storedTheme(storage: Memory): string {
  const raw = [...storage.values.values()].at(-1)
  if (raw === undefined) throw new Error('nothing stored')
  const document = JSON.parse(raw) as { theme: string }
  return document.theme
}

describe('WhiteboardView', () => {
  it('downloads the scene and restores an opened file', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:board')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe(SCENE_FILE)
    })
    const storage = new Memory()
    const { container } = view(storage, vi.fn())
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('status').textContent).toBe(en['status.saved'])
    expect(click).toHaveBeenCalledOnce()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    chooseFile(input, undefined)
    expect(screen.getByRole('status').textContent).toBe(en['status.saved'])
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    chooseFile(input, new File(['{'], 'bad.excalidraw'))
    expect(await screen.findByText(en['status.openFailed'])).toBeTruthy()
    expect(error).toHaveBeenCalled()
    cleanup()
    const restored = view(new Memory(), vi.fn())
    const next = restored.container.querySelector('input[type="file"]') as HTMLInputElement
    chooseFile(next, new File([JSON.stringify({ type: 'library' })], 'lib.excalidraw'))
    expect(await screen.findByText(en['status.openFailed'])).toBeTruthy()
    chooseFile(next, new File([JSON.stringify({
      type: 'excalidraw', elements: [{ id: 'kept' }], appState: { theme: 'dark' },
    })], 'ok.excalidraw'))
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull()
      expect(screen.getByTestId('canvas').dataset).toMatchObject({ theme: 'dark', count: '1' })
    })
  })

  it('switches theme, flushes the last stroke, and skips a canvas that is not ready', async () => {
    vi.useFakeTimers()
    const storage = new Memory()
    const queue = vi.fn()
    const rendered = view(storage, queue)
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }))
    expect(screen.getByTestId('canvas').dataset.theme).toBe('light')
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(screen.getByTestId('canvas').dataset.theme).toBe('dark')
    expect(storedTheme(storage)).toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: 'draw' }))
    await act(async () => { vi.advanceTimersByTime(300) })
    expect(storage.writes).toBe(4)
    fireEvent.click(screen.getByRole('button', { name: 'draw' }))
    rendered.unmount()
    await act(async () => { vi.advanceTimersByTime(300) })
    expect(storage.writes).toBe(5)
    control.ready = false
    view(storage, queue)
    fireEvent.click(screen.getByRole('button', { name: 'Send to session' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'explain' } })
    fireEvent.click(screen.getByRole('button', { name: (name: string) => name === 'Send' }))
    expect(queue).not.toHaveBeenCalled()
  })

  it('queues the drawing for the chosen session and reports a refusal', async () => {
    const storage = new Memory()
    let finish: (result: { ok: true } | { ok: false }) => void = () => {}
    const queue = vi.fn(() => new Promise<{ ok: true } | { ok: false }>((resolve) => { finish = resolve }))
    view(storage, queue, catalog([alpha, missing]), missing)
    fireEvent.click(screen.getByRole('button', { name: 'Send to session' }))
    expect(screen.getByRole('button', { name: (name: string) => name === 'Send' })).toHaveProperty('disabled', true)
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Choose a session', 'Alpha'])
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: alpha } })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  explain  ' } })
    fireEvent.click(screen.getByRole('button', { name: (name: string) => name === 'Send' }))
    expect(await screen.findByRole('button', { name: 'Sending' })).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' }).find(button => !button.hasAttribute('disabled'))!)
    expect(screen.getByRole('dialog')).toBeTruthy()
    finish({ ok: true })
    expect(await screen.findByText(en['status.sent'])).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(queue).toHaveBeenCalledWith(alpha, 'explain', expect.any(Blob))
    fireEvent.click(screen.getByRole('button', { name: 'Send to session' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: alpha } })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'again' } })
    queue.mockImplementationOnce(async () => ({ ok: false }))
    fireEvent.click(screen.getByRole('button', { name: (name: string) => name === 'Send' }))
    expect(await screen.findByText(en['status.sendFailed'])).toBeTruthy()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    control.fail = true
    fireEvent.click(screen.getByRole('button', { name: (name: string) => name === 'Send' }))
    expect(await screen.findByText(en['status.sendFailed'])).toBeTruthy()
    expect(error).toHaveBeenCalled()
  })

  it('says when no session can receive the drawing', () => {
    const storage = new Memory()
    view(storage, vi.fn(), catalog([]))
    fireEvent.click(screen.getByRole('button', { name: 'Send to session' }))
    expect(screen.getByText(en['status.empty'])).toBeTruthy()
    const close = screen.getAllByRole('button', { name: 'Cancel' }).find(button => button.textContent !== 'Cancel')
    fireEvent.click(close!)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Send to session' }))
    const footerCancel = screen.getAllByRole('button', { name: 'Cancel' }).find(button => button.textContent === 'Cancel')
    fireEvent.click(footerCancel!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
