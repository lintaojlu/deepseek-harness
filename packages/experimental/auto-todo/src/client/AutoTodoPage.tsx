/**
 * Tasks panel: a date board, tag filter, focus timer, and stats.
 * Edits commit immediately. The page keeps only viewing state of its own.
 */

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Button, IconDatabaseOutlineRegular, IconChecklistOutlineRegular, Input, Menu, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { TaskClassification } from '../types.ts'
import {
  addDays, barTags, columnNotice, copyBody, edgeIndex,
  isBoard, isoDate, passedDragThreshold, pointerBand, rowsFor,
  unfinishedCount, unfinishedDays, weekdayIndex, weekStart,
  type Board, type Column, type DragSubject, type DropTarget, type Task,
} from './board-model.ts'
import {
  activity, clampHeatEnd, columnRate, heatOrigin, heatWeeks, percentOf, rateBetween, tagInsight,
  type HeatCell,
} from './board-stats.ts'
import type { BoardActions } from './board-store.ts'
import type { ModelActions } from './model-actions.ts'
import { ModelSettings } from './ModelSettings.tsx'
import { EditTag, type TagDraft } from './EditTag.tsx'
import { Glyph, submitEnter, tagPaint, TaskInput, TaskRow, type ActivityState } from './TaskControls.tsx'
import css from './AutoTodoPage.module.css'

/** Services injected into the daily task board. */
export interface AutoTodoInjected {
  /** Current time in epoch milliseconds. */
  now: () => number
  actions: BoardActions
  model: ModelActions
  hooks: { board: HostObservable<Board> }
}

/** Framework props for the tasks main panel. */
export type AutoTodoPageProps = InjectFace<AutoTodoInjected> & PropsLocale<'autoTodo'>

type PageId = 'tasks' | 'stats' | 'settings'
/** Daily task dictionary translator. */
export type Translate = AutoTodoPageProps['t']

const WEEKDAYS = ['weekday.0', 'weekday.1', 'weekday.2', 'weekday.3', 'weekday.4', 'weekday.5', 'weekday.6'] as const
const SHORT_WEEKDAYS = ['weekday.short.0', 'weekday.short.1', 'weekday.short.2', 'weekday.short.3', 'weekday.short.4', 'weekday.short.5', 'weekday.short.6'] as const

function dayText(iso: string, t: Translate): string {
  const [year, month, day] = iso.split('-')
  const weekday = WEEKDAYS[weekdayIndex(iso)] ?? 'weekday.0'
  return `${year}/${month}/${day} ${t(weekday)}`
}

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Render the tasks panel.
 * @param props - board store, clock, and copy.
 * @returns the tasks or stats page.
 */
export function AutoTodoPage({ useBoard, actions, model, now, t }: AutoTodoPageProps) {
  const stored = useBoard(state => state)
  const board = isBoard(stored) ? stored : null
  const [page, setPage] = useState<PageId>('tasks')
  const [width, setWidth] = useState(() => window.innerWidth || 1280)
  const [filter, setFilter] = useState<string[]>([])
  const [drafts, setDrafts] = useState<Record<Column, string>>({ must: '', optional: '' })
  const [editing, setEditing] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; subject: DragSubject } | null>(null)
  const [activityState, setActivityState] = useState<Record<string, ActivityState>>({})
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncDate, setSyncDate] = useState('')
  const [clearOpen, setClearOpen] = useState(false)
  const [settingsPage, setSettingsPage] = useState<'model' | 'tags'>('model')
  const [tagDraft, setTagDraft] = useState<TagDraft | null>(null)
  const classifications = useRef(new Map<string, AbortController>())
  const [focus, setFocus] = useState<{ taskId: string; phase: 'pick' | 'running' | 'done'; minutes: number; remaining: number; deadline: number } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [noteEdit, setNoteEdit] = useState<{ taskId: string; noteId: string | null; draft: string } | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [dragging, setDragging] = useState<DragSubject | null>(null)
  const [preview, setPreview] = useState<DropTarget | null>(null)
  const [heatEnd, setHeatEnd] = useState<string | null>(null)
  const [heatWidth, setHeatWidth] = useState(640)
  const [tooltip, setTooltip] = useState<{ date: string; detail: string; x: number; y: number } | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const heatRef = useRef<HTMLDivElement>(null)
  const filterTimer = useRef<number | null>(null)
  const boardRef = useRef<Board | null>(board)
  const filterRef = useRef(filter)
  boardRef.current = board
  filterRef.current = filter
  const today = isoDate(now())

  useEffect(() => {
    const onResize = (): void => { setWidth(window.innerWidth || 1280) }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize) }
  }, [])

  useEffect(() => () => {
    if (filterTimer.current !== null) window.clearTimeout(filterTimer.current)
  }, [])
  useEffect(() => {
    const pending = classifications.current
    return () => { pending.forEach((controller) => { controller.abort() }); pending.clear() }
  }, [])

  useEffect(() => {
    if (focus?.phase !== 'running') return undefined
    const timer = window.setInterval(() => {
      setFocus((current) => {
        if (current?.phase !== 'running') return current
        const remaining = Math.max(0, current.deadline - now())
        return remaining === 0 ? { ...current, remaining: 0, phase: 'done' } : { ...current, remaining }
      })
    }, 200)
    return () => { window.clearInterval(timer) }
  }, [focus?.phase, now])

  useEffect(() => {
    const node = heatRef.current
    if (node === null || page !== 'stats') return undefined
    const measure = (): void => { setHeatWidth(node.clientWidth || 320) }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => { observer.disconnect() }
  }, [page])

  useEffect(() => {
    if (tooltip === null) return undefined
    const hide = (): void => { setTooltip(null) }
    window.addEventListener('scroll', hide, true)
    return () => { window.removeEventListener('scroll', hide, true) }
  }, [tooltip])

  if (board === null) {
    return <button type="button" onClick={() => { actions.reset(today) }}>{t('board.reset')}</button>
  }

  const narrow = width < 960
  const dialogTask = editing === null ? undefined : board.tasks.find(task => task.id === editing)

  async function classify(task: Task, source: Board): Promise<void> {
    if (classifications.current.has(task.id)) return
    if (source.tags.length === 0) {
      setActivityState(state => ({ ...state, [task.id]: 'classifyNoTags' }))
      return
    }
    const candidates = source.tags.filter(tag => !task.tagIds.includes(tag.id))
    if (candidates.length === 0) {
      clearActivity(task.id)
      return
    }
    const input: TaskClassification = {
      title: task.title,
      notes: task.notes.map(note => note.text),
      assignedTags: source.tags.filter(tag => task.tagIds.includes(tag.id)).map(({ name, description }) => ({ name, description })),
      candidates: candidates.map(({ name, description }) => ({ name, description })),
    }
    const controller = new AbortController()
    classifications.current.set(task.id, controller)
    setActivityState(state => ({ ...state, [task.id]: 'classifying' }))
    try {
      const indexes = await model.classify(input, controller.signal)
      if (controller.signal.aborted) return
      const currentBoard = boardRef.current
      const current = currentBoard?.tasks.find(item => item.id === task.id)
      if (currentBoard?.tags === source.tags && current?.title === task.title
        && current.notes === task.notes && current.tagIds === task.tagIds) {
        const tagIds = indexes.flatMap(index => candidates[index]?.id ?? [])
        actions.addTaskTags(task.id, tagIds)
      }
      clearActivity(task.id)
    } catch (_error) {
      if (!controller.signal.aborted) setActivityState(state => ({ ...state, [task.id]: 'classifyFailed' }))
    } finally {
      if (classifications.current.get(task.id) === controller) classifications.current.delete(task.id)
    }
  }

  function clearActivity(id: string): void {
    setActivityState((state) => {
      const next = { ...state }
      Reflect.deleteProperty(next, id)
      return next
    })
  }

  function add(column: Column, title: string): void {
    if (title.trim() === '' || board === null) return
    actions.addTask(column, title, board.viewedDate, filter, now())
    setDrafts(state => ({ ...state, [column]: '' }))
  }

  function targetAt(x: number, y: number, subject: DragSubject): DropTarget | null {
    const root = pageRef.current
    const current = boardRef.current
    if (root === null || current === null) return null
    const rows = [...root.querySelectorAll<HTMLElement>('[data-row]')].reverse()
    for (const row of rows) {
      const rowId = row.dataset.id
      if (rowId === undefined) continue
      if (rowId === subject.id && row.dataset.kind === subject.kind) continue
      const rect = row.getBoundingClientRect()
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue
      const band = pointerBand(y - rect.top, rect.height)
      const column: Column = row.dataset.column === 'optional' ? 'optional' : 'must'
      const ids = rowsFor(current, column, current.viewedDate, filterRef.current)
        .map(item => item.kind === 'group' ? item.group.id : item.task.id)
      if (row.dataset.kind === 'group') {
        if (subject.kind === 'task' && band === 'middle') return { kind: 'join', groupId: rowId }
        const edge = band === 'before' ? 'before' : 'after'
        return { kind: 'insert', column, index: edgeIndex(ids, subject.id, rowId, edge) }
      }
      if (row.dataset.child === 'true' && subject.kind === 'task') {
        const groupId = row.dataset.group
        const parent = row.parentElement
        if (groupId === undefined || parent === null) continue
        const childIds = [...parent.querySelectorAll<HTMLElement>('[data-child]')]
          .flatMap((item) => {
            const id = item.dataset.id
            return id === undefined ? [] : [id]
          })
        const edge = band === 'before' ? 'before' : 'after'
        return { kind: 'child', groupId, index: edgeIndex(childIds, subject.id, rowId, edge) }
      }
      if (subject.kind === 'task' && band === 'middle') return { kind: 'pair', taskId: rowId }
      const edge = band === 'before' ? 'before' : 'after'
      return { kind: 'insert', column, index: edgeIndex(ids, subject.id, rowId, edge) }
    }
    for (const body of root.querySelectorAll<HTMLElement>('[data-column-body]')) {
      const rect = body.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const column: Column = body.dataset.column === 'optional' ? 'optional' : 'must'
        return { kind: 'append', column }
      }
    }
    return null
  }

  function onRowPointerDown(event: ReactPointerEvent, subject: DragSubject): void {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('[data-no-drag]')) return
    const startX = event.clientX
    const startY = event.clientY
    let moved = false
    let hoverTimer = 0
    const previewRef = { current: null as DropTarget | null }
    const move = (ev: PointerEvent): void => {
      if (!moved && !passedDragThreshold(ev.clientX - startX, ev.clientY - startY)) return
      if (!moved) {
        moved = true
        setDragging(subject)
        document.getSelection()?.removeAllRanges()
      }
      const next = targetAt(ev.clientX, ev.clientY, subject)
      const hold = next?.kind === 'pair' || next?.kind === 'join'
      const same = JSON.stringify(previewRef.current) === JSON.stringify(next)
      if (hold && !same) {
        window.clearTimeout(hoverTimer)
        previewRef.current = null
        setPreview(null)
        hoverTimer = window.setTimeout(() => {
          previewRef.current = next
          setPreview(next)
        }, 200)
        return
      }
      if (!hold) {
        window.clearTimeout(hoverTimer)
        previewRef.current = next
        setPreview(next)
      }
    }
    const up = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.clearTimeout(hoverTimer)
      setDragging(null)
      const landed = previewRef.current
      setPreview(null)
      if (!moved) {
        if (subject.kind === 'task') setEditing(subject.id)
        return
      }
      if (landed?.kind === 'pair' || landed?.kind === 'join') actions.applyDrop(subject, landed)
      else {
        const immediate = targetAt(ev.clientX, ev.clientY, subject)
        if (immediate && immediate.kind !== 'pair' && immediate.kind !== 'join') actions.applyDrop(subject, immediate)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function openMenu(event: React.MouseEvent, subject: DragSubject): void {
    if ((event.target as HTMLElement).closest('[data-no-drag]')) return
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY, subject })
  }

  async function copyTask(task: Task): Promise<void> {
    try {
      await navigator.clipboard.writeText(copyBody(task))
      setCopied(task.id)
      window.setTimeout(() => { setCopied(current => current === task.id ? null : current) }, 1200)
    } catch (error: unknown) {
      // The clipboard can reject the write. The icon stays on the copy glyph.
      void error
    }
  }

  const menuTask = menu?.subject.kind === 'task' ? board.tasks.find(task => task.id === menu.subject.id) : undefined
  const busy = menuTask !== undefined && activityState[menuTask.id] === 'classifying'
  const viewedUnfinished = unfinishedCount(board, board.viewedDate)
  const sourceUnfinished = syncDate === '' ? 0 : unfinishedCount(board, syncDate)
  const syncReason = viewedUnfinished === 0 ? 'sync.none'
    : syncDate === '' ? 'sync.pick'
      : syncDate === board.viewedDate ? 'sync.sameDay'
        : sourceUnfinished === 0 ? 'sync.empty' : null

  function heatCopy(cell: HeatCell): { date: string; detail: string } {
    const [year, month, day] = cell.date.split('-')
    const date = t('heatmap.date', { year, month: Number(month), day: Number(day) })
    if (cell.band === 'future') return { date, detail: t('heatmap.future') }
    if (cell.band === 'none') return { date, detail: t('heatmap.none') }
    if (cell.band === 'zero') return { date, detail: t('heatmap.zero', { total: cell.total }) }
    const percent = Math.round(cell.done / cell.total * 100)
    const band = cell.band === 'low' ? 'heatmap.band.low' : cell.band === 'mid' ? 'heatmap.band.mid' : 'heatmap.band.high'
    return { date, detail: t('heatmap.rate', { band: t(band), done: cell.done, total: cell.total, percent }) }
  }

  function showTip(cell: HeatCell, node: HTMLElement): void {
    const rect = node.getBoundingClientRect()
    const copy = heatCopy(cell)
    const widthGuess = 220
    const center = rect.left + rect.width / 2
    const x = Math.min(Math.max(center, widthGuess / 2 + 8), window.innerWidth - widthGuess / 2 - 8)
    setTooltip({ ...copy, x, y: rect.top })
  }

  const origin = heatOrigin(board, today)
  const end = clampHeatEnd(heatEnd ?? weekStart(today), today, origin)
  const heatGap = heatWidth < 420 ? 3 : 5
  const heatSize = heatWidth < 420 ? 10 : 16
  const weekCount = Math.min(53, Math.max(4, Math.floor((heatWidth - 16) / (heatSize + heatGap))))
  const weeks = heatWeeks(board, today, end, weekCount)
  const atStart = end === weekStart(origin)
  const atEnd = end === weekStart(today)
  const stats = page === 'stats' ? {
    recent: rateBetween(board, addDays(today, -6), today),
    previous: rateBetween(board, addDays(today, -13), addDays(today, -7)),
    month: rateBetween(board, addDays(today, -29), today),
    activity: activity(board, today),
    tags: tagInsight(board, today),
  } : null

  return (
    <div ref={pageRef} className={`${css.page} ${narrow ? css.narrow : ''} ${dragging ? css.grabbing : ''} ${focus ? css.focusing : ''}`}>
      <div className={css.main}>
        <header className={css.header}>
          <nav className={css.switcher} aria-label={t('panel')}>
            {(['tasks', 'stats', 'settings'] as const).map(id => (
              <button key={id} type="button" className={page === id ? css.switchOn : css.switchBtn} aria-current={page === id ? 'page' : undefined}
                onClick={() => { setPage(id); setTooltip(null) }}>
                {t(`nav.${id}`)}
              </button>
            ))}
          </nav>
          {page === 'tasks' && (
            <div className={css.dateTools}>
              <button type="button" className={css.iconBtn} aria-label={t('header.previous')} onClick={() => { actions.setViewedDate(addDays(board.viewedDate, -1)) }}><Chevron dir="left" /></button>
              <span className={css.date}>{dayText(board.viewedDate, t)}</span>
              <button type="button" className={css.iconBtn} aria-label={t('header.next')} onClick={() => { actions.setViewedDate(addDays(board.viewedDate, 1)) }}><Chevron dir="right" /></button>
              <button type="button" className={css.today} onClick={() => { actions.setViewedDate(today) }}>{t('header.today')}</button>
              <button type="button" className={css.iconBtn} aria-label={t('header.sync')} onClick={() => { setSyncDate(''); setSyncOpen(true) }}><SyncMark /></button>
              <button type="button" className={`${css.iconBtn} ${css.iconDanger}`} aria-label={t('header.clear')} onClick={() => { setClearOpen(true) }}><TrashMark /></button>
            </div>
          )}
        </header>
        {page === 'tasks' && (
          <>
            <section className={css.board} style={{ height: board.listHeight }}>
              {(['must', 'optional'] as const).map((column) => {
                const rows = rowsFor(board, column, board.viewedDate, filter)
                const notice = columnNotice(board, column, board.viewedDate, filter)
                const rate = columnRate(board, board.viewedDate, column)
                return (
                  <div key={column} className={css.column}>
                    <div className={css.columnHead}>
                      <span>{t(column === 'must' ? 'column.must' : 'column.optional')}</span>
                      {column === 'must' && <Ring rate={rate} label={rate === null ? t('column.progressEmpty') : t('column.progress', { percent: percentOf(rate) })} />}
                    </div>
                    <TaskInput label={t(column === 'must' ? 'add.must' : 'add.optional')} value={drafts[column]}
                      onChange={(value) => { setDrafts(state => ({ ...state, [column]: value })) }}
                      onSubmit={(title) => { add(column, title) }} />
                    <div className={css.list} data-column-body data-column={column}>
                      {notice !== null && <p className={css.empty}>{t(notice === 'empty' ? 'empty.column' : 'empty.filtered')}</p>}
                      {rows.map((row, index) => {
                        const line = preview?.kind === 'insert' && preview.column === column && preview.index === index
                          ? <div key={`line-${column}-${index}`} className={css.insert} /> : null
                        if (row.kind === 'task') {
                          return [line, <TaskRow key={row.task.id} task={row.task} tags={board.tags}
                            date={board.viewedDate} today={today} t={t}
                            activity={activityState[row.task.id]}
                            copied={copied === row.task.id} collapsed={dragging?.id === row.task.id && (preview?.kind === 'pair' || preview?.kind === 'join')}
                            paired={preview?.kind === 'pair' && preview.taskId === row.task.id ? board.tasks.find(item => item.id === dragging?.id)?.title : undefined}
                            onPointerDown={(event) => { onRowPointerDown(event, { kind: 'task', id: row.task.id }) }}
                            onMenu={(event) => { openMenu(event, { kind: 'task', id: row.task.id }) }}
                            onToggle={() => {
                              actions.setCompleted(
                                row.task.id,
                                board.viewedDate,
                                !row.task.completedDates.includes(board.viewedDate),
                              )
                            }}
                            onFocus={() => { setFocus({ taskId: row.task.id, phase: 'pick', minutes: 25, remaining: 25 * 60_000, deadline: 0 }) }}
                            onCopy={() => { void copyTask(row.task) }} />]
                        }
                        return [line, <GroupRow
                          key={row.group.id}
                          groupId={row.group.id}
                          title={row.group.title}
                          tasks={row.tasks}
                          column={column}
                          renaming={renaming === row.group.id} draft={renameDraft} t={t} board={board} today={today}
                          activityState={activityState} copied={copied} dragging={dragging} preview={preview}
                          onRenameDraft={setRenameDraft}
                          onStartRename={() => { setRenaming(row.group.id); setRenameDraft(row.group.title) }}
                          onCommitRename={() => { actions.renameGroup(row.group.id, renameDraft); setRenaming(null) }}
                          onCancelRename={() => { setRenaming(null) }}
                          onPointerDown={onRowPointerDown} onMenu={openMenu}
                          onToggle={(id) => {
                            const task = row.tasks.find(item => item.id === id)
                            if (task === undefined) return
                            actions.setCompleted(id, board.viewedDate, !task.completedDates.includes(board.viewedDate))
                          }}
                          onFocus={(id) => { setFocus({ taskId: id, phase: 'pick', minutes: 25, remaining: 25 * 60_000, deadline: 0 }) }}
                          onCopy={(id) => {
                            const task = board.tasks.find(item => item.id === id)
                            if (task !== undefined) void copyTask(task)
                          }} />]
                      })}
                      {preview?.kind === 'insert' && preview.column === column && preview.index === rows.length && <div className={css.insert} />}
                    </div>
                  </div>
                )
              })}
              <div className={css.resize} data-resize role="separator" aria-orientation="horizontal" aria-label={t('nav.tasks')}
                onPointerDown={(event) => {
                  const startY = event.clientY
                  const start = board.listHeight
                  const move = (ev: PointerEvent): void => { actions.setListHeight(start + ev.clientY - startY, window.innerHeight || 800) }
                  const up = (): void => {
                    window.removeEventListener('pointermove', move)
                    window.removeEventListener('pointerup', up)
                  }
                  window.addEventListener('pointermove', move)
                  window.addEventListener('pointerup', up)
                }} />
            </section>
            <div className={css.tags}>
              {barTags(board, board.viewedDate).map((tag) => {
                const paint = tagPaint(tag.color)
                return (
                  <span key={tag.id} className={`${css.tag} ${paint.className} ${filter.includes(tag.id) ? css.tagOn : ''} ${tag.pinned ? css.tagPinned : ''}`}
                    style={paint.style}
                    title={tag.description || undefined}
                    onClick={() => {
                      window.clearTimeout(filterTimer.current as number)
                      filterTimer.current = window.setTimeout(() => {
                        setFilter(current => current.includes(tag.id) ? current.filter(id => id !== tag.id) : [...current, tag.id])
                      }, 220)
                    }}
                    onDoubleClick={() => {
                      window.clearTimeout(filterTimer.current as number)
                      setTagDraft({ id: tag.id, name: tag.name, description: tag.description, color: tag.color })
                    }}>
                    {tag.name}
                    <button
                      type="button"
                      className={tag.pinned ? `${css.pin} ${css.pinOn}` : css.pin}
                      data-no-drag
                      aria-label={tag.pinned ? t('pin.unpin') : t('pin.pin')}
                      aria-pressed={tag.pinned}
                      onClick={(event) => { event.stopPropagation(); actions.togglePin(tag.id) }}
                    >
                      <PinMark filled={tag.pinned} />
                    </button>
                  </span>
                )
              })}
            </div>
          </>
        )}
        {page === 'stats' && stats !== null && (
          <>
            <section className={css.card}>
              <h2>{t('activity.title')}</h2>
              <div className={css.activity}>
                {([['activity.active', stats.activity.activeDays], ['activity.current', stats.activity.current], ['activity.longest', stats.activity.longest]] as const).map(([key, value]) => (
                  <p key={key}><strong>{value}</strong><span>{t('activity.unit')}</span><small>{t(key)}</small></p>
                ))}
              </div>
              <div ref={heatRef} className={css.heat} style={{ ['--heat-gap' as string]: `${heatGap}px`, ['--heat-size' as string]: `${heatSize}px` }}>
                <div className={css.heatWeekdays}>
                  {SHORT_WEEKDAYS.map(key => <span key={key}>{t(key)}</span>)}
                </div>
                <div className={css.heatGrid}>
                  {weeks.map(week => (
                    <div key={week.days[0]?.date} className={css.heatWeek}>
                      {week.days.map((cell) => {
                        const copy = heatCopy(cell)
                        return (
                          <div key={cell.date} role="gridcell" tabIndex={0} data-band={cell.band} data-heat-cell data-col={cell.date}
                            className={css.cell} aria-label={`${copy.date} ${copy.detail}`}
                            onMouseEnter={(event) => { showTip(cell, event.currentTarget) }}
                            onMouseLeave={() => { setTooltip(null) }}
                            onClick={(event) => { showTip(cell, event.currentTarget) }}
                            onFocus={(event) => { showTip(cell, event.currentTarget) }}
                            onBlur={() => { setTooltip(null) }} />
                        )
                      })}
                      <span className={css.month}>{week.month === null ? '' : t('heatmap.month', { month: week.month })}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={css.legend}>
                {(['none', 'zero', 'low', 'mid', 'high'] as const).map(band => (
                  <span key={band}><i data-band={band} />{t(`heatmap.legend.${band}`)}</span>
                ))}
              </div>
              <div className={css.heatNav}>
                <button type="button" className={css.heatBtn} aria-label={t('heatmap.earlier')} disabled={atStart} onClick={() => { setTooltip(null); setHeatEnd(clampHeatEnd(addDays(end, -7 * weekCount), today, origin)) }}><Chevron dir="left" /></button>
                <button type="button" className={css.heatBtn} aria-label={t('heatmap.later')} disabled={atEnd} onClick={() => { setTooltip(null); setHeatEnd(clampHeatEnd(addDays(end, 7 * weekCount), today, origin)) }}><Chevron dir="right" /></button>
              </div>
            </section>
            <section className={css.card}>
              <h2>{t('insights.title')}</h2>
              <div className={css.insights}>
                <Insight number={stats.recent.rate === null ? t('dash') : t('insight.rate.percent', { percent: percentOf(stats.recent.rate) })}
                  module={t('insight.rate.module')} caption={stats.recent.rate === null ? '' : t('insight.rate.caption')}
                  body={stats.recent.total === 0 ? t('insight.rate.none') : t('insight.rate.body', {
                    done: stats.recent.done,
                    previous: stats.previous.rate === null ? t('insight.rate.missing') : t('insight.rate.percent', { percent: percentOf(stats.previous.rate) }),
                    recent: t('insight.rate.percent', { percent: percentOf(stats.month.rate) }),
                  })} />
                <Insight number={String(stats.activity.current)} module={t('insight.streak.module')} caption={t('insight.streak.caption')}
                  body={`${t('insight.streak.body', {
                    active: stats.activity.activeDays,
                    current: stats.activity.current,
                    longest: stats.activity.longest,
                  })}${stats.activity.weakest === null
                    ? ''
                    : t('insight.streak.weakest', { weekday: t(WEEKDAYS[stats.activity.weakest] ?? 'weekday.0') })}`} />
                <Insight number={stats.tags.completed === null ? t('dash') : String(stats.tags.completed)} module={t('insight.tags.module')}
                  caption={stats.tags.completed === null ? '' : t('insight.tags.caption')}
                  body={stats.tags.completed === null ? t('insight.tags.none') : `${t('insight.tags.body', { count: stats.tags.completed })}${stats.tags.stalled.length === 0 ? '' : t('insight.tags.stalled', { names: stats.tags.stalled.join('、') })}`} />
              </div>
            </section>
            {tooltip !== null && (
              <div className={css.tip} style={{ left: tooltip.x, top: tooltip.y }} role="tooltip">
                <strong>{tooltip.date}</strong>
                <span>{tooltip.detail}</span>
              </div>
            )}
          </>
        )}
        {page === 'settings' && (
          <div className={css.settings}>
            <nav className={css.settingsNav} aria-label={t('nav.settings')}>
              <Button icon={<IconDatabaseOutlineRegular />} className={css.settingsTab}
                aria-current={settingsPage === 'model' ? 'page' : undefined} onClick={() => { setSettingsPage('model') }}>{t('settings.model')}</Button>
              <Button icon={<IconChecklistOutlineRegular />} className={css.settingsTab}
                aria-current={settingsPage === 'tags' ? 'page' : undefined} onClick={() => { setSettingsPage('tags') }}>{t('tags.settings')}</Button>
            </nav>
            <div hidden={settingsPage !== 'model'}><ModelSettings model={model} t={t} /></div>
            {settingsPage === 'tags' && (
              <section className={css.settingsContent}>
                <div className={css.sectionHeader}>
                  <h2>{t('tags.settings')}</h2>
                  <Button variant="outline" size="sm" onClick={() => { setTagDraft({ name: '', description: '', color: 'blue' }) }}>{t('tags.add')}</Button>
                </div>
                {board.tags.length === 0 ? <p>{t('tags.empty')}</p> : (
                  <ul className={css.settingsList}>
                    {board.tags.map((tag) => {
                      const paint = tagPaint(tag.color)
                      return (
                        <li key={tag.id} className={css.settingsCard}>
                          <div className={css.sectionHeader}>
                            <div className={css.tagDetails}>
                              <h3><i aria-hidden="true" className={`${css.dot} ${paint.className}`} style={paint.style} />{tag.name}</h3>
                              {tag.description && <p>{tag.description}</p>}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => { setTagDraft(tag) }}>{t('menu.edit')}</Button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
      </div>
      {dialogTask !== undefined && (
        <Modal open title={t('edit.title')} closeLabel={t('edit.close')} onClose={() => { setEditing(null) }}
          footer={<>
            <Button className={css.danger} onClick={() => { actions.deleteTask(dialogTask.id); setEditing(null) }}>{t('edit.delete')}</Button>
            <Button variant="primary" onClick={() => { setEditing(null) }}>{t('edit.close')}</Button>
          </>}>
          <label className={css.fieldLabel}>{t('edit.name')}
            <Input key={dialogTask.id} defaultValue={dialogTask.title} onBlur={(event) => {
              const title = event.target.value.trim() || dialogTask.title
              actions.updateTask(dialogTask.id, { title })
              event.target.value = title
            }} />
          </label>
          <div className={css.dialogFields}>
            <label className={css.fieldLabel}>{t('edit.start')}<Input type="date" value={dialogTask.start} onChange={(event) => { actions.updateTask(dialogTask.id, { start: event.target.value }) }} /></label>
            <div className={css.dueField}>
              <label className={css.fieldLabel}>{t('edit.due')}<Input type="date" value={dialogTask.due ?? ''} onChange={(event) => { actions.updateTask(dialogTask.id, { due: event.target.value || null }) }} /></label>
              {dialogTask.due !== null && <Button size="sm" onClick={() => { actions.updateTask(dialogTask.id, { due: null }) }}>{t('edit.clearDue')}</Button>}
            </div>
            <label className={css.fieldLabel}>{t('edit.time')}<Input type="time" value={dialogTask.time ?? ''} onChange={(event) => { actions.updateTask(dialogTask.id, { time: event.target.value }) }} /></label>
            <label className={css.fieldLabel}>{t('edit.recurrence')}
              <select className={css.field} value={dialogTask.recurrence} onChange={(event) => {
                const recurrence = event.target.value
                if (recurrence === 'none' || recurrence === 'daily' || recurrence === 'weekday') actions.updateTask(dialogTask.id, { recurrence })
              }}>
                <option value="none">{t('edit.recurrenceNone')}</option>
                <option value="daily">{t('edit.recurrenceDaily')}</option>
                <option value="weekday">{t('edit.recurrenceWeekday')}</option>
              </select>
            </label>
          </div>
          <section className={css.dialogSection}>
            <h3>{t('tags.settings')}</h3>
            <div className={css.tagPick}>
              {board.tags.length === 0 && <p>{t('edit.tagsEmpty')}</p>}
              {board.tags.map((tag) => {
                const paint = tagPaint(tag.color)
                const on = dialogTask.tagIds.includes(tag.id)
                return (
                  <button key={tag.id} type="button" className={`${on ? css.tagOn : css.tag} ${paint.className}`} style={paint.style} aria-pressed={on}
                    onClick={() => { actions.toggleTaskTag(dialogTask.id, tag.id) }}>{tag.name}</button>
                )
              })}
            </div>
          </section>
          <section className={css.dialogSection}>
            <h3>{t('edit.notes')}</h3>
            {dialogTask.notes.length === 0 && <p>{t('edit.notesEmpty')}</p>}
            {dialogTask.notes.map((note) => {
              const long = note.text.split('\n').length > 3 || note.text.length > 140
              const open = expanded[note.id] === true
              return (
                <article key={note.id} className={open ? css.noteOpen : css.note}>
                  {noteEdit?.noteId === note.id ? (
                    <textarea className={css.field} aria-label={t('edit.notes')} value={noteEdit.draft} onChange={(event) => { setNoteEdit({ ...noteEdit, draft: event.target.value }) }}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setNoteEdit(null)
                        else submitEnter(event, () => { actions.updateNote(dialogTask.id, note.id, noteEdit.draft); setNoteEdit(null) })
                      }} />
                  ) : (
                    <button type="button" className={css.noteText} onClick={() => { setNoteEdit({ taskId: dialogTask.id, noteId: note.id, draft: note.text }) }}>{note.text}</button>
                  )}
                  {long && <Button size="sm" onClick={() => { setExpanded(state => ({ ...state, [note.id]: !open })) }}>{t(open ? 'note.collapse' : 'note.expand')}</Button>}
                  <Button size="sm" className={css.danger} onClick={() => { actions.deleteNote(dialogTask.id, note.id) }}>{t('note.delete')}</Button>
                </article>
              )
            })}
            <textarea className={css.field} aria-label={t('note.placeholder')} placeholder={t('note.placeholder')} value={noteEdit?.noteId === null ? noteEdit.draft : ''}
              onChange={(event) => { setNoteEdit({ taskId: dialogTask.id, noteId: null, draft: event.target.value }) }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setNoteEdit(null)
                else submitEnter(event, () => {
                  if (noteEdit?.noteId === null) {
                    actions.addNote(dialogTask.id, noteEdit.draft)
                    setNoteEdit(null)
                  }
                })
              }} />
          </section>
        </Modal>
      )}
      {syncOpen && (
        <Modal open title={t('sync.title')} closeLabel={t('edit.close')} description={t('sync.body')} onClose={() => { setSyncOpen(false) }}
          className={css.syncDialog ?? ''} contentClassName={css.syncContent ?? ''}
          footer={<>
            <Button variant="outline" onClick={() => { setSyncOpen(false) }}>{t('edit.cancel')}</Button>
            <Button variant="primary" disabled={syncReason !== null} onClick={() => { actions.syncDay(syncDate, board.viewedDate); setSyncOpen(false) }}>{t('sync.confirm')}</Button>
          </>}>
          <label className={css.fieldLabel}>{t('sync.source')}<Input type="date" value={syncDate} onChange={(event) => { setSyncDate(event.target.value) }} /></label>
          <ul className={css.settingsList}>
            {unfinishedDays(board, board.viewedDate, today).map(day => (
              <li key={day.date}>
                <Button variant="outline" className={css.syncRow} aria-pressed={syncDate === day.date} onClick={() => { setSyncDate(day.date) }}>
                  <span>{dayText(day.date, t)}</span><span>{t('sync.count', { count: day.count })}</span>
                </Button>
              </li>
            ))}
          </ul>
          <p className={css.muted} role="status">{syncReason === null ? t('sync.preview', { source: dayText(syncDate, t), target: dayText(board.viewedDate, t) }) : t(syncReason)}</p>
        </Modal>
      )}
      {clearOpen && (
        <Modal open title={t('header.clear')} closeLabel={t('edit.close')} description={t('clear.prompt')} onClose={() => { setClearOpen(false) }}
          footer={<button type="button" className={css.danger} onClick={() => { actions.clearDay(board.viewedDate); setClearOpen(false) }}>{t('clear.confirm')}</button>} />
      )}
      {tagDraft !== null && <EditTag initial={tagDraft} board={board} t={t} actions={actions} model={model}
        onClose={() => { setTagDraft(null) }} onDelete={(id) => { setFilter(current => current.filter(value => value !== id)) }} />}
      {menu !== null && (
        <Menu open portal contextual anchor={null} anchorPoint={{ x: menu.x, y: menu.y }} submenuBackLabel={t('edit.close')} onClose={() => { setMenu(null) }}
          items={menu.subject.kind === 'group'
            ? [{ id: 'dissolve', label: t('menu.dissolve') }]
            : [
              { id: 'edit', label: t('menu.edit') },
              { id: 'classify', label: t('menu.classify'), disabled: menuTask === undefined || busy },
            ]}
          onSelect={(id) => {
            const subject = menu.subject
            setMenu(null)
            if (subject.kind === 'group') actions.dissolveGroup(subject.id)
            else if (id === 'edit') setEditing(subject.id)
            else if (menuTask !== undefined) void classify(menuTask, board)
          }} />
      )}
      {focus !== null && (
        <FocusLayer t={t} title={board.tasks.find(task => task.id === focus.taskId)?.title ?? ''} phase={focus.phase} minutes={focus.minutes} remaining={focus.remaining}
          onMinutes={(minutes) => { setFocus({ ...focus, minutes, remaining: minutes * 60_000 }) }}
          onStart={() => { const deadline = now() + focus.minutes * 60_000; setFocus({ ...focus, phase: 'running', deadline, remaining: focus.minutes * 60_000 }) }}
          onAbandon={() => { setFocus(null) }}
          onDone={() => { actions.setCompleted(focus.taskId, today, true); setFocus(null) }} />
      )}
    </div>
  )
}

function Ring({ rate, label }: { rate: number | null; label: string }) {
  const length = 2 * Math.PI * 6
  const offset = rate === null ? length : length * (1 - rate)
  return (
    <svg className={css.ring} viewBox="0 0 16 16" role="img" aria-label={label} style={{ ['--offset' as string]: String(offset), ['--length' as string]: String(length) }}>
      <circle cx="8" cy="8" r="6" className={css.ringTrack} />
      <circle cx="8" cy="8" r="6" className={css.ringValue} />
    </svg>
  )
}

function GroupRow(props: {
  groupId: string
  title: string
  tasks: Task[]
  column: Column
  renaming: boolean
  draft: string
  t: Translate
  board: Board
  today: string
  activityState: Record<string, ActivityState>
  copied: string | null
  dragging: DragSubject | null
  preview: DropTarget | null
  onRenameDraft: (value: string) => void
  onStartRename: () => void
  onCommitRename: () => void
  onCancelRename: () => void
  onPointerDown: (event: ReactPointerEvent, subject: DragSubject) => void
  onMenu: (event: React.MouseEvent, subject: DragSubject) => void
  onToggle: (id: string) => void
  onFocus: (id: string) => void
  onCopy: (id: string) => void
}) {
  const joining = props.preview?.kind === 'join' && props.preview.groupId === props.groupId
  return (
    <div className={css.group} data-row data-kind="group" data-id={props.groupId} data-column={props.column}
      onPointerDown={(event) => { props.onPointerDown(event, { kind: 'group', id: props.groupId }) }}
      onContextMenu={(event) => { props.onMenu(event, { kind: 'group', id: props.groupId }) }}>
      {props.renaming ? (
        <input data-no-drag value={props.draft} aria-label={props.t('group.untitled')}
          onChange={(event) => { props.onRenameDraft(event.target.value) }}
          onBlur={props.onCommitRename}
          onKeyDown={(event) => {
            if (event.key === 'Escape') props.onCancelRename()
            else submitEnter(event, props.onCommitRename)
          }} />
      ) : (
        <strong onDoubleClick={props.onStartRename}>{props.title.trim() === '' ? props.t('group.untitled') : props.title}</strong>
      )}
      {props.tasks.map(task => (
        <TaskRow key={task.id} task={task} tags={props.board.tags} date={props.board.viewedDate} today={props.today} t={props.t} child
          activity={props.activityState[task.id]} copied={props.copied === task.id}
          collapsed={props.dragging?.id === task.id && (props.preview?.kind === 'pair' || props.preview?.kind === 'join')}
          paired={undefined}
          onPointerDown={(event) => { event.stopPropagation(); props.onPointerDown(event, { kind: 'task', id: task.id }) }}
          onMenu={(event) => { event.stopPropagation(); props.onMenu(event, { kind: 'task', id: task.id }) }}
          onToggle={() => { props.onToggle(task.id) }}
          onFocus={() => { props.onFocus(task.id) }}
          onCopy={() => { props.onCopy(task.id) }} />
      ))}
      {joining && <div className={css.pairBox} />}
    </div>
  )
}

function Insight({ number, module, caption, body }: { number: string; module: string; caption: string; body: string }) {
  return (
    <article className={css.insight}>
      <strong>{number}</strong>
      <p className={css.caption}>{caption === '' ? module : `${module} · ${caption}`}</p>
      <p>{body}</p>
    </article>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return <Glyph>{dir === 'left' ? <path d="M15 6 9 12l6 6" /> : <path d="M9 6l6 6-6 6" />}</Glyph>
}

function SyncMark() {
  return (
    <Glyph>
      <path d="M20 12a8 8 0 0 0-14.2-5" />
      <path d="M4 4v5h5" />
      <path d="M4 12a8 8 0 0 0 14.2 5" />
      <path d="M20 20v-5h-5" />
    </Glyph>
  )
}

function TrashMark() {
  return (
    <Glyph>
      <path d="M5 7h14" />
      <path d="M9 7V5h6v2" />
      <path d="M8 7l1 12h6l1-12" />
    </Glyph>
  )
}

function PinMark({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8l-1 6 3 3H6l3-3z" fill={filled ? 'currentColor' : 'none'} />
      <path d="M12 13v7" />
    </svg>
  )
}

function FocusLayer(props: {
  t: Translate
  title: string
  phase: 'pick' | 'running' | 'done'
  minutes: number
  remaining: number
  onMinutes: (minutes: number) => void
  onStart: () => void
  onAbandon: () => void
  onDone: () => void
}) {
  const total = props.phase === 'pick' ? props.minutes * 60_000 : Math.max(props.minutes * 60_000, 1)
  const shown = props.phase === 'pick' ? props.minutes * 60_000 : props.remaining
  const ratio = Math.max(0, Math.min(1, shown / total))
  const angle = (props.minutes / 60) * Math.PI * 2 - Math.PI / 2
  return (
    <div className={css.focus}>
      <div className={css.dial} data-dial>
        <svg viewBox="0 0 280 280" className={css.dialSvg}>
          <circle cx="140" cy="140" r="120" className={css.ringTrack} />
          <circle cx="140" cy="140" r="120" className={css.focusValue} style={{ ['--ratio' as string]: String(ratio) }} />
        </svg>
        <p>{props.phase === 'pick' ? props.t('focus.pick') : props.t('focus.active')}</p>
        <strong>{clock(shown)}</strong>
        {props.phase === 'pick' && (
          <button type="button" className={css.handle} aria-label={props.t('focus.dial')}
            style={{ left: 140 + Math.cos(angle) * 120, top: 140 + Math.sin(angle) * 120 }}
            onPointerDown={(event) => {
              const dial = (event.currentTarget.parentElement as HTMLElement)
              const move = (ev: PointerEvent): void => {
                const rect = dial.getBoundingClientRect()
                const turn = Math.atan2(ev.clientY - (rect.top + rect.height / 2), ev.clientX - (rect.left + rect.width / 2))
                const fraction = ((turn + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)
                const minutes = Math.round(fraction * 60)
                props.onMinutes(Math.min(60, Math.max(1, minutes === 0 ? 60 : minutes)))
              }
              const up = (): void => {
                window.removeEventListener('pointermove', move)
                window.removeEventListener('pointerup', up)
              }
              window.addEventListener('pointermove', move)
              window.addEventListener('pointerup', up)
            }} />
        )}
      </div>
      <p className={css.focusTitle}>{props.title}</p>
      {props.phase === 'pick'
        ? <button type="button" className={css.primary} onClick={props.onStart}>{props.t('focus.start')}</button>
        : <button type="button" className={css.primary} onClick={props.onDone}>{props.t('focus.done')}</button>}
      <button type="button" className={css.abandon} onClick={props.onAbandon}>{props.t('focus.abandon')}</button>
    </div>
  )
}
