/** Add or edit a single daily-task tag. */
import { useEffect, useRef, useState } from 'react'
import { Button, IconTrashOutlineRegular, Input, Modal, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Board } from './board-model.ts'
import type { BoardActions } from './board-store.ts'
import type { ModelActions } from './model-actions.ts'
import type { Translate } from './AutoTodoPage.tsx'
import { TAG_COLORS } from './TaskControls.tsx'
import css from './AutoTodoPage.module.css'

/** Editable tag fields, with an id for an existing tag. */
export interface TagDraft {
  id?: string
  name: string
  description: string
  color: string
}

/**
 * Edit a tag's name, description and color in a DSH dialog.
 * @param props - draft, saved board, write operations and localized copy.
 * @returns the tag dialog.
 */
export function EditTag({ initial, board, t, actions, model, onClose, onDelete }: {
  initial: TagDraft
  board: Board
  t: Translate
  actions: BoardActions
  model: ModelActions
  onClose: () => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState(initial)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort() }, [])
  const duplicate = board.tags.some(tag => tag.id !== draft.id && tag.name === draft.name.trim())

  async function generate(): Promise<void> {
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setFailed(false)
    try {
      const id = draft.id
      const titles = id === undefined ? [] : board.tasks.filter(task => task.tagIds.includes(id)).map(task => task.title)
      const description = await model.describeTag(
        JSON.stringify({ name: draft.name, description: draft.description, titles }), controller.signal)
      if (!controller.signal.aborted) setDraft(current => ({ ...current, description }))
    } catch (_error) {
      if (!controller.signal.aborted) setFailed(true)
    } finally {
      if (!controller.signal.aborted) setPending(false)
    }
  }

  return (
    <Modal open title={t(draft.id === undefined ? 'tags.add' : 'tags.edit')} closeLabel={t('edit.close')} onClose={onClose}
      footer={<>
        {draft.id !== undefined && <Tooltip label={t('tags.delete')}>
          <Button aria-label={t('tags.delete')} className={css.danger} icon={<IconTrashOutlineRegular />} onClick={() => {
            const id = draft.id
            if (id === undefined) return
            actions.deleteTag(id)
            onDelete(id)
            onClose()
          }} />
        </Tooltip>}
        <Button variant="outline" onClick={onClose}>{t('edit.cancel')}</Button>
        <Button variant="primary" disabled={pending || !draft.name.trim() || duplicate} onClick={() => {
          actions.saveTag(draft.name, draft.color, draft.description, draft.id)
          onClose()
        }}>{t('settings.save')}</Button>
      </>}>
      <label className={css.fieldLabel}>{t('tags.name')}
        <Input value={draft.name} disabled={pending} aria-invalid={duplicate}
          onChange={(event) => { setDraft({ ...draft, name: event.target.value }) }} />
      </label>
      {duplicate && <p role="alert" className={css.danger}>{t('tags.duplicate')}</p>}
      <div className={css.dialogSection}>
        <div className={css.sectionHeader}>
          <label htmlFor="auto-todo-tag-description">{t('tags.description')}</label>
          <Button size="sm" disabled={pending || !draft.name.trim()} onClick={() => { void generate() }}>
            {t(pending ? 'settings.loading' : 'tags.generate')}
          </Button>
        </div>
        <textarea id="auto-todo-tag-description" className={css.field} value={draft.description} disabled={pending}
          onChange={(event) => { setDraft({ ...draft, description: event.target.value }) }} />
        {failed && <p role="alert" className={css.danger}>{t('tags.generateFailed')}</p>}
      </div>
      <div className={css.fieldLabel}>
        <span>{t('tags.color')}</span>
        <div role="group" className={css.swatches} aria-label={t('tags.color')}>
          {TAG_COLORS.map(color => (
            <button key={color} type="button" className={css[`swatch-${color}`]} aria-pressed={draft.color === color}
              aria-label={t(`tags.color.${color}`)} onClick={() => { setDraft({ ...draft, color }) }} />
          ))}
        </div>
      </div>
    </Modal>
  )
}
