// @vitest-environment jsdom
/** The tasks page registers for the plugin lifetime and leaves with it. */

import { Context } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { render } from '@testing-library/react'
import { describe, expect, it, onTestFinished } from 'vitest'
import { BOARD_STORAGE_KEY, installBoardSeed } from '../src/client/board-seed.ts'
import { AutoTodoIcon } from '../src/client/AutoTodoIcon.tsx'
import { PANEL_ID, mountBoard, inject } from '../src/client/mount.ts'
import { en, zh } from '../src/client/locales.ts'

describe('auto todo plugin', () => {
  it('copies the CEOS board once and leaves a board that is already stored', () => {
    localStorage.clear()
    installBoardSeed()
    const seeded = localStorage.getItem(BOARD_STORAGE_KEY)
    expect(seeded).toContain('"version":1')
    localStorage.setItem(BOARD_STORAGE_KEY, '{"kept":true}')
    installBoardSeed()
    expect(localStorage.getItem(BOARD_STORAGE_KEY)).toBe('{"kept":true}')
    localStorage.clear()
  })

  it('draws the sidebar glyph at the requested size', () => {
    const view = render(<AutoTodoIcon size={24} />)
    expect(view.container.querySelector('svg')?.getAttribute('width')).toBe('24')
  })

  it('registers the main panel and the sidebar entry, then removes both', async () => {
    const ctx = new Context()
    onTestFinished(async () => { await ctx.fiber.dispose() })
    ctx.provide('locale', new LocaleRuntime(ctx))
    ctx.locale.setLocale('en')
    await ctx.plugin(SlotRegistry).await()
    ctx.provide('remote', { autoTodoModel: {} } as never)
    const registrations = new Set<string>()
    ctx.provide('sidebarRightTabs', {
      register(definition: { kind: string }) {
        registrations.add(definition.kind)
        return () => { registrations.delete(definition.kind) }
      },
    } as never)
    const owner = ctx.slots.register({
      name: 'root',
      children: {
        main: { kind: 'keyed', scope: 'root' },
        'sidebar.panellist': { kind: 'list', scope: 'root' },
        'sidebar.right.pane.tab': { kind: 'keyed', scope: 'session' },
        'sidebar.right.pane.tab.title': { kind: 'keyed', scope: 'session' },
      },
    } as never, () => null)
    const fiber = ctx.plugin({ apply: mountBoard, inject })
    await fiber.await()
    expect(registrations.has('auto-todo')).toBe(true)
    expect(ctx.slots.entries('sidebar.right.pane.tab')).toHaveLength(1)
    expect(ctx.slots.entries('sidebar.right.pane.tab.title')).toHaveLength(1)
    expect(ctx.slots.entries('main').map(entry => entry.options.key)).toEqual([PANEL_ID])
    const panel = ctx.slots.entries('sidebar.panellist')[0]!
    expect(panel.options.id).toBe(PANEL_ID)
    const injected = (ctx.slots.entries('main')[0]!.inject as () => { now: () => number })()
    expect(injected.now()).toBeGreaterThan(0)
    const label = panel.options.label
    expect(typeof label === 'function' ? label() : label).toBe(en.panel)
    ctx.locale.setLocale('zh')
    expect(typeof label === 'function' ? label() : label).toBe(zh.panel)
    await fiber.dispose()
    expect(ctx.slots.entries('main')).toEqual([])
    expect(ctx.slots.entries('sidebar.panellist')).toEqual([])
    expect(ctx.slots.entries('sidebar.right.pane.tab')).toEqual([])
    expect(ctx.slots.entries('sidebar.right.pane.tab.title')).toEqual([])
    expect(registrations.size).toBe(0)
    owner()
  })
})
