// @vitest-environment jsdom
/** The canvas drops deleted elements, exports a PNG, and contains a render failure. */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WhiteboardCanvas, type CanvasExport } from '../src/client/Canvas.tsx'
import { emptyScene } from '../src/client/scene.ts'

const control = vi.hoisted(() => ({
  crash: false,
  exportToBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}))

vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: (props: {
    theme: string
    onChange: (elements: readonly { id: string; isDeleted?: boolean }[], appState: object, files: object) => void
    excalidrawAPI: (api: {
      getSceneElements: () => readonly { id: string }[]
      getAppState: () => { theme: string }
      getFiles: () => Record<string, unknown>
    }) => void
  }) => {
    if (control.crash) throw new Error('boom')
    props.excalidrawAPI({
      getSceneElements: () => [{ id: 'live' }],
      getAppState: () => ({ theme: props.theme }),
      getFiles: () => ({ file: { id: 'file' } }),
    })
    return (
      <button type="button" onClick={() => {
        props.onChange([
          { id: 'live', isDeleted: false },
          { id: 'gone', isDeleted: true },
        ], {}, { file: { id: 'file' } })
      }}>draw</button>
    )
  },
  exportToBlob: control.exportToBlob,
}))

describe('WhiteboardCanvas', () => {
  it('keeps live elements and exports the current scene', async () => {
    control.crash = false
    const onScene = vi.fn()
    let handle: CanvasExport | undefined
    render(
      <WhiteboardCanvas
        theme="dark"
        scene={emptyScene('dark')}
        failedLabel="The canvas could not be loaded."
        onScene={onScene}
        onReady={(next) => { handle = next }}
      />,
    )
    screen.getByRole('button', { name: 'draw' }).click()
    expect(onScene).toHaveBeenCalledWith({ elements: [{ id: 'live', isDeleted: false }], files: { file: { id: 'file' } } })
    await handle?.exportPng()
    expect(control.exportToBlob).toHaveBeenCalledWith({
      elements: [{ id: 'live' }],
      appState: { theme: 'dark' },
      files: { file: { id: 'file' } },
      mimeType: 'image/png',
    })
  })

  it('shows the failure label when Excalidraw throws', () => {
    control.crash = true
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <WhiteboardCanvas
        theme="light"
        scene={emptyScene('light')}
        failedLabel="The canvas could not be loaded."
        onScene={vi.fn()}
        onReady={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert').textContent).toBe('The canvas could not be loaded.')
    expect(error).toHaveBeenCalledWith('whiteboard: canvas failed', 'boom')
  })
})
