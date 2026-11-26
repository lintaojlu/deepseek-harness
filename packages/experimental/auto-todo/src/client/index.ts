/**
 * Browser plugin: a tasks panel and a stats page.
 * The board lives in one persisted store. Classification, title tidying, and
 * breakdown are local; they do not call a model.
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { AutoTodoIcon } from './AutoTodoIcon.tsx'
import { AutoTodoPage, type AutoTodoInjected } from './AutoTodoPage.tsx'
import { installBoardSeed } from './board-seed.ts'
import { createBoardStore } from './board-store.ts'
import { de, en, es, fr, ja, NS, pt, ru, zh } from './locales.ts'

/** Sidebar entry and main panel id. */
export const PANEL_ID = 'auto-todo' as MainPanelId

/** Services required to register the panel. */
export const inject = ['slots', 'locale']

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Tasks and stats copy. */
    'autoTodo': keyof typeof zh
  }
}

/**
 * Register the tasks panel for this plugin's lifetime.
 * @param ctx - client plugin context.
 * @returns nothing. Disposing the plugin removes the panel and the dictionaries.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'auto-todo: dictionaries')
  const t = ctx.locale.bind(NS)
  installBoardSeed()
  const store = createBoardStore()
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    store,
    inject: (): AutoTodoInjected => ({ now: () => Date.now() }),
  }, AutoTodoPage))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 40,
    locale: NS,
    label: () => t('panel'),
  }, AutoTodoIcon))
}
