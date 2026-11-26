/** Inject the Excalidraw stylesheet for the life of the plugin. */

// Vendored from @excalidraw/excalidraw 0.18.1 dist/prod/index.css, with its local
// font faces removed. The package export has no condition the client CSS resolver can select.
import excalidrawCss from './excalidraw.css?inline'

/** Style tag identity so disposal removes the sheet this plugin added. */
const STYLE_ID = 'dsh-whiteboard-excalidraw'

/**
 * Add the Excalidraw sheet to the document.
 * @returns a disposer that removes the sheet.
 */
export function installExcalidrawStyles(): () => void {
  const tag = document.createElement('style')
  tag.dataset.pluginCss = STYLE_ID
  tag.textContent = excalidrawCss
  document.head.appendChild(tag)
  return () => { tag.remove() }
}
