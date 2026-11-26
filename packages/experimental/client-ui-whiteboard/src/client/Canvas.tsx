/** Excalidraw surface for the one whiteboard scene. */

import { Component, type ReactNode } from 'react'
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { BinaryFiles } from '@excalidraw/excalidraw/types'
import type { WhiteboardScene, WhiteboardTheme } from './scene.ts'

/** PNG export of the current canvas. */
export interface CanvasExport {
  /** @returns a PNG of the current scene, including its background. */
  exportPng(): Promise<Blob>
}

/** Props for {@link WhiteboardCanvas}. */
export interface WhiteboardCanvasProps {
  /** Canvas theme. */
  readonly theme: WhiteboardTheme
  /** Scene read when this instance mounts. */
  readonly scene: WhiteboardScene
  /** Label shown when Excalidraw fails to render. */
  readonly failedLabel: string
  /**
   * @param scene - elements and files after a change. The board owns the theme.
   */
  readonly onScene: (scene: Pick<WhiteboardScene, 'elements' | 'files'>) => void
  /**
   * @param handle - export handle, replaced if Excalidraw publishes a new API.
   */
  readonly onReady: (handle: CanvasExport) => void
}

interface BoundaryProps {
  readonly failedLabel: string
  readonly children: ReactNode
}

interface BoundaryState {
  readonly failed: boolean
}

/** Shows `failedLabel` when the canvas throws, instead of breaking the sidebar. */
class CanvasBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  override componentDidCatch(error: Error): void {
    console.error('whiteboard: canvas failed', error.message)
  }

  override render(): ReactNode {
    if (this.state.failed) return <p role="alert">{this.props.failedLabel}</p>
    return this.props.children
  }
}

/**
 * Mount one Excalidraw canvas.
 * @param props - theme, the scene captured at mount, and change or export callbacks.
 * @returns the canvas, or a failure note when Excalidraw throws.
 */
export function WhiteboardCanvas(props: WhiteboardCanvasProps) {
  return (
    <CanvasBoundary failedLabel={props.failedLabel}>
      <Excalidraw
        theme={props.theme}
        autoFocus={false}
        UIOptions={{ canvasActions: { toggleTheme: false } }}
        initialData={{
          elements: props.scene.elements as readonly ExcalidrawElement[],
          files: props.scene.files as BinaryFiles,
          appState: { theme: props.theme },
        }}
        onChange={(elements, _appState, files) => {
          props.onScene({
            elements: elements.filter(element => element.isDeleted !== true),
            files: { ...files },
          })
        }}
        excalidrawAPI={(api) => {
          props.onReady({
            exportPng: () => exportToBlob({
              elements: api.getSceneElements(),
              appState: api.getAppState(),
              files: api.getFiles(),
              mimeType: 'image/png',
            }),
          })
        }}
      />
    </CanvasBoundary>
  )
}
