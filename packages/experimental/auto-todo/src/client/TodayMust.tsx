/** Right-sidebar view of today's required occurrences. */
import { useEffect, useState } from 'react'
import { IconChecklistOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { isBoard, isoDate, rowsFor, type Board } from './board-model.ts'
import type { BoardActions } from './board-store.ts'
import { TaskInput, TaskRow } from './TaskControls.tsx'
import css from './AutoTodoPage.module.css'

/**
 * Label the tab with the daily task icon.
 * @param props - localized copy.
 * @returns the tab title.
 */
export function TodayMustTitle({ t }: PropsLocale<'autoTodo'>) {
  return <><IconChecklistOutlineRegular size={16} className={css.sidebarIcon} />{t('panel')}</>
}

/** Shared board subscription and task actions for the sidebar. */
export interface TodayMustInjected {
  now: () => number
  actions: Pick<BoardActions, 'addTask' | 'setCompleted'>
  hooks: { board: HostObservable<Board> }
}

/**
 * Show today's required tasks with the board's add and completion controls.
 * @param props - shared board, clock and localized text.
 * @returns the right-sidebar tab body.
 */
export function TodayMust({ useBoard, now, actions, t }: InjectFace<TodayMustInjected> & PropsLocale<'autoTodo'>) {
  const board = useBoard(state => state)
  const [today, setToday] = useState(() => isoDate(now()))
  const [draft, setDraft] = useState('')
  useEffect(() => {
    const update = () => { setToday(isoDate(now())) }
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [now])
  if (!isBoard(board)) return null
  const tasks = rowsFor(board, 'must', today, []).flatMap(row =>
    row.kind === 'task' ? [row.task] : row.tasks)
  return (
    <section className={css.sidebar} aria-label={t('sidebar.today')}>
      <div className={css.column}>
        <TaskInput label={t('add.must')} value={draft} onChange={setDraft}
          onSubmit={(title) => {
            if (title.trim() === '') return
            const timestamp = now()
            const date = isoDate(timestamp)
            actions.addTask('must', title, date, [], timestamp)
            setToday(date)
            setDraft('')
          }} />
        <div className={css.list}>
          {tasks.length === 0 && <p className={css.empty}>{t('sidebar.empty')}</p>}
          {tasks.map(task => (
            <TaskRow key={task.id} task={task} tags={board.tags} date={today} t={t}
              onToggle={() => { actions.setCompleted(task.id, today, !task.completedDates.includes(today)) }} />
          ))}
        </div>
      </div>
    </section>
  )
}
