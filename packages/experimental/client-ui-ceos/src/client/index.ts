/** Browser plugin: CEOS marks for the sidebar, the new-session page, and the browser tab. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { CeosMark, CeosName, CeosSidebarMark, CEOS_MARK_URL } from './Brand.tsx'
import { de, en, es, fr, ja, NS, pt, ru, zh } from './locales.ts'

/**
 * Rank below the shipped brand.
 * `sidebar.brand.mark` and `sidebar.brand.name` are single slots. Official builds already
 * occupy them at rank 0, so this plugin registers lower and shadows that brand.
 */
const BRAND_PRIORITY = -10

/** Services required to register the marks and the dictionaries. */
export const inject = ['slots', 'locale']

/**
 * Fill the brand seats and the browser tab icon for this plugin's lifetime.
 * @param ctx - client plugin context.
 * @returns nothing. Disposing the plugin removes the marks, the dictionaries, and the tab icon.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'ceos-ui: dictionaries')
  ctx.effect(() => {
    const icon = document.createElement('link')
    icon.rel = 'icon'
    icon.type = 'image/svg+xml'
    icon.href = CEOS_MARK_URL
    document.head.appendChild(icon)
    return () => { icon.remove() }
  }, 'ceos-ui: favicon')
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', () =>
      ctx.slots.inject('conversation.hero.brand.mark', function* () {
        yield ctx.slots.register({ name: 'sidebar.brand.mark', priority: BRAND_PRIORITY }, CeosSidebarMark)
        yield ctx.slots.register({ name: 'sidebar.brand.name', priority: BRAND_PRIORITY, locale: NS }, CeosName)
        yield ctx.slots.register({ name: 'conversation.hero.brand.mark', priority: BRAND_PRIORITY }, CeosMark)
      })))
}
