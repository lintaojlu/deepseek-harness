// @vitest-environment jsdom
/** The CEOS marks shadow the shipped brand and leave with the plugin. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { afterEach, describe, expect, it, onTestFinished } from 'vitest'
import { cleanup } from '@testing-library/react'
import { CEOS_MARK_URL } from '../src/client/Brand.tsx'
import { zh } from '../src/client/locales.ts'
import * as ceos from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'

afterEach(cleanup)

/**
 * A runtime whose brand slots the shipped plugins can fill at the default rank.
 * @returns the runtime and a mount for a rank-0 brand.
 */
async function bench() {
  const runtime = await SlotTestRuntime.create()
  onTestFinished(() => runtime.dispose())
  const locale = new LocaleRuntime(runtime.ctx)
  runtime.ctx.provide('locale', locale)
  runtime.slots.installLocale(locale)
  await runtime.declare({
    'sidebar.brand.mark': { kind: 'single', scope: 'root' },
    'sidebar.brand.name': { kind: 'single', scope: 'root' },
    'conversation.hero.brand.mark': { kind: 'single', scope: 'root' },
  })
  const mountShipped = async (): Promise<void> => {
    await runtime.mount({
      inject: ['slots'],
      apply(ctx: ClientContext) {
        ctx.slots.register({ name: 'sidebar.brand.mark' }, () => <span data-shipped="brand-mark">shipped mark</span>)
        ctx.slots.register({ name: 'sidebar.brand.name' }, () => <span data-shipped="brand-name">shipped name</span>)
        ctx.slots.register({ name: 'conversation.hero.brand.mark' }, () => <span data-shipped="hero-mark">shipped hero</span>)
      },
    })
  }
  return { locale, runtime, mountShipped }
}

describe('CEOS brand plugin', () => {
  it('keeps the host entry inert', () => {
    expect(hostApply).not.toThrow()
  })

  it('draws the CEOS marks over the shipped brand and removes them on dispose', async () => {
    const { locale, runtime, mountShipped } = await bench()
    await mountShipped()
    const handle = await runtime.mount(ceos)
    locale.setLocale('zh')
    const mark = runtime.renderSlot('sidebar.brand.mark', { size: 24 })
    const name = runtime.renderSlot('sidebar.brand.name', {})
    const hero = runtime.renderSlot('conversation.hero.brand.mark', { size: 34, className: 'hero-mark' })

    expect(mark.container.querySelector('[data-shipped="brand-mark"]')).toBeNull()
    expect(mark.container.querySelector('img')).toBeNull()
    expect(name.container.textContent).toContain(zh.name)
    expect(name.container.textContent).toContain(zh.tagline)
    expect(name.container.textContent).not.toMatch(/0\.2\.2/)
    expect(hero.container.querySelector('img')?.getAttribute('width')).toBe('34')
    expect(hero.container.querySelector('img')?.className).toContain('hero-mark')
    expect(document.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(CEOS_MARK_URL)
    for (const key of ['sidebar.brand.mark', 'sidebar.brand.name', 'conversation.hero.brand.mark'] as const) {
      expect(runtime.slots.entries(key).some(entry => (entry.options.priority ?? 0) === -10)).toBe(true)
    }

    await handle.dispose()
    expect(document.querySelector('link[rel="icon"]')).toBeNull()
    expect(await mark.view.findByText('shipped mark')).toBeTruthy()
    expect(await name.view.findByText('shipped name')).toBeTruthy()
    expect(await hero.view.findByText('shipped hero')).toBeTruthy()
  })
})
