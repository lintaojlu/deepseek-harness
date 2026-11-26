/** Mount the daily task board and the right-sidebar list. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-auto-todo/remote'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { IconChecklistOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { AutoTodoIcon } from './AutoTodoIcon.tsx'
import { AutoTodoPage } from './AutoTodoPage.tsx'
import { TodayMust, TodayMustTitle, type TodayMustInjected } from './TodayMust.tsx'
import type { ModelActions } from './model-actions.ts'
import { installBoardSeed } from './board-seed.ts'
import { createBoardStore } from './board-store.ts'
import { de, en, es, fr, ja, NS, pt, ru, zh } from './locales.ts'

/** Sidebar entry and main panel id. */
export const PANEL_ID = 'auto-todo' as MainPanelId

/** Services required to register the panel. */
export const inject = ['slots', 'locale', 'remote', 'sidebarRightTabs']

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
export function mountBoard(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'auto-todo: dictionaries')
  const t = ctx.locale.bind(NS)
  installBoardSeed()
  const store = createBoardStore().create()
  const api = ctx.remote.autoTodoModel
  const model: ModelActions = {
    settings: () => read(api.settings()),
    save: request => read(api.save(request)),
    models: (request, signal) => read(api.models(request, signal)),
    classify: (task, signal) => read(api.classify(task, signal)),
    describeTag: (content, signal) => read(api.describeTag(content, signal)),
  }
  const now = Date.now
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: () => ({ actions: store.actions, now, model, hooks: { board: store } }),
  }, AutoTodoPage))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 40,
    locale: NS,
    label: () => t('panel'),
  }, AutoTodoIcon))
  const kind = 'auto-todo'
  const id = '@deepseek-ai/dsh-client-ui-auto-todo'
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id, kind, title: () => t('panel'),
    guide: [{ id: 'today', order: 45, title: () => t('panel'), description: () => t('sidebar.today'), icon: IconChecklistOutlineRegular }],
  }), 'auto-todo: right sidebar tab')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: id, locale: NS,
    inject: (): TodayMustInjected => ({
      now, actions: { addTask: store.actions.addTask, setCompleted: store.actions.setCompleted }, hooks: { board: store },
    }),
  }, TodayMust))
  ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title', key: id, locale: NS,
  }, TodayMustTitle))
}

async function read<T>(result: Promise<RemoteResult<T>>): Promise<T> {
  const settled = await result
  if (!settled.ok) throw settled.error
  return settled.value
}
