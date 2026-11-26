/** The local plugin bundle mounts every local plugin and is not an official optional bundle. */

import { readFileSync } from 'node:fs'
import '../src/index.ts'
import { describe, expect, it } from 'vitest'
import { parseEntryYaml } from '@deepseek-ai/cordis-plugin-include'
import { EXPERIMENTAL_BUNDLES, MORE_BUNDLES, OPTIONAL_BUNDLES } from '@deepseek-ai/dsh-official-bundles'

const NAME = '@deepseek-ai/dsh-nil-plugin-bundle'

describe('Nil plugin bundle', () => {
  it('publishes one profile layer containing the local plugins', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      publishConfig: { access: string }
      dsh: { bundle: { patch: string; listedByDefault?: boolean } }
      dependencies: Record<string, string>
    }
    expect(manifest.publishConfig.access).toBe('public')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh.bundle.listedByDefault).toBeUndefined()
    expect(manifest.dependencies).toEqual({
      '@deepseek-ai/dsh-client-ui-auto-todo': 'workspace:*',
      '@deepseek-ai/dsh-client-ui-ceos': 'workspace:*',
      '@deepseek-ai/dsh-client-ui-whiteboard': 'workspace:*',
    })
    expect(parseEntryYaml(readFileSync(new URL(`../${manifest.dsh.bundle.patch}`, import.meta.url), 'utf8'))).toEqual([{ insert: [
      { id: 'auto-todo', name: '@deepseek-ai/dsh-client-ui-auto-todo' },
      { id: 'whiteboard', name: '@deepseek-ai/dsh-client-ui-whiteboard' },
      { id: 'ceos-ui', name: '@deepseek-ai/dsh-client-ui-ceos' },
    ] }])
  })

  it('stays out of the official plugin lists', () => {
    expect(OPTIONAL_BUNDLES).not.toContain(NAME)
    expect(MORE_BUNDLES).not.toContain(NAME)
    expect(EXPERIMENTAL_BUNDLES.has(NAME)).toBe(false)
  })
})
