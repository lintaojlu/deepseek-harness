/** CEOS brand labels. Product copy lives in these dictionaries. */

/** Namespace owned by the CEOS brand plugin. */
export const NS = 'ceosUi'

/** Simplified Chinese labels and the key set. The tagline is the brand slogan. */
export const zh = {
  name: 'CEOS',
  tagline: '每个人都是自己的 CEO',
} as const

/** Dictionary keys accepted by this plugin's translator. */
export type CeosKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** CEOS wordmark and sidebar tagline. */
    ceosUi: CeosKey
  }
}

/** English labels. The tagline stays the brand slogan. */
export const en: Record<CeosKey, string> = {
  name: 'CEOS',
  tagline: '每个人都是自己的 CEO',
}

/** Japanese labels. The tagline stays the brand slogan. */
export const ja: Record<CeosKey, string> = {
  name: 'CEOS',
  tagline: '每个人都是自己的 CEO',
}

/** Spanish labels. The tagline stays the brand slogan. */
export const es: Record<CeosKey, string> = {
  name: 'CEOS',
  tagline: '每个人都是自己的 CEO',
}

/** French labels. The tagline stays the brand slogan. */
export const fr: Record<CeosKey, string> = {
  name: 'CEOS',
  tagline: '每个人都是自己的 CEO',
}

/** German labels. The tagline stays the brand slogan. */
export const de: Record<CeosKey, string> = {
  name: 'CEOS',
  tagline: '每个人都是自己的 CEO',
}

/** Russian labels. The tagline stays the brand slogan. */
export const ru: Record<CeosKey, string> = {
  name: 'CEOS',
  tagline: '每个人都是自己的 CEO',
}

/** Portuguese labels. The tagline stays the brand slogan. */
export const pt: Record<CeosKey, string> = {
  name: 'CEOS',
  tagline: '每个人都是自己的 CEO',
}
