// @vitest-environment jsdom
/** Scene documents round-trip through a store and a download. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SAVE_DELAY_MS, SCENE_FILE, SCENE_KEY, createWhiteboardStorage, debounce, downloadBlob, emptyScene,
  parseScene, prefersDarkTheme, sceneDocument, type KeyValueStorage,
} from '../src/client/scene.ts'

class Memory implements KeyValueStorage {
  failOn: 'none' | 'read' | 'write' = 'none'
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    if (this.failOn === 'read') throw new Error('blocked')
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failOn === 'write') throw new Error('blocked')
    this.values.set(key, value)
  }
}

afterEach(() => { vi.restoreAllMocks() })

describe('whiteboard scene', () => {
  it('starts empty in the preferred theme and restores a saved document', () => {
    const store = new Memory()
    const storage = createWhiteboardStorage(store)
    expect(storage.read(true)).toEqual(emptyScene('dark'))
    const scene = { elements: [{ id: 'a' }], files: { a: { id: 'a' } }, theme: 'light' as const }
    expect(storage.write(scene)).toBe(true)
    expect(storage.read(true)).toEqual(scene)
    expect(store.values.get(SCENE_KEY)).toBe(sceneDocument(scene))
  })

  it('drops a deleted element and reads the theme from either place', () => {
    expect(parseScene({
      type: 'excalidraw',
      elements: [{ id: 'keep' }, { id: 'drop', isDeleted: true }, 'note'],
      appState: { theme: 'dark' },
    }, 'light')).toEqual({ elements: [{ id: 'keep' }, 'note'], files: {}, theme: 'dark' })
    expect(parseScene({ elements: [], theme: 'light' }, 'dark')?.theme).toBe('light')
    expect(parseScene(null, 'light')).toBeUndefined()
    expect(parseScene({ type: 'library', elements: [] }, 'light')).toBeUndefined()
    expect(parseScene({ type: 'excalidraw' }, 'light')).toBeUndefined()
    expect(parseScene({ type: 'excalidraw', elements: [], files: [] }, 'dark')?.files).toEqual({})
    expect(parseScene({ elements: [], theme: 'nope', appState: { theme: 'dark' } }, 'light')?.theme).toBe('dark')
    expect(parseScene({ elements: [], appState: null }, 'light')?.theme).toBe('light')
  })

  it('restores an empty scene when the store or the document fails', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = new Memory()
    const storage = createWhiteboardStorage(store, 'other')
    store.values.set('other', 'null')
    expect(storage.read(false)).toEqual(emptyScene('light'))
    store.values.set('other', '{')
    expect(storage.read(false)).toEqual(emptyScene('light'))
    store.failOn = 'read'
    expect(storage.read(true)).toEqual(emptyScene('dark'))
    store.failOn = 'write'
    expect(storage.write(emptyScene('light'))).toBe(false)
    expect(error).toHaveBeenCalled()
  })

  it('runs a debounced save once and can cancel it', () => {
    vi.useFakeTimers()
    const action = vi.fn()
    const scheduled = debounce(action, SAVE_DELAY_MS)
    scheduled.cancel()
    scheduled.call()
    scheduled.call()
    vi.advanceTimersByTime(SAVE_DELAY_MS - 1)
    expect(action).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(action).toHaveBeenCalledOnce()
    scheduled.call()
    scheduled.cancel()
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(action).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('downloads a named blob', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:board')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadBlob(SCENE_FILE, new Blob(['{}']))
    expect(click).toHaveBeenCalledOnce()
    expect(document.body.querySelector('a')).toBeNull()
  })

  it('reads the dark-scheme query', () => {
    expect(prefersDarkTheme(() => ({ matches: true }))).toBe(true)
    expect(prefersDarkTheme(() => ({ matches: false }))).toBe(false)
    expect(prefersDarkTheme(() => undefined)).toBe(false)
  })
})
