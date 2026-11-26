/** Shared tokenizer for the VitePress section index and browser queries. */

/**
 * Index contiguous Han characters in pairs so Chinese queries can match within a sentence.
 * VitePress serializes this function for the browser, so it must be self-contained.
 *
 * @param text - Section or query text.
 * @returns Han pairs, standalone Han characters, and punctuation-delimited terms.
 */
export function tokenizeDocsSearch(text: string): string[] {
  const segments = text.match(/\p{Script=Han}+|[^\p{Script=Han}\n\r\p{Z}\p{P}]+/gu) ?? []
  const terms: string[] = []
  for (const segment of segments) {
    if (!/^\p{Script=Han}{2}/u.test(segment)) {
      terms.push(segment)
      continue
    }
    let previous = ''
    for (const character of segment) {
      if (previous) terms.push(previous + character)
      previous = character
    }
  }
  return terms
}
