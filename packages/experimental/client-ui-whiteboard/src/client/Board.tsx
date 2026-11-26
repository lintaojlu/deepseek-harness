/** Sidebar body: one Excalidraw canvas, local save, and send-to-session. */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { WhiteboardCanvas, type CanvasExport } from './Canvas.tsx'
import type { NS, WhiteboardKey } from './locales.ts'
import type { QueueDrawingResult } from './queue.ts'
import {
  SAVE_DELAY_MS, SCENE_FILE, debounce, downloadBlob, parseScene, sceneDocument,
  type WhiteboardScene, type WhiteboardStorage, type WhiteboardTheme,
} from './scene.ts'
import css from './board.module.css'

/** Status line shown under the toolbar. */
type BoardStatus = 'saved' | 'sent' | 'sendFailed' | 'openFailed'

/** Translator keys for {@link BoardStatus}. */
const STATUS_KEY = {
  saved: 'status.saved',
  sent: 'status.sent',
  sendFailed: 'status.sendFailed',
  openFailed: 'status.openFailed',
} as const satisfies Record<BoardStatus, WhiteboardKey>

/** Data and actions the registration passes into {@link WhiteboardView}. */
export interface WhiteboardInjected {
  /** Session whose sidebar is showing the board. Used as the default send target. */
  readonly sessionId: SessionId
  /** Browser store for the one shared scene. */
  readonly storage: WhiteboardStorage
  /** @returns whether a missing document should start dark. */
  readonly prefersDark: () => boolean
  /**
   * Queue the PNG and prompt on a session.
   * @param sessionId - target session.
   * @param prompt - text sent with the image.
   * @param png - exported canvas.
   * @returns whether the session accepted the message.
   */
  readonly queueDrawing: (sessionId: SessionId, prompt: string, png: Blob) => Promise<QueueDrawingResult>
  /** Session catalog. The renderer binds it as `useCatalog`. */
  readonly hooks: { readonly catalog: ISessions['list'] }
}

/** Sidebar props for the whiteboard body. */
export type WhiteboardProps = InjectFace<WhiteboardInjected> & PropsLocale<typeof NS>

/**
 * Render the whiteboard for one sidebar tab.
 * @param props - catalog, storage, and the send action.
 * @returns the toolbar, status, canvas, and send dialog.
 */
export function WhiteboardView(props: WhiteboardProps) {
  const initial = useRef(props.storage.read(props.prefersDark()))
  const sceneRef = useRef<WhiteboardScene>(initial.current)
  const themeRef = useRef<WhiteboardTheme>(initial.current.theme)
  const exportRef = useRef<CanvasExport | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const saver = useRef(debounce(() => { props.storage.write(sceneRef.current) }, SAVE_DELAY_MS))
  const [theme, setTheme] = useState<WhiteboardTheme>(initial.current.theme)
  const [generation, setGeneration] = useState(0)
  const [status, setStatus] = useState<BoardStatus | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [target, setTarget] = useState<SessionId | ''>(props.sessionId)
  const [sending, setSending] = useState(false)
  const sessionField = useId()
  const promptField = useId()
  const catalog = props.useCatalog(list => list)
  const choices = useMemo(() => catalog.ids.flatMap((id) => {
    const row = catalog.byId[id]
    return row === undefined ? [] : [{ id, title: row.displayTitle }]
  }), [catalog])
  const selected = choices.some(choice => choice.id === target) ? target : ''

  useEffect(() => () => {
    saver.current.cancel()
    props.storage.write(sceneRef.current)
  }, [props.storage])

  const onScene = useCallback((next: Pick<WhiteboardScene, 'elements' | 'files'>) => {
    sceneRef.current = { ...next, theme: themeRef.current }
    saver.current.call()
  }, [])

  function chooseTheme(next: WhiteboardTheme): void {
    themeRef.current = next
    sceneRef.current = { ...sceneRef.current, theme: next }
    setTheme(next)
    props.storage.write(sceneRef.current)
  }

  function save(): void {
    const scene = { ...sceneRef.current, theme: themeRef.current }
    sceneRef.current = scene
    props.storage.write(scene)
    downloadBlob(SCENE_FILE, new Blob([sceneDocument(scene)], { type: 'application/json' }))
    setStatus('saved')
  }

  async function openFile(file: File | undefined): Promise<void> {
    if (file === undefined) return
    try {
      const parsed = parseScene(JSON.parse(await file.text()), themeRef.current)
      if (parsed === undefined) {
        setStatus('openFailed')
        return
      }
      sceneRef.current = parsed
      themeRef.current = parsed.theme
      props.storage.write(parsed)
      setTheme(parsed.theme)
      setGeneration(value => value + 1)
      setStatus(null)
    } catch (error: unknown) {
      // A truncated file and any other read failure both refuse the open.
      console.error('whiteboard: open failed', error)
      setStatus('openFailed')
    }
  }

  async function send(): Promise<void> {
    const choice = choices.find(item => item.id === selected)
    const handle = exportRef.current
    if (choice === undefined || handle === null || prompt.trim() === '') return
    setSending(true)
    setStatus(null)
    try {
      const png = await handle.exportPng()
      const result = await props.queueDrawing(choice.id, prompt.trim(), png)
      if (result.ok) {
        setDialogOpen(false)
        setPrompt('')
        setStatus('sent')
      } else {
        setStatus('sendFailed')
      }
    } catch (error: unknown) {
      console.error('whiteboard: send failed', error)
      setStatus('sendFailed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={css.root}>
      <div className={css.toolbar}>
        <Button size="sm" variant="outline" onClick={save}>{props.t('save')}</Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>{props.t('open')}</Button>
        <input
          ref={fileRef}
          className={css.file}
          type="file"
          accept=".excalidraw,.json,application/json"
          aria-label={props.t('open')}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            void openFile(file)
          }}
        />
        <span className={css.spacer} />
        <div className={css.theme} role="radiogroup" aria-label={props.t('theme')}>
          <Button size="sm" variant={theme === 'light' ? 'outline' : 'ghost'} role="radio" aria-checked={theme === 'light'} onClick={() => { chooseTheme('light') }}>{props.t('theme.light')}</Button>
          <Button size="sm" variant={theme === 'dark' ? 'outline' : 'ghost'} role="radio" aria-checked={theme === 'dark'} onClick={() => { chooseTheme('dark') }}>{props.t('theme.dark')}</Button>
        </div>
        <Button size="sm" variant="primary" onClick={() => { setTarget(props.sessionId); setDialogOpen(true) }}>{props.t('send')}</Button>
      </div>
      {status !== null && <p className={css.status} role="status">{props.t(STATUS_KEY[status])}</p>}
      <div className={css.canvas}>
        <WhiteboardCanvas
          key={generation}
          theme={theme}
          scene={sceneRef.current}
          failedLabel={props.t('canvas.failed')}
          onScene={onScene}
          onReady={(handle) => { exportRef.current = handle }}
        />
      </div>
      <Modal
        open={dialogOpen}
        onClose={() => { if (!sending) setDialogOpen(false) }}
        closeLabel={props.t('dialog.cancel')}
        title={props.t('dialog.title')}
        description={props.t('dialog.description')}
        footer={(
          <>
            <Button variant="outline" disabled={sending} onClick={() => { setDialogOpen(false) }}>{props.t('dialog.cancel')}</Button>
            <Button variant="primary" disabled={sending || selected === '' || prompt.trim() === ''} onClick={() => { void send() }}>{sending ? props.t('dialog.sending') : props.t('dialog.submit')}</Button>
          </>
        )}
      >
        <div className={css.fields}>
          {choices.length === 0
            ? <p className={css.empty}>{props.t('status.empty')}</p>
            : (
              <label className={css.field} htmlFor={sessionField}>
                <span>{props.t('dialog.session')}</span>
                <select id={sessionField} className={css.select} value={selected} onChange={(event) => {
                  const next = choices.find(choice => choice.id === event.currentTarget.value)
                  setTarget(next === undefined ? '' : next.id)
                }}>
                  <option value="">{props.t('dialog.choose')}</option>
                  {choices.map(choice => <option key={choice.id} value={choice.id}>{choice.title}</option>)}
                </select>
              </label>
            )}
          <label className={css.field} htmlFor={promptField}>
            <span>{props.t('dialog.prompt')}</span>
            <textarea
              id={promptField}
              className={css.prompt}
              value={prompt}
              placeholder={props.t('dialog.placeholder')}
              data-modal-autofocus="true"
              onChange={(event) => { setPrompt(event.currentTarget.value) }}
            />
          </label>
        </div>
      </Modal>
    </div>
  )
}
