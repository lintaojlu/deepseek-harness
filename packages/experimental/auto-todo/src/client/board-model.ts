/**
 * Task board records and the edits the tasks page commits.
 * A task is visible on a date when that date is inside its range and matches
 * its repeat rule, or when the date was pulled in by sync. Completion is
 * stored per date. Groups are a single level of rows in one column.
 */

/** Must-do or optional column. */
export type Column = 'must' | 'optional'

/** Repeat rule stored on a task. */
export type Recurrence = 'none' | 'daily' | 'weekday'

/** Named swatch. Imported boards may store a hex color instead. */
export type TagColor = 'white' | 'orange' | 'amber' | 'green' | 'cyan' | 'blue' | 'violet' | 'pink' | 'red'

/** One label chip. */
export interface Tag {
  /** Stable id. */
  id: string
  /** Chip text. */
  name: string
  /** Named swatch, or a `#rrggbb` fill copied from another board. */
  color: string
  /** Tooltip text. Empty when the tag has no description. */
  description: string
  /** Kept on the bar even on days that have no task using it. */
  pinned: boolean
}

/** One note card on a task. */
export interface Note {
  /** Stable id. */
  id: string
  /** Note body. The first line may be the human or AI marker. */
  text: string
}

/** One task, possibly visible on many dates. */
export interface Task {
  /** Stable id. */
  id: string
  /** Row title. */
  title: string
  /** Column that holds the row. */
  column: Column
  /** First date the range covers, `YYYY-MM-DD`. */
  start: string
  /** Last date the range covers. Null keeps a non-repeating task on `start` only. */
  due: string | null
  /** Clock time `HH:mm`, or null when the task has no time. */
  time: string | null
  /** How the range repeats. */
  recurrence: Recurrence
  /** Tags attached to the task. */
  tagIds: string[]
  /** Note cards, in display order. */
  notes: Note[]
  /** Dates on which the task is checked. */
  completedDates: string[]
  /** Dates removed from an otherwise visible span. */
  skippedDates: string[]
  /** Dates added by sync that the range itself does not cover. */
  extraDates: string[]
  /** Position among siblings. */
  order: number
  /** Owning group, or null when the task is a top-level row. */
  groupId: string | null
  /** Epoch milliseconds when the task was added. */
  createdAt: number
}

/** A single-level group of tasks in one column. */
export interface Group {
  /** Stable id. */
  id: string
  /** Group title. Empty until the user names it. */
  title: string
  /** Column that holds the frame. */
  column: Column
  /** Position among top-level rows in the column. */
  order: number
}

/** A task moved off the board onto the inspiration list. */
export interface Inspiration {
  /** Stable id. */
  id: string
  /** Original task title. */
  title: string
  /** Note text captured at the move. */
  body: string
  /** Normal items stay on the list. Archived items stay out of the active list. */
  status: 'normal' | 'archived'
  /** Epoch milliseconds when the task was moved. */
  movedAt: number
}

/** Persisted board. */
export interface Board {
  /** Schema generation. Any other value is discarded. */
  version: 1
  /** Id counter. */
  seq: number
  /** Date the tasks page is showing. */
  viewedDate: string
  /** Saved column-list height in pixels. */
  listHeight: number
  /** Tasks. */
  tasks: Task[]
  /** Groups. */
  groups: Group[]
  /** Tags. */
  tags: Tag[]
  /** Inspiration items. */
  inspiration: Inspiration[]
}

/** Row dragged across the board. */
export interface DragSubject {
  /** Task row or whole group frame. */
  kind: 'task' | 'group'
  /** Row id. */
  id: string
}

/** Where a drag may land. Indexes exclude the dragged row. */
export type DropTarget =
  | { kind: 'insert'; column: Column; index: number }
  | { kind: 'append'; column: Column }
  | { kind: 'child'; groupId: string; index: number }
  | { kind: 'pair'; taskId: string }
  | { kind: 'join'; groupId: string }

/** One top-level row after filtering. */
export type BoardRow =
  | { kind: 'task'; task: Task }
  | { kind: 'group'; group: Group; tasks: Task[] }

/** Fields the editor writes through. */
export interface TaskPatch {
  /** Replacement title. */
  title?: string
  /** Replacement start date. */
  start?: string
  /** Replacement due date, or null to clear it. */
  due?: string | null
  /** Replacement clock time, or null to clear it. */
  time?: string | null
  /** Replacement repeat rule. */
  recurrence?: Recurrence
}

/** First line that marks a human task and shows the focus clock. */
export const HUMAN_NOTE = '人类任务'

/** First line that marks an AI task and shows copy. */
export const AI_NOTE = 'AI任务'

/** Swatches whose chips use dark text. */
export const DARK_INK: readonly TagColor[] = ['white', 'orange', 'amber', 'green', 'cyan']

const DAY_MS = 86_400_000

/**
 * Build an empty board viewing `viewedDate`.
 * @param viewedDate - date the page opens on.
 * @returns an empty version-1 board.
 */
export function emptyBoard(viewedDate: string): Board {
  return {
    version: 1,
    seq: 0,
    viewedDate,
    listHeight: 360,
    tasks: [],
    groups: [],
    tags: [],
    inspiration: [],
  }
}

/**
 * Report whether a value is a version-1 board.
 * @param value - persisted or in-memory value.
 * @returns true when the board arrays and version are present.
 */
export function isBoard(value: Partial<Board> | null | undefined): value is Board {
  return value?.version === 1
    && typeof value.viewedDate === 'string'
    && typeof value.seq === 'number'
    && typeof value.listHeight === 'number'
    && Array.isArray(value.tasks)
    && Array.isArray(value.groups)
    && Array.isArray(value.tags)
    && Array.isArray(value.inspiration)
}

/**
 * Format a local calendar date.
 * @param time - epoch milliseconds.
 * @returns `YYYY-MM-DD` in the local timezone.
 */
export function isoDate(time: number): string {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Shift a calendar date by whole days.
 * @param iso - `YYYY-MM-DD`.
 * @param days - day delta. Negative moves earlier.
 * @returns the shifted date.
 */
export function addDays(iso: string, days: number): string {
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = iso.split('-').map(Number)
  return isoDate(new Date(year, month - 1, day + days).getTime())
}

/**
 * Weekday index for a calendar date.
 * @param iso - `YYYY-MM-DD`.
 * @returns `0` for Sunday through `6` for Saturday.
 */
export function weekdayIndex(iso: string): number {
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}

/**
 * Report whether a date falls on Saturday or Sunday.
 * @param iso - `YYYY-MM-DD`.
 * @returns true on a weekend.
 */
export function isWeekend(iso: string): boolean {
  const weekday = weekdayIndex(iso)
  return weekday === 0 || weekday === 6
}

/**
 * Sunday that begins the week containing `iso`.
 * @param iso - `YYYY-MM-DD`.
 * @returns that Sunday.
 */
export function weekStart(iso: string): string {
  return addDays(iso, -weekdayIndex(iso))
}

/**
 * Report whether movement from the pointer-down point counts as a drag.
 * @param dx - horizontal pixels.
 * @param dy - vertical pixels.
 * @returns true once the pointer has moved more than 6px.
 */
export function passedDragThreshold(dx: number, dy: number): boolean {
  return dx * dx + dy * dy > 36
}

/**
 * Classify a pointer position inside a row.
 * @param offset - pixels from the row's top.
 * @param size - row height in pixels.
 * @returns the edge band, or the middle band that can form a group.
 */
export function pointerBand(offset: number, size: number): 'before' | 'after' | 'middle' {
  if (size <= 0) return 'middle'
  const ratio = offset / size
  if (ratio < 0.28) return 'before'
  if (ratio > 0.72) return 'after'
  return 'middle'
}

/**
 * Insertion index among rows that will remain after the dragged row leaves.
 * @param ids - current row ids, dragged row included.
 * @param draggedId - row being moved.
 * @param targetId - row whose edge is the target.
 * @param edge - which edge of the target receives the row.
 * @returns an index in the list that no longer contains `draggedId`.
 */
export function edgeIndex(ids: readonly string[], draggedId: string, targetId: string, edge: 'before' | 'after'): number {
  const rest = ids.filter(id => id !== draggedId)
  const at = rest.indexOf(targetId)
  if (at < 0) return rest.length
  return edge === 'before' ? at : at + 1
}

/**
 * Clamp the task-list height to the viewport budget.
 * @param height - proposed height in pixels.
 * @param viewport - window height in pixels.
 * @returns a height between 80px and about 70% of the window.
 */
export function clampListHeight(height: number, viewport: number): number {
  const max = Math.max(80, Math.floor(viewport * 0.7))
  return Math.max(80, Math.min(max, Math.round(height)))
}

function mint(board: Board, prefix: string): string {
  board.seq += 1
  return `${prefix}${board.seq}`
}

function recurrenceAllows(recurrence: Recurrence, iso: string): boolean {
  return recurrence !== 'weekday' || !isWeekend(iso)
}

/**
 * Report whether a task is shown on a date.
 * @param task - task record.
 * @param iso - `YYYY-MM-DD`.
 * @returns true when that date still shows the task.
 */
export function visibleOn(task: Task, iso: string): boolean {
  if (task.skippedDates.includes(iso)) return false
  if (task.extraDates.includes(iso)) return true
  if (iso < task.start) return false
  if (task.due !== null && iso > task.due) return false
  if (task.due === null && task.recurrence === 'none' && iso !== task.start) return false
  return recurrenceAllows(task.recurrence, iso)
}

/**
 * Report whether deleting the date would remove the task entirely.
 * @param task - task record.
 * @param iso - date being cleared.
 * @returns true when no other date still shows the task.
 */
export function livesOnlyOn(task: Task, iso: string): boolean {
  if (!visibleOn(task, iso)) return false
  const extras = task.extraDates.filter(date => date !== iso)
  const start = extras.reduce((min, date) => date < min ? date : min, task.start)
  const due = task.due ?? task.start
  const end = extras.reduce((max, date) => date > max ? date : max, due)
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    if (cursor !== iso && visibleOn(task, cursor)) return false
  }
  if (task.due === null && task.recurrence !== 'none') {
    for (let step = 1; step <= 14; step += 1) {
      const cursor = addDays(iso, step)
      if (visibleOn(task, cursor)) return false
    }
  }
  return true
}

function includeOnDay(task: Task, iso: string): void {
  task.skippedDates = task.skippedDates.filter(date => date !== iso)
  task.extraDates = [...new Set([...task.extraDates, iso])]
}

function excludeOnDay(task: Task, iso: string): void {
  task.extraDates = task.extraDates.filter(date => date !== iso)
  task.skippedDates = [...new Set([...task.skippedDates, iso])]
}

type TopRef = {
  kind: 'task'
  order: number
  task: Task
} | {
  kind: 'group'
  order: number
  group: Group
}

function topLevel(board: Board, column: Column): TopRef[] {
  const tasks: TopRef[] = board.tasks
    .filter(task => task.column === column && task.groupId === null)
    .map(task => ({ kind: 'task', order: task.order, task }))
  const groups: TopRef[] = board.groups
    .filter(group => group.column === column)
    .map(group => ({ kind: 'group', order: group.order, group }))
  return [...tasks, ...groups].sort((left, right) => left.order - right.order || (left.kind === 'group' ? 1 : -1))
}

function assign(rows: TopRef[]): void {
  rows.forEach((row, index) => {
    if (row.kind === 'task') row.task.order = index
    else row.group.order = index
  })
}

function reindex(board: Board, column: Column): void {
  assign(topLevel(board, column))
}

function childrenOf(board: Board, groupId: string): Task[] {
  return board.tasks.filter(task => task.groupId === groupId).sort((left, right) => left.order - right.order)
}

function unwrap(board: Board): void {
  for (const group of [...board.groups]) {
    const members = childrenOf(board, group.id)
    if (members.length > 1) continue
    const only = members[0]
    if (only !== undefined) {
      only.groupId = null
      only.column = group.column
      only.order = group.order
    }
    board.groups = board.groups.filter(item => item.id !== group.id)
  }
}

function detach(task: Task): { column: Column; groupId: string | null } {
  const previous = { column: task.column, groupId: task.groupId }
  task.groupId = null
  return previous
}

/**
 * Add a task at the end of a column.
 * @param board - board draft.
 * @param column - destination column.
 * @param title - raw title. Blank titles are ignored.
 * @param date - start date.
 * @param tagIds - tags to copy onto the task.
 * @param now - creation time in epoch milliseconds.
 * @returns the new id, or null when the title is blank.
 */
export function addTask(
  board: Board, column: Column, title: string, date: string, tagIds: readonly string[], now: number,
): string | null {
  const cleaned = title.trim()
  if (cleaned === '') return null
  const id = mint(board, 't')
  board.tasks.push({
    id,
    title: cleaned,
    column,
    start: date,
    due: null,
    time: null,
    recurrence: 'none',
    tagIds: [...tagIds],
    notes: [],
    completedDates: [],
    skippedDates: [],
    extraDates: [],
    order: topLevel(board, column).length,
    groupId: null,
    createdAt: now,
  })
  reindex(board, column)
  return id
}

/**
 * Check or uncheck a task on one date.
 * @param board - board draft.
 * @param id - task id.
 * @param date - date being toggled.
 * @param done - checked state to store.
 * @returns nothing.
 */
export function setCompleted(board: Board, id: string, date: string, done: boolean): void {
  const task = board.tasks.find(item => item.id === id)
  if (task === undefined || !visibleOn(task, date)) return
  const has = task.completedDates.includes(date)
  if (done && !has) task.completedDates.push(date)
  if (!done && has) task.completedDates = task.completedDates.filter(item => item !== date)
}

/**
 * Write editor fields that keep the start on or before the due date.
 * @param board - board draft.
 * @param id - task id.
 * @param patch - fields to write. Invalid date pairs are left unchanged.
 * @returns nothing.
 */
export function updateTask(board: Board, id: string, patch: TaskPatch): void {
  const task = board.tasks.find(item => item.id === id)
  if (task === undefined) return
  const start = patch.start ?? task.start
  const due = patch.due === undefined ? task.due : patch.due
  if (due !== null && start > due) return
  if (patch.title !== undefined) {
    const title = patch.title.trim()
    if (title !== '') task.title = title
  }
  if (patch.start !== undefined) task.start = patch.start
  if (patch.due !== undefined) task.due = patch.due
  if (patch.time !== undefined) task.time = patch.time === '' ? null : patch.time
  if (patch.recurrence !== undefined) task.recurrence = patch.recurrence
}

/**
 * Add a note card.
 * @param board - board draft.
 * @param taskId - task id.
 * @param text - note body. Blank notes are ignored.
 * @returns nothing.
 */
export function addNote(board: Board, taskId: string, text: string): void {
  const task = board.tasks.find(item => item.id === taskId)
  const body = text.trim()
  if (task === undefined || body === '') return
  task.notes.push({ id: mint(board, 'n'), text: body })
}

/**
 * Replace a note body.
 * @param board - board draft.
 * @param taskId - task id.
 * @param noteId - note id.
 * @param text - next body. Blank text deletes the note.
 * @returns nothing.
 */
export function updateNote(board: Board, taskId: string, noteId: string, text: string): void {
  const task = board.tasks.find(item => item.id === taskId)
  if (task === undefined) return
  const body = text.trim()
  if (body === '') {
    task.notes = task.notes.filter(note => note.id !== noteId)
    return
  }
  const note = task.notes.find(item => item.id === noteId)
  if (note !== undefined) note.text = body
}

/**
 * Remove a note card.
 * @param board - board draft.
 * @param taskId - task id.
 * @param noteId - note id.
 * @returns nothing.
 */
export function deleteNote(board: Board, taskId: string, noteId: string): void {
  const task = board.tasks.find(item => item.id === taskId)
  if (task === undefined) return
  task.notes = task.notes.filter(note => note.id !== noteId)
}

/**
 * Attach or detach one tag.
 * @param board - board draft.
 * @param taskId - task id.
 * @param tagId - tag id.
 * @returns nothing.
 */
export function toggleTaskTag(board: Board, taskId: string, tagId: string): void {
  const task = board.tasks.find(item => item.id === taskId)
  if (task === undefined || !board.tags.some(tag => tag.id === tagId)) return
  task.tagIds = task.tagIds.includes(tagId)
    ? task.tagIds.filter(id => id !== tagId)
    : [...task.tagIds, tagId]
}

/**
 * Create or replace a tag.
 * @param board - board draft.
 * @param tag - tag fields. `id` empty creates a tag. Blank names are ignored.
 * @returns the tag id, or null when the name is blank.
 */
export function saveTag(board: Board, tag: Omit<Tag, 'id' | 'pinned'> & { id?: string }): string | null {
  const name = tag.name.trim()
  if (name === '') return null
  const existing = tag.id === undefined ? undefined : board.tags.find(item => item.id === tag.id)
  if (existing === undefined) {
    const id = mint(board, 'g')
    board.tags.push({ id, name, color: tag.color, description: tag.description.trim(), pinned: false })
    return id
  }
  existing.name = name
  existing.color = tag.color
  existing.description = tag.description.trim()
  return existing.id
}

/**
 * Delete a tag and detach it from tasks.
 * @param board - board draft.
 * @param tagId - tag id.
 * @returns nothing.
 */
export function deleteTag(board: Board, tagId: string): void {
  board.tags = board.tags.filter(tag => tag.id !== tagId)
  for (const task of board.tasks) task.tagIds = task.tagIds.filter(id => id !== tagId)
}

/**
 * Pin or unpin a tag.
 * @param board - board draft.
 * @param tagId - tag id.
 * @returns nothing.
 */
export function togglePin(board: Board, tagId: string): void {
  const tag = board.tags.find(item => item.id === tagId)
  if (tag !== undefined) tag.pinned = !tag.pinned
}

/**
 * Remove a task and leave a one-member group as a plain row.
 * @param board - board draft.
 * @param id - task id.
 * @returns nothing.
 */
export function deleteTask(board: Board, id: string): void {
  const task = board.tasks.find(item => item.id === id)
  if (task === undefined) return
  const column = task.column
  board.tasks = board.tasks.filter(item => item.id !== id)
  unwrap(board)
  reindex(board, column)
}

/**
 * Move a task onto the inspiration list.
 * @param board - board draft.
 * @param id - task id.
 * @param now - move time in epoch milliseconds.
 * @returns nothing.
 */
export function moveToInspiration(board: Board, id: string, now: number): void {
  const task = board.tasks.find(item => item.id === id)
  if (task === undefined) return
  board.inspiration.push({
    id: mint(board, 'i'),
    title: task.title,
    body: task.notes.map(note => note.text).join('\n'),
    status: 'normal',
    movedAt: now,
  })
  deleteTask(board, id)
}

/**
 * Archive or restore an inspiration item.
 * @param board - board draft.
 * @param id - inspiration id.
 * @param status - next status.
 * @returns nothing.
 */
export function setInspirationStatus(board: Board, id: string, status: Inspiration['status']): void {
  const item = board.inspiration.find(entry => entry.id === id)
  if (item !== undefined) item.status = status
}

function placeTop(board: Board, task: Task, column: Column, index: number): void {
  const previous = detach(task)
  task.column = column
  const rows = topLevel(board, column).filter(row => row.kind !== 'task' || row.task.id !== task.id)
  const at = Math.max(0, Math.min(index, rows.length))
  rows.splice(at, 0, { kind: 'task', order: 0, task })
  assign(rows)
  if (previous.column !== column) reindex(board, previous.column)
  unwrap(board)
}

/**
 * Append existing tags to a task, preserving its existing assignments.
 * @param board - board draft.
 * @param id - task id.
 * @param tagIds - tags to add. Deleted or already assigned ids have no effect.
 * @returns nothing.
 */
export function addTaskTags(board: Board, id: string, tagIds: readonly string[]): void {
  const task = board.tasks.find(item => item.id === id)
  if (task === undefined) return
  const selected = new Set(tagIds)
  for (const tag of board.tags) {
    if (selected.has(tag.id) && !task.tagIds.includes(tag.id)) task.tagIds.push(tag.id)
  }
}

/**
 * Land unfinished tasks from one date onto another, keeping the same records.
 * @param board - board draft.
 * @param source - date the unfinished tasks are taken from.
 * @param target - date they should also appear on.
 * @returns nothing.
 */
export function syncDay(board: Board, source: string, target: string): void {
  if (source === target) return
  for (const task of board.tasks) {
    if (!visibleOn(task, source) || task.completedDates.includes(source)) continue
    includeOnDay(task, target)
  }
}

/**
 * Clear one date. Single-day tasks disappear. Spanning tasks skip that date.
 * @param board - board draft.
 * @param date - date being cleared.
 * @returns nothing.
 */
export function clearDay(board: Board, date: string): void {
  for (const task of [...board.tasks]) {
    if (!visibleOn(task, date)) continue
    if (livesOnlyOn(task, date)) deleteTask(board, task.id)
    else excludeOnDay(task, date)
  }
}

/**
 * Rename a group. A blank name is ignored.
 * @param board - board draft.
 * @param id - group id.
 * @param title - next title.
 * @returns nothing.
 */
export function renameGroup(board: Board, id: string, title: string): void {
  const group = board.groups.find(item => item.id === id)
  const next = title.trim()
  if (group === undefined || next === '') return
  group.title = next
}

/**
 * Dissolve a group and leave its tasks in order at the frame's position.
 * @param board - board draft.
 * @param id - group id.
 * @returns nothing.
 */
export function dissolveGroup(board: Board, id: string): void {
  const group = board.groups.find(item => item.id === id)
  if (group === undefined) return
  const members = childrenOf(board, group.id)
  const rows = topLevel(board, group.column).filter(row => row.kind !== 'group' || row.group.id !== group.id)
  const at = topLevel(board, group.column).findIndex(row => row.kind === 'group' && row.group.id === group.id)
  for (const task of members) {
    task.groupId = null
    task.column = group.column
  }
  const injected: TopRef[] = members.map(task => ({ kind: 'task', order: 0, task }))
  rows.splice(at, 0, ...injected)
  board.groups = board.groups.filter(item => item.id !== group.id)
  assign(rows)
}

/**
 * Move a row to a drop target.
 * @param board - board draft.
 * @param subject - dragged row.
 * @param target - drop target. Group frames only move among top-level slots.
 * @returns nothing.
 */
export function applyDrop(board: Board, subject: DragSubject, target: DropTarget): void {
  if (subject.kind === 'group') {
    if (target.kind !== 'insert' && target.kind !== 'append') return
    const group = board.groups.find(item => item.id === subject.id)
    if (group === undefined) return
    const source = group.column
    group.column = target.column
    for (const task of board.tasks) {
      if (task.groupId === group.id) task.column = target.column
    }
    const rows = topLevel(board, target.column).filter(row => row.kind !== 'group' || row.group.id !== group.id)
    const index = target.kind === 'append' ? rows.length : Math.max(0, Math.min(target.index, rows.length))
    rows.splice(index, 0, { kind: 'group', order: 0, group })
    assign(rows)
    if (source !== target.column) reindex(board, source)
    return
  }
  const task = board.tasks.find(item => item.id === subject.id)
  if (task === undefined) return
  if (target.kind === 'pair') {
    pair(board, task, target.taskId)
    return
  }
  if (target.kind === 'join') {
    join(board, task, target.groupId)
    return
  }
  if (target.kind === 'child') {
    insertChild(board, task, target.groupId, target.index)
    return
  }
  const index = target.kind === 'append' ? 10_000 : target.index
  placeTop(board, task, target.column, index)
}

function pair(board: Board, dragged: Task, targetId: string): void {
  const target = board.tasks.find(item => item.id === targetId)
  if (target === undefined || target.id === dragged.id || target.groupId !== null) return
  const source = detach(dragged)
  const column = target.column
  const group: Group = {
    id: mint(board, 'p'),
    title: '',
    column,
    order: source.groupId === null && source.column === column ? Math.min(dragged.order, target.order) : target.order,
  }
  board.groups.push(group)
  const ordered = source.groupId === null && source.column === column && dragged.order <= target.order
    ? [dragged, target]
    : [target, dragged]
  ordered.forEach((item, index) => {
    item.groupId = group.id
    item.column = column
    item.order = index
  })
  reindex(board, column)
  if (source.column !== column) reindex(board, source.column)
  unwrap(board)
}

function join(board: Board, task: Task, groupId: string): void {
  const group = board.groups.find(item => item.id === groupId)
  if (group === undefined) return
  insertChild(board, task, groupId, childrenOf(board, groupId).filter(item => item.id !== task.id).length)
}

function insertChild(board: Board, task: Task, groupId: string, index: number): void {
  const group = board.groups.find(item => item.id === groupId)
  if (group === undefined) return
  const source = detach(task)
  task.groupId = group.id
  task.column = group.column
  const siblings = childrenOf(board, group.id).filter(item => item.id !== task.id)
  const at = Math.max(0, Math.min(index, siblings.length))
  siblings.splice(at, 0, task)
  siblings.forEach((item, position) => { item.order = position })
  reindex(board, group.column)
  if (source.column !== group.column) reindex(board, source.column)
  unwrap(board)
}

/**
 * Change the date the page is showing.
 * @param board - board draft.
 * @param date - next date.
 * @returns nothing.
 */
export function setViewedDate(board: Board, date: string): void {
  board.viewedDate = date
}

/**
 * Store the list height.
 * @param board - board draft.
 * @param height - height in pixels.
 * @param viewport - window height in pixels.
 * @returns nothing.
 */
export function setListHeight(board: Board, height: number, viewport: number): void {
  board.listHeight = clampListHeight(height, viewport)
}

/**
 * Replace the board with an empty one viewing today.
 * @param board - board draft.
 * @param today - date to show.
 * @returns nothing.
 */
export function resetBoard(board: Board, today: string): void {
  const fresh = emptyBoard(today)
  board.version = fresh.version
  board.seq = fresh.seq
  board.viewedDate = fresh.viewedDate
  board.listHeight = fresh.listHeight
  board.tasks = fresh.tasks
  board.groups = fresh.groups
  board.tags = fresh.tags
  board.inspiration = fresh.inspiration
}

/**
 * Visible top-level rows for one column.
 * @param board - board.
 * @param column - column.
 * @param date - date being shown.
 * @param tagIds - tags that filter the column. An empty list shows every row.
 * @returns rows, keeping a whole group when any child matches.
 */
export function rowsFor(board: Board, column: Column, date: string, tagIds: readonly string[]): BoardRow[] {
  const matches = (task: Task): boolean => tagIds.length === 0 || task.tagIds.some(id => tagIds.includes(id))
  const rows: BoardRow[] = []
  for (const row of topLevel(board, column)) {
    if (row.kind === 'task') {
      if (visibleOn(row.task, date) && matches(row.task)) rows.push({ kind: 'task', task: row.task })
      continue
    }
    const tasks = childrenOf(board, row.group.id).filter(task => visibleOn(task, date))
    if (tasks.length === 0 || !tasks.some(matches)) continue
    rows.push({ kind: 'group', group: row.group, tasks })
  }
  return rows
}

/**
 * Empty-column copy for the current filter.
 * @param board - board.
 * @param column - column.
 * @param date - date being shown.
 * @param tagIds - active tag filter.
 * @returns `empty` when the column has no tasks that day, `filtered` when the filter hides them, or null.
 */
export function columnNotice(board: Board, column: Column, date: string, tagIds: readonly string[]): 'empty' | 'filtered' | null {
  if (rowsFor(board, column, date, tagIds).length > 0) return null
  return rowsFor(board, column, date, []).length === 0 ? 'empty' : 'filtered'
}

/**
 * Tags that occupy the bar on a date.
 * @param board - board.
 * @param date - date being shown.
 * @returns pinned tags and tags used by a visible task, in list order.
 */
export function barTags(board: Board, date: string): Tag[] {
  const used = new Set<string>()
  for (const task of board.tasks) {
    if (!visibleOn(task, date)) continue
    for (const id of task.tagIds) used.add(id)
  }
  return board.tags.filter(tag => tag.pinned || used.has(tag.id))
}

/**
 * Count unfinished tasks visible on a date.
 * @param board - board.
 * @param date - date.
 * @returns the unfinished count.
 */
export function unfinishedCount(board: Board, date: string): number {
  return board.tasks.filter(task => visibleOn(task, date) && !task.completedDates.includes(date)).length
}

/**
 * Dates other than the one being viewed that still have unfinished tasks.
 * @param board - board.
 * @param viewed - date being viewed.
 * @param today - today's date, used as the far end when no due date is later.
 * @returns dates and their unfinished counts, earliest first.
 */
export function unfinishedDays(board: Board, viewed: string, today: string): Array<{ date: string; count: number }> {
  const first = earliestDate(board)
  if (first === null) return []
  let last = today
  for (const task of board.tasks) if (task.due !== null && task.due > last) last = task.due
  const days: Array<{ date: string; count: number }> = []
  for (let date = first; date <= last; date = addDays(date, 1)) {
    if (date === viewed) continue
    const count = unfinishedCount(board, date)
    if (count > 0) days.push({ date, count })
  }
  return days
}

function earliestDate(board: Board): string | null {
  let first: string | null = null
  for (const task of board.tasks) {
    const candidate = task.extraDates.reduce((min, date) => date < min ? date : min, task.start)
    if (first === null || candidate < first) first = candidate
  }
  return first
}

/**
 * Must-do completion for one date.
 * @param board - board.
 * @param date - date.
 * @returns checked and visible must-do counts.
 */
export function mustOn(board: Board, date: string): { done: number; total: number } {
  const tasks = board.tasks.filter(task => task.column === 'must' && visibleOn(task, date))
  return { done: tasks.filter(task => task.completedDates.includes(date)).length, total: tasks.length }
}

/**
 * Note lines in card order.
 * @param task - task.
 * @returns lines, split on newlines.
 */
export function noteLines(task: Task): string[] {
  return task.notes.flatMap(note => note.text.split('\n'))
}

/**
 * Text copied for an AI task, excluding the marker line.
 * @param task - task.
 * @returns the body under the marker, or an empty string when the marker is absent.
 */
export function copyBody(task: Task): string {
  const lines = noteLines(task)
  if (lines[0]?.trim() !== AI_NOTE) return ''
  return lines.slice(1).join('\n').trim()
}

/**
 * Report whether the focus clock is available.
 * @param task - task.
 * @param date - date being viewed.
 * @param today - today's date.
 * @returns true on an unfinished human task being viewed today.
 */
export function focusAvailable(task: Task, date: string, today: string): boolean {
  return date === today && noteLines(task)[0]?.trim() === HUMAN_NOTE && !task.completedDates.includes(date)
}

/** One slice of a title, with time phrases marked. */
export interface TextSpan {
  /** Slice text. */
  text: string
  /** Whether the slice is a recognized time phrase. */
  time: boolean
}

const TIME_PATTERN = /(?:(?:凌晨|早上|上午|中午|下午|晚上|傍晚)\s*)?\d{1,2}\s*[:：]\s*\d{2}|(?:凌晨|早上|上午|中午|下午|晚上|傍晚)\s*\d{1,2}\s*点(?:半)?|\d{1,2}\s*点半/gu

/**
 * Split a title around recognized time phrases.
 * @param title - task title.
 * @returns ordered slices covering the whole title.
 */
export function timeSpans(title: string): TextSpan[] {
  const spans: TextSpan[] = []
  let cursor = 0
  for (const match of title.matchAll(TIME_PATTERN)) {
    // `matchAll` always supplies an index for a successful match.
    /* v8 ignore next */
    if (match.index === undefined) continue
    const index = match.index
    if (index > cursor) spans.push({ text: title.slice(cursor, index), time: false })
    spans.push({ text: match[0], time: true })
    cursor = index + match[0].length
  }
  if (cursor < title.length || spans.length === 0) spans.push({ text: title.slice(cursor), time: false })
  return spans
}

/**
 * Whole days between two epoch times, truncated toward zero.
 * @param later - later epoch milliseconds.
 * @param earlier - earlier epoch milliseconds.
 * @returns the truncated day count.
 */
export function elapsedDays(later: number, earlier: number): number {
  return Math.floor((later - earlier) / DAY_MS)
}
