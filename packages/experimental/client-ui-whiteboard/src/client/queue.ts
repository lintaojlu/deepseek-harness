/** Queue one whiteboard PNG and prompt on a chosen session. */

import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    /** One drawing sent from the whiteboard into a session. */
    whiteboardExport: unknown
  }
}

/** Whether the session accepted the drawing. */
export type QueueDrawingResult = { readonly ok: true } | { readonly ok: false }

/**
 * Encode `blob` as canonical base64, without a data-URL prefix.
 * @param blob - PNG bytes.
 * @returns canonical base64 of the bytes.
 */
export function canonicalBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result
      if (typeof url !== 'string') {
        reject(new Error('whiteboard: image read failed'))
        return
      }
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('whiteboard: image read failed'))
    }
    reader.readAsDataURL(blob)
  })
}

/**
 * Queue a user message containing the drawing and `prompt`.
 * An empty prompt is refused before the session is retained.
 * @param sessions - client session service.
 * @param sessionId - session that should continue from the drawing.
 * @param prompt - text sent with the image. Blank text is refused.
 * @param png - exported canvas image.
 * @returns whether the session accepted the message.
 */
export async function queueDrawing(
  sessions: Pick<ISessions, 'using'>,
  sessionId: SessionId,
  prompt: string,
  png: Blob,
): Promise<QueueDrawingResult> {
  const text = prompt.trim()
  if (text === '' || png.size === 0) return { ok: false }
  try {
    return await sessions.using(sessionId, { source: 'whiteboardExport' }, async (reference) => {
      await reference.ready
      const data = await canonicalBase64(png)
      const result = await reference.binding.session.prompt([
        { type: 'image', mediaType: 'image/png', data, name: 'whiteboard.png' },
        { type: 'text', text },
      ], 'queue')
      return result.ok ? { ok: true } : { ok: false }
    })
  } catch (error: unknown) {
    console.error('whiteboard: queue failed', error)
    return { ok: false }
  }
}
