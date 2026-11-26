/** Daily task model form and model list discovery. */
import { useEffect, useId, useRef, useState } from 'react'
import { Button, IconEyeOffOutlineRegular, IconEyeOutlineRegular, Input, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TaskModelSettings, TaskModelUpdate } from '../types.ts'
import type { ModelActions } from './model-actions.ts'
import type { Translate } from './AutoTodoPage.tsx'
import css from './AutoTodoPage.module.css'

/**
 * Configure the route used for task classification.
 * @param props - model operations and localized copy.
 * @returns the model settings section.
 */
export function ModelSettings({ model, t }: { model: ModelActions; t: Translate }) {
  const [saved, setSaved] = useState<TaskModelSettings>()
  const [draft, setDraft] = useState<TaskModelUpdate>()
  const [names, setNames] = useState<string[]>([])
  const [pending, setPending] = useState<'saving' | 'listing' | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [notice, setNotice] = useState<'loadFailed' | 'saveFailed' | 'listFailed' | 'saved' | null>(null)
  const [reload, setReload] = useState(0)
  const listId = useId()
  const request = useRef<AbortController | null>(null)
  const life = useRef<AbortController | null>(null)

  function accept(settings: TaskModelSettings): void {
    setSaved(settings)
    setDraft({ mode: settings.mode, endpoint: settings.endpoint, model: settings.model })
    setShowKey(false)
  }

  useEffect(() => {
    const controller = new AbortController()
    life.current = controller
    void model.settings().then((settings) => {
      if (!controller.signal.aborted) accept(settings)
    }, () => {
      if (!controller.signal.aborted) setNotice('loadFailed')
    })
    return () => {
      controller.abort()
      request.current?.abort()
    }
  }, [model, reload])

  if (draft === undefined || saved === undefined) return (
    <section className={css.settingsContent} aria-busy={notice === null}>
      <h2>{t('settings.model')}</h2>
      {notice === null ? <p role="status">{t('settings.loading')}</p> : (
        <div role="alert" className={css.settingsNotice}>{t('settings.loadFailed')}
          <Button size="sm" variant="outline" onClick={() => { setNotice(null); setReload(count => count + 1) }}>{t('settings.retry')}</Button>
        </div>
      )}
    </section>
  )
  const busy = pending !== null
  const dirty = draft.mode !== saved.mode || draft.endpoint !== saved.endpoint || draft.model !== saved.model || Boolean(draft.key)
  const needsKey = draft.mode === 'jev' && !draft.key?.trim() && !(saved.keyConfigured && draft.endpoint === saved.endpoint)

  function change(patch: Partial<TaskModelUpdate>): void {
    setDraft(current => current === undefined ? current : { ...current, ...patch })
    setNotice(null)
  }

  async function save(update: TaskModelUpdate): Promise<void> {
    const signal = life.current?.signal
    setNotice(null)
    setPending('saving')
    try {
      const settings = await model.save(update)
      if (!signal?.aborted) {
        accept(settings)
        setNotice('saved')
      }
    } catch (_error) {
      if (!signal?.aborted) setNotice('saveFailed')
    } finally {
      if (!signal?.aborted) setPending(null)
    }
  }

  async function list(update: TaskModelUpdate): Promise<void> {
    const controller = new AbortController()
    request.current = controller
    setNotice(null)
    setNames([])
    setPending('listing')
    try {
      const models = await model.models(update, controller.signal)
      if (!controller.signal.aborted) {
        setNames([...new Set(models)])
        if (models.length === 0) setNotice('listFailed')
      }
    } catch (_error) {
      if (!controller.signal.aborted) setNotice('listFailed')
    } finally {
      if (!controller.signal.aborted) setPending(null)
    }
  }

  return (
    <section className={css.settingsContent}>
      <h2>{t('settings.model')}</h2>
      <div className={css.settingsCard}>
        <label className={css.settingRow}>
          <span>{t('settings.route')}</span>
          <select className={css.field} value={draft.mode} disabled={busy} onChange={(event) => {
            change({ mode: event.target.value === 'jev' ? 'jev' : 'dsh' })
          }}>
            <option value="dsh">{t('settings.followDsh')}</option>
            <option value="jev">{t('settings.jev')}</option>
          </select>
        </label>
        {draft.mode === 'dsh' && (
          <div className={css.settingRow}><span>{t('settings.current')}</span><span>{saved.dshProvider} / {saved.dshModel}</span></div>
        )}
      </div>
      {draft.mode === 'jev' && (
        <div className={css.settingsCard}>
          <div className={css.sectionHeader}>
            <div><h3>{t('settings.jev')}</h3><p>{t('settings.jevHelp')}</p></div>
            <Button variant="outline" size="sm" disabled={busy || needsKey} onClick={() => { void list(draft) }}>
              {t(pending === 'listing' ? 'settings.loading' : 'settings.fetch')}
            </Button>
          </div>
          <div className={css.settingRow}>
            <label htmlFor={`${listId}-key`}>{t('settings.key')}</label>
            <div className={css.keyField}>
              <Input id={`${listId}-key`} type={showKey ? 'text' : 'password'} autoComplete="new-password" value={draft.key ?? ''}
                disabled={busy} placeholder={saved.keyConfigured && draft.endpoint === saved.endpoint ? t('settings.keySaved') : undefined}
                onChange={(event) => { setNames([]); change({ key: event.target.value }) }} />
              <Tooltip label={t(showKey ? 'settings.hideKey' : 'settings.showKey')}>
                <Button aria-label={t(showKey ? 'settings.hideKey' : 'settings.showKey')} disabled={!draft.key}
                  icon={showKey ? <IconEyeOffOutlineRegular /> : <IconEyeOutlineRegular />}
                  onClick={() => { setShowKey(current => !current) }} />
              </Tooltip>
            </div>
          </div>
          <label className={css.settingRow}><span>{t('settings.endpoint')}</span>
            <Input type="url" value={draft.endpoint} disabled={busy}
              onChange={(event) => { setNames([]); change({ endpoint: event.target.value }) }} />
          </label>
          <label className={css.settingRow}><span>{t('settings.jevModel')}</span>
            <Input list={listId} value={draft.model} placeholder="jev-latest" disabled={busy}
              onChange={(event) => { change({ model: event.target.value }) }} />
            <datalist id={listId}>{names.map(name => <option key={name} value={name} />)}</datalist>
          </label>
        </div>
      )}
      <div className={css.settingsFooter}>
        {notice !== null && <span role={notice === 'saved' ? 'status' : 'alert'}>{t(`settings.${notice}`)}</span>}
        <Button variant="primary" disabled={busy || !dirty || needsKey} onClick={() => {
          const update: TaskModelUpdate = { mode: draft.mode, endpoint: draft.endpoint, model: draft.model }
          if (draft.key?.trim()) update.key = draft.key
          void save(update)
        }}>{t(pending === 'saving' ? 'settings.saving' : 'settings.save')}</Button>
      </div>
    </section>
  )
}
