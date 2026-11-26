// @vitest-environment jsdom
/** The whiteboard page registers for the plugin lifetime and leaves with it. */

import { Context } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { SidebarRightTabRegistry } from '@deepseek-ai/dsh-client-ui-sidebar-right/src/client/tab-registry.ts'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import * as discovery from '../src/index.ts'
import { WHITEBOARD_ID, WHITEBOARD_KIND, apply, inject } from '../src/client/index.ts'
import type { WhiteboardInjected } from '../src/client/Board.tsx'
import { en, zh } from '../src/client/locales.ts'

vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: () => null,
  exportToBlob: vi.fn(),
}))

vi.mock('../src/client/excalidraw.css?inline', () => ({ default: '.excalidraw{height:100%}' }))

const emptyList: SessionListState = { ids: [], byId: {}, phase: 'ready', projectionsBySession: {} }

function isWhiteboardInjected(value: object): value is WhiteboardInjected {
  if (!('sessionId' in value) || typeof value.sessionId !== 'string') return false
  if (!('prefersDark' in value) || typeof value.prefersDark !== 'function') return false
  if (!('queueDrawing' in value) || typeof value.queueDrawing !== 'function') return false
  if (!('storage' in value) || typeof value.storage !== 'object' || value.storage === null) return false
  if (!('hooks' in value) || typeof value.hooks !== 'object' || value.hooks === null) return false
  return 'catalog' in value.hooks
}

async function fixture() {
  const ctx = new Context()
  onTestFinished(async () => { await ctx.fiber.dispose() })
  ctx.provide('locale', new LocaleRuntime(ctx))
  const prompt = vi.fn(async () => ({ ok: true, value: { accepted: true } }))
  const using = vi.fn(async (_id: unknown, _options: unknown, operation: (reference: {
    ready: Promise<void>
    binding: { session: { prompt: typeof prompt } }
  }) => Promise<{ ok: boolean }>) => operation({
    ready: Promise.resolve(),
    binding: { session: { prompt } },
  }))
  ctx.provide('sessions', { list: createSnapshotStore(emptyList), using })
  const tabs = new SidebarRightTabRegistry(ctx)
  ctx.provide('sidebarRightTabs', tabs)
  ctx.locale.setLocale('en')
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'sidebar.right.pane.tab': {
        kind: 'keyed', scope: 'session',
        inject: { hooks: { tabInfo: () => { throw new Error('Tab body is not rendered in this registration test') } } },
      },
    },
  }, (_props: PropsRenderSlots<'sidebar.right.pane.tab'>) => null)
  return { ctx, tabs }
}

describe('whiteboard plugin', () => {
  it('keeps the host entry inert', () => {
    expect('default' in discovery).toBe(false)
    expect(() => { discovery.apply() }).not.toThrow()
  })

  it('registers one sidebar page and removes it with the plugin', async () => {
    const { ctx, tabs } = await fixture()
    expect(inject).toEqual(['slots', 'locale', 'sessions', 'sidebarRightTabs'])
    const fiber = ctx.plugin({ apply, inject })
    await fiber.await()
    expect(ctx.slots.entries('sidebar.right.pane.tab').map(entry => entry.options.key)).toEqual([WHITEBOARD_ID])
    expect(tabs.get(WHITEBOARD_KIND)?.title('')).toBe(en['tab.title'])
    expect(tabs.guide().map(entry => ({ kind: entry.kind, title: entry.title(), description: entry.description?.() })))
      .toEqual([{ kind: WHITEBOARD_KIND, title: en['tab.title'], description: en['tab.description'] }])
    expect(document.head.querySelector('style[data-plugin-css="dsh-whiteboard-excalidraw"]')?.textContent)
      .toBe('.excalidraw{height:100%}')
    const entry = ctx.slots.entries('sidebar.right.pane.tab')[0]!
    if (entry.inject === undefined) throw new Error('whiteboard inject is missing')
    const injected = entry.inject('shown' as never)
    if (!isWhiteboardInjected(injected)) throw new Error('whiteboard inject is missing')
    expect(injected.sessionId).toBe('shown')
    expect(injected.prefersDark()).toBe(false)
    await expect(injected.queueDrawing(injected.sessionId, 'explain', new Blob(['a']))).resolves.toEqual({ ok: true })
    ctx.locale.setLocale('zh')
    expect(tabs.get(WHITEBOARD_KIND)?.title('')).toBe(zh['tab.title'])
    await fiber.dispose()
    expect(ctx.slots.entries('sidebar.right.pane.tab')).toEqual([])
    expect(tabs.get(WHITEBOARD_KIND)).toBeUndefined()
    expect(document.head.querySelector('style[data-plugin-css="dsh-whiteboard-excalidraw"]')).toBeNull()
  })
})
