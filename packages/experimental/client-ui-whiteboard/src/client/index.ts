/** Browser plugin: one Excalidraw canvas in the right sidebar. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { WhiteboardView, type WhiteboardInjected } from './Board.tsx'
import { de, en, es, fr, ja, NS, pt, ru, zh } from './locales.ts'
import { queueDrawing } from './queue.ts'
import { createWhiteboardStorage, prefersDarkTheme } from './scene.ts'
import { installExcalidrawStyles } from './styles.ts'

/** Sidebar implementation identity. The tab body registers under this key. */
export const WHITEBOARD_ID = '@deepseek-ai/dsh-client-ui-whiteboard'

/** Tab kind opened from the guide and the new-tab menu. */
export const WHITEBOARD_KIND = 'whiteboard'

/** Services required to register the canvas and to queue a prompt. */
export const inject = ['slots', 'locale', 'sessions', 'sidebarRightTabs']

/**
 * Register the whiteboard for this plugin's lifetime.
 * @param ctx - client plugin context.
 * @returns nothing. Disposing the plugin removes the tab, dictionaries, and stylesheet.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }), 'whiteboard: dictionaries')
  ctx.effect(() => installExcalidrawStyles(), 'whiteboard: canvas styles')
  const t = ctx.locale.bind(NS)
  const storage = createWhiteboardStorage(localStorage)
  const services = (sessionId: string): WhiteboardInjected => ({
    sessionId: SessionId(sessionId),
    storage,
    prefersDark: () => prefersDarkTheme(query => window.matchMedia?.(query)),
    queueDrawing: (target, prompt, png) => queueDrawing(ctx.sessions, target, prompt, png),
    hooks: { catalog: ctx.sessions.list },
  })
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: WHITEBOARD_ID,
    kind: WHITEBOARD_KIND,
    title: () => t('tab.title'),
    guide: [{
      id: 'open',
      order: 80,
      title: () => t('tab.title'),
      description: () => t('tab.description'),
    }],
  }), 'whiteboard: sidebar tab')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: WHITEBOARD_ID,
    locale: NS,
    inject: (sessionId: string): WhiteboardInjected => services(sessionId),
  }, WhiteboardView))
}
