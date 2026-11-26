// @vitest-environment jsdom
/** The tasks page registers for the plugin lifetime and leaves with it. */

import { Context } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { render } from '@testing-library/react'
import { describe, expect, it, onTestFinished } from 'vitest'
import * as discovery from '../src/index.ts'
import { BOARD_STORAGE_KEY, installBoardSeed } from '../src/client/board-seed.ts'
import { AutoTodoIcon } from '../src/client/AutoTodoIcon.tsx'
import { PANEL_ID, apply, inject } from '../src/client/index.ts'
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

  it('keeps the host entry inert and draws the sidebar glyph', () => {
    expect('default' in discovery).toBe(false)
    expect(() => { discovery.apply() }).not.toThrow()
    const view = render(<AutoTodoIcon size={24} />)
    expect(view.container.querySelector('svg')?.getAttribute('width')).toBe('24')
  })

  it('registers the main panel and the sidebar entry, then removes both', async () => {
    const ctx = new Context()
    onTestFinished(async () => { await ctx.fiber.dispose() })
    ctx.provide('locale', new LocaleRuntime(ctx))
    ctx.locale.setLocale('en')
    await ctx.plugin(SlotRegistry).await()
    const fiber = ctx.plugin({ apply, inject })
    await fiber.await()
    const owner = ctx.slots.register({
      name: 'root',
      children: {
        main: { kind: 'keyed', scope: 'root' },
        'sidebar.panellist': { kind: 'list', scope: 'root' },
      },
    } as never, () => null)
    expect(inject).toEqual(['slots', 'locale'])
    expect(ctx.slots.entries('main').map(entry => entry.options.key)).toEqual([PANEL_ID])
    const panel = ctx.slots.entries('sidebar.panellist')[0]!
    expect(panel.options.id).toBe(PANEL_ID)
    const injected = (ctx.slots.entries('main')[0]!.inject as () => { now: () => number })()
    expect(injected.now()).toBeGreaterThan(0)
    expect(panel.options.label()).toBe(en.panel)
    ctx.locale.setLocale('zh')
    expect(panel.options.label()).toBe(zh.panel)
    await fiber.dispose()
    expect(ctx.slots.entries('main')).toEqual([])
    expect(ctx.slots.entries('sidebar.panellist')).toEqual([])
    owner()
  })
})
