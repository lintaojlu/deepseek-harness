// @vitest-environment jsdom
/** Sending a drawing queues one image and the written prompt. */

import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { describe, expect, it, vi } from 'vitest'
import { canonicalBase64, queueDrawing } from '../src/client/queue.ts'

const sessionId = 'session-1' as SessionId

function sessions(prompt: ReturnType<typeof vi.fn>, ready: Promise<void> = Promise.resolve()): Pick<ISessions, 'using'> {
  return {
    using: async (_id, _options, operation) => operation({
      sessionId,
      binding: { session: { prompt } },
      ready,
      release() {},
      [Symbol.dispose]() {},
    } as never),
  }
}

describe('queueDrawing', () => {
  it('encodes a blob as canonical base64', async () => {
    await expect(canonicalBase64(new Blob(['a']))).resolves.toBe('YQ==')
  })

  it('refuses a blank prompt or an empty image before retaining a session', async () => {
    const prompt = vi.fn()
    await expect(queueDrawing(sessions(prompt), sessionId, '   ', new Blob(['a']))).resolves.toEqual({ ok: false })
    await expect(queueDrawing(sessions(prompt), sessionId, 'look', new Blob())).resolves.toEqual({ ok: false })
    expect(prompt).not.toHaveBeenCalled()
  })

  it('queues the png and the trimmed prompt', async () => {
    const prompt = vi.fn(async () => ({ ok: true, value: { accepted: true } }))
    await expect(queueDrawing(sessions(prompt), sessionId, '  explain this  ', new Blob(['a']))).resolves.toEqual({ ok: true })
    expect(prompt).toHaveBeenCalledWith([
      { type: 'image', mediaType: 'image/png', data: 'YQ==', name: 'whiteboard.png' },
      { type: 'text', text: 'explain this' },
    ], 'queue')
  })

  it('reports a refused prompt and a session that cannot be opened', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const prompt = vi.fn(async () => ({ ok: false, error: { message: 'no' } }))
    await expect(queueDrawing(sessions(prompt), sessionId, 'explain', new Blob(['a']))).resolves.toEqual({ ok: false })
    await expect(queueDrawing(sessions(vi.fn(), Promise.reject(new Error('closed'))), sessionId, 'explain', new Blob(['a'])))
      .resolves.toEqual({ ok: false })
    expect(error).toHaveBeenCalled()
  })

  it('rejects a reader that returns no text or fails', async () => {
    class Reader {
      result: unknown = null
      error: Error | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL(): void {
        if (this.error !== null) this.onerror?.()
        else this.onload?.()
      }
    }
    vi.stubGlobal('FileReader', class extends Reader {
      override readAsDataURL(): void {
        this.result = 1
        super.readAsDataURL()
      }
    })
    await expect(canonicalBase64(new Blob(['a']))).rejects.toThrow('image read failed')
    vi.stubGlobal('FileReader', class extends Reader {
      override readAsDataURL(): void {
        this.error = new Error('nope')
        super.readAsDataURL()
      }
    })
    await expect(canonicalBase64(new Blob(['a']))).rejects.toThrow('nope')
    vi.stubGlobal('FileReader', class extends Reader {
      override readAsDataURL(): void {
        this.onerror?.()
      }
    })
    await expect(canonicalBase64(new Blob(['a']))).rejects.toThrow('image read failed')
    vi.unstubAllGlobals()
  })
})
