/** Input and row presentation shared by the board and today's sidebar list. */
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { AI_NOTE, focusAvailable, timeSpans, type Tag, type Task } from './board-model.ts'
import type { Translate } from './AutoTodoPage.tsx'
import css from './AutoTodoPage.module.css'

/** Status of an explicit classification request on a task row. */
export type ActivityState = 'classifying' | 'classifyFailed' | 'classifyNoTags'

/** Named tag swatches accepted by the editor. */
export const TAG_COLORS = ['white', 'orange', 'amber', 'green', 'cyan', 'blue', 'violet', 'pink', 'red'] as const

const LIGHT_HEX = new Set(['#ffffff', '#fa6710', '#f79410', '#14c370', '#15b8a4'])

/** Resolve the foreground and background of a board tag. */
export function tagPaint(color: string): { className: string; style?: { background: string; color: string } } {
  if (color.startsWith('#')) {
    const ink = LIGHT_HEX.has(color.toLowerCase()) ? '#141414' : '#ffffff'
    return { className: '', style: { background: color, color: ink } }
  }
  if (!(TAG_COLORS as readonly string[]).includes(color)) return { className: '' }
  return { className: css[`swatch-${color}`] ?? '' }
}

/** Submit Enter outside an IME composition or Shift+Enter. */
export function submitEnter(event: ReactKeyboardEvent, submit: () => void): void {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
  event.preventDefault()
  submit()
}

/** Render the add field shared by a task column and its sidebar view. */
export function TaskInput({ label, value, onChange, onSubmit }: {
  label: string
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
}) {
  return <input aria-label={label} placeholder={label} value={value}
    onChange={(event) => { onChange(event.target.value) }}
    onKeyDown={(event) => { submitEnter(event, () => { onSubmit(value) }) }} />
}

function Title({ task, done }: { task: Task; done: boolean }) {
  if (done) return <span className={css.doneTitle}>{task.title}</span>
  return <span>{timeSpans(task.title).map((span, index) => <span key={`${index}-${span.text}`} className={span.time ? css.time : undefined}>{span.text}</span>)}</span>
}

/** Render a task occurrence and the controls available in its view. */
export function TaskRow(props: {
  task: Task
  date: string
  tags: Tag[]
  today?: string | undefined
  t: Translate
  activity?: ActivityState | undefined
  copied?: boolean
  collapsed?: boolean
  paired?: string | undefined
  child?: boolean
  onPointerDown?: (event: ReactPointerEvent) => void
  onMenu?: (event: ReactMouseEvent) => void
  onToggle: () => void
  onFocus?: () => void
  onCopy?: () => void
}) {
  const { task, date, today, t } = props
  const done = task.completedDates.includes(date)
  const tags = props.tags.filter(tag => task.tagIds.includes(tag.id))
  return (
    <div className={`${css.row} ${props.collapsed ? css.collapsed : ''} ${props.paired !== undefined ? css.pair : ''}`} data-row data-kind="task" data-id={task.id}
      data-draggable={props.onPointerDown !== undefined ? 'true' : undefined} data-column={task.column} data-child={props.child ? 'true' : undefined} data-group={task.groupId ?? undefined}
      onPointerDown={props.onPointerDown} onContextMenu={props.onMenu}>
      <button type="button" role="checkbox" aria-label={task.title} aria-checked={done} data-no-drag className={done ? css.boxOn : css.box} onClick={props.onToggle} />
      {tags.map((tag) => {
        const paint = tagPaint(tag.color)
        return <i key={tag.id} className={`${css.dot} ${paint.className}`} style={paint.style} />
      })}
      <Title task={task} done={done} />
      {task.recurrence !== 'none' && <span className={css.pill}>{t(task.recurrence === 'daily' ? 'recurrence.daily' : 'recurrence.weekday')}</span>}
      {props.onFocus !== undefined && today !== undefined && focusAvailable(task, date, today) && <button type="button" className={css.iconBtn} data-no-drag aria-label={t('focus.dial')} onClick={props.onFocus}><ClockMark /></button>}
      {props.onCopy !== undefined && noteLinesFirst(task) && <button type="button" className={css.iconBtn} data-no-drag aria-label={props.copied ? t('copy.copied') : t('copy.copy')} onClick={props.onCopy}>{props.copied ? <CheckMark /> : <CopyMark />}</button>}
      {props.activity !== undefined && <p role="status" className={props.activity === 'classifying' ? css.status : css.fail}>{t(`status.${props.activity}`)}</p>}
      {props.paired !== undefined && <div className={css.pairBox}><span>{props.paired}</span><span>{task.title}</span></div>}
    </div>
  )
}

function noteLinesFirst(task: Task): boolean {
  return task.notes[0]?.text.split('\n')[0]?.trim() === AI_NOTE
}

/** Render the shared outline frame for the board controls. */
export function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

function ClockMark() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </Glyph>
  )
}

function CopyMark() {
  return (
    <Glyph>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M5 15V5h10" />
    </Glyph>
  )
}

function CheckMark() {
  return <Glyph><path d="M5 12.5 9.5 17 19 7" /></Glyph>
}
