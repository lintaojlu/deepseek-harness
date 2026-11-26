/** Browser-local Excalidraw document for the one whiteboard scene. */

/** Light or dark canvas theme chosen on the board. */
export type WhiteboardTheme = 'light' | 'dark'

/** Elements, embedded files, and theme restored into Excalidraw. */
export interface WhiteboardScene {
  /** Excalidraw elements, without deleted ones. */
  readonly elements: readonly unknown[]
  /** Excalidraw file payloads keyed by element id. */
  readonly files: Readonly<Record<string, unknown>>
  /** Canvas theme stored with the document. */
  readonly theme: WhiteboardTheme
}

/** `localStorage` key for the one shared scene. */
export const SCENE_KEY = 'dsh.whiteboard.scene'

/** File name used for the downloaded Excalidraw document. */
export const SCENE_FILE = 'whiteboard.excalidraw'

/** How long a stroke waits before the browser store is rewritten. */
export const SAVE_DELAY_MS = 300

/** A string store. `localStorage` satisfies it; tests pass a memory store. */
export interface KeyValueStorage {
  /**
   * @param key - stored document key.
   * @returns the stored text, or null when the key is absent.
   */
  getItem(key: string): string | null
  /**
   * @param key - stored document key.
   * @param value - document text.
   */
  setItem(key: string, value: string): void
}

/** Read and write the one scene document. */
export interface WhiteboardStorage {
  /**
   * @param prefersDark - theme used when no document is stored.
   * @returns the stored scene, or an empty scene when the document is missing or unreadable.
   */
  read(prefersDark: boolean): WhiteboardScene
  /**
   * @param scene - scene to persist.
   * @returns whether the store accepted the document.
   */
  write(scene: WhiteboardScene): boolean
}

/**
 * @param theme - theme of the empty canvas.
 * @returns a scene with no elements.
 */
export function emptyScene(theme: WhiteboardTheme): WhiteboardScene {
  return { elements: [], files: {}, theme }
}

/**
 * Whether the OS preference asks for a dark canvas when the board has no saved theme.
 * @param match - lookup for one media query; absence means light.
 * @returns whether the dark-scheme query matches.
 */
export function prefersDarkTheme(match: (query: string) => { matches: boolean } | undefined): boolean {
  return match('(prefers-color-scheme: dark)')?.matches === true
}

/**
 * @param value - parsed JSON from an Excalidraw file or this board's document.
 * @param fallback - theme used when the document names none.
 * @returns the scene, or undefined when `value` is not an Excalidraw document.
 */
export function parseScene(value: unknown, fallback: WhiteboardTheme): WhiteboardScene | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  if ('type' in value && value.type !== 'excalidraw') return undefined
  if (!('elements' in value) || !Array.isArray(value.elements)) return undefined
  const files = 'files' in value && isRecord(value.files) ? value.files : {}
  return {
    elements: value.elements.filter(element => !isDeleted(element)),
    files,
    theme: themeOf(value, fallback),
  }
}

/**
 * @param scene - scene to download or store.
 * @returns an Excalidraw JSON document.
 */
export function sceneDocument(scene: WhiteboardScene): string {
  return JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'dsh-whiteboard',
    elements: scene.elements,
    files: scene.files,
    appState: { theme: scene.theme },
    theme: scene.theme,
  })
}

/**
 * @param storage - browser or test store.
 * @param key - document key. Defaults to {@link SCENE_KEY}.
 * @returns a storage bound to that key.
 */
export function createWhiteboardStorage(storage: KeyValueStorage, key = SCENE_KEY): WhiteboardStorage {
  return {
    read(prefersDark: boolean): WhiteboardScene {
      const theme = prefersDark ? 'dark' : 'light'
      let raw: string | null
      try {
        raw = storage.getItem(key)
      } catch (error: unknown) {
        return unrestored(error, theme)
      }
      if (raw === null) return emptyScene(theme)
      try {
        return parseScene(JSON.parse(raw), theme) ?? emptyScene(theme)
      } catch (error: unknown) {
        return unrestored(error, theme)
      }
    },
    write(scene: WhiteboardScene): boolean {
      try {
        storage.setItem(key, sceneDocument(scene))
        return true
      } catch (error: unknown) {
        console.error('whiteboard: scene store failed', error)
        return false
      }
    },
  }
}

/**
 * Schedule `action` until calls pause for `delayMs`.
 * @param action - work to run after the pause.
 * @param delayMs - quiet period before `action` runs.
 * @returns call and cancel handles. `cancel` drops a pending run.
 */
export function debounce(action: () => void, delayMs: number): { call(): void; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    call(): void {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        action()
      }, delayMs)
    },
    cancel(): void {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    },
  }
}

/**
 * Start a download of `blob`.
 * @param name - suggested file name.
 * @param blob - file bytes.
 */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * A private-mode store and a truncated document both restore an empty scene.
 * @param error - the failure from the store or from JSON parsing.
 * @param theme - theme of the empty scene.
 * @returns an empty scene. `error` selects the same outcome for both failure classes.
 */
function unrestored(error: unknown, theme: WhiteboardTheme): WhiteboardScene {
  console.error('whiteboard: scene restore failed', error)
  return emptyScene(theme)
}

/** @param value - a JSON object field. @returns whether it is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** @param element - one scene element. @returns whether Excalidraw marked it deleted. */
function isDeleted(element: unknown): boolean {
  return typeof element === 'object' && element !== null && 'isDeleted' in element && element.isDeleted === true
}

/**
 * @param value - a parsed document.
 * @param fallback - theme used when the document names none.
 * @returns the document theme, then `appState.theme`, then `fallback`.
 */
function themeOf(value: object, fallback: WhiteboardTheme): WhiteboardTheme {
  if ('theme' in value && isTheme(value.theme)) return value.theme
  if ('appState' in value && isRecord(value.appState) && isTheme(value.appState.theme)) return value.appState.theme
  return fallback
}

/** @param value - a candidate theme. @returns whether it is a board theme. */
function isTheme(value: unknown): value is WhiteboardTheme {
  return value === 'light' || value === 'dark'
}
