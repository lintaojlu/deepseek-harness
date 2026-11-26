/** CEOS mark and the two-line sidebar name. */

import type { ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import css from './brand.module.css'

/** Square CEOS mark used by the new-session page and the browser tab. */
const MARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="CEOS"><rect width="128" height="128" rx="28" fill="#FFFFFF"/><path d="M84 42H64A22 22 0 0 0 64 86H84" fill="none" stroke="#111111" stroke-width="15" stroke-linecap="round"/><circle cx="80" cy="64" r="6.5" fill="#111111"/></svg>'

/** Data URL for the mark image and the browser tab icon. */
export const CEOS_MARK_URL = `data:image/svg+xml,${encodeURIComponent(MARK_SVG)}`

/**
 * Render the CEOS mark at the size the host slot requests.
 * @param props - Host-supplied mark presentation. `className` is set by the new-session page.
 * @returns the mark image.
 */
export function CeosMark({ size, className }: {
  readonly size: number
  readonly className?: string | undefined
}): ReactNode {
  return <img
    alt=""
    className={className === undefined ? css.mark : `${css.mark} ${className}`}
    height={size}
    src={CEOS_MARK_URL}
    width={size}
  />
}

/**
 * Occupy the sidebar mark slot without drawing a logo, so the shipped mark stays hidden.
 * @returns nothing.
 */
export function CeosSidebarMark(): ReactNode {
  return null
}

/**
 * Render the sidebar name: the wordmark and the tagline.
 * @param props - The framework-injected translate seat for this package's copy.
 * @returns the two-line brand name.
 */
export function CeosName({ t }: PropsLocale<typeof NS>): ReactNode {
  return <span className={css.name} data-ceos-ui-brand="">
    <span className={css.wordmark}>{t('name')}</span>
    <span className={css.tagline} title={t('tagline')}>{t('tagline')}</span>
  </span>
}
