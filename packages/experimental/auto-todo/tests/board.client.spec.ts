/** Board records, completion stats, dictionaries, and the persisted store. */

import { describe, expect, it } from 'vitest'
import {
  AI_NOTE, HUMAN_NOTE, addDays, addNote, addTask, applyClassify, applyDrop, applyStandardize, barTags,
  classifiedColumn, clampListHeight, clearDay, columnNotice, copyBody, decomposeLines, deleteNote, deleteTag,
  deleteTask, dissolveGroup, edgeIndex, elapsedDays, emptyBoard, focusAvailable, isBoard, isoDate, livesOnlyOn,
  moveToInspiration, mustOn, noteLines, passedDragThreshold, pointerBand, renameGroup, resetBoard, rowsFor,
  saveTag, setCompleted, setInspirationStatus, setListHeight, setViewedDate, standardizedTitle, syncDay,
  timeSpans, togglePin, toggleTaskTag, unfinishedCount, unfinishedDays, updateNote, updateTask, visibleOn,
  weekStart, weekdayIndex, type Board, type Task,
} from '../src/client/board-model.ts'
import {
  activity, clampHeatEnd, columnRate, heatBand, heatOrigin, heatWeeks, ideaInsight, percentOf, rateBetween, tagInsight,
} from '../src/client/board-stats.ts'
import { createBoardStore } from '../src/client/board-store.ts'
import { de, en, es, fr, ja, pt, ru, zh } from '../src/client/locales.ts'

const DAY = '2026-11-26'

function board(): Board {
  return emptyBoard(DAY)
}

function task(draft: Board, column: 'must' | 'optional', title: string, date = DAY): Task {
  const id = addTask(draft, column, title, date, [], 1)
  return draft.tasks.find(item => item.id === id)!
}

describe('board model', () => {
  it('formats dates and rejects a board that is missing its arrays', () => {
    expect(isoDate(new Date(2026, 10, 26, 15).getTime())).toBe(DAY)
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays(DAY, -1)).toBe('2026-11-25')
    expect(weekdayIndex(DAY)).toBe(4)
    expect(weekStart(DAY)).toBe('2026-11-22')
    expect(passedDragThreshold(6, 0)).toBe(false)
    expect(passedDragThreshold(7, 0)).toBe(true)
    expect(pointerBand(1, 0)).toBe('middle')
    expect(pointerBand(1, 10)).toBe('before')
    expect(pointerBand(9, 10)).toBe('after')
    expect(pointerBand(5, 10)).toBe('middle')
    expect(edgeIndex(['a', 'b'], 'a', 'b', 'before')).toBe(0)
    expect(edgeIndex(['a', 'b'], 'a', 'b', 'after')).toBe(1)
    expect(edgeIndex(['a', 'b'], 'a', 'missing', 'after')).toBe(1)
    expect(clampListHeight(10, 100)).toBe(80)
    expect(clampListHeight(500, 200)).toBe(140)
    expect(isBoard(null)).toBe(false)
    expect(isBoard({ ...board(), tasks: undefined as never })).toBe(false)
    expect(isBoard(board())).toBe(true)
  })

  it('shows a task only on the dates its range, recurrence, skips, and extras allow', () => {
    const draft = board()
    const once = task(draft, 'must', '一次')
    expect(visibleOn(once, '2026-11-25')).toBe(false)
    expect(visibleOn(once, '2026-11-27')).toBe(false)
    once.due = '2026-11-28'
    once.skippedDates = [DAY]
    expect(visibleOn(once, DAY)).toBe(false)
    once.extraDates = [DAY]
    expect(visibleOn(once, DAY)).toBe(false)
    once.skippedDates = []
    expect(visibleOn(once, DAY)).toBe(true)
    once.extraDates = []
    once.skippedDates = []
    once.recurrence = 'weekday'
    once.due = '2026-11-29'
    expect(visibleOn(once, '2026-11-28')).toBe(false)
    once.recurrence = 'daily'
    expect(visibleOn(once, '2026-11-28')).toBe(true)
    expect(livesOnlyOn(once, '2026-11-20')).toBe(false)
    expect(livesOnlyOn(once, DAY)).toBe(false)
    const open = task(draft, 'optional', '每天', DAY)
    open.recurrence = 'daily'
    open.due = null
    expect(livesOnlyOn(open, DAY)).toBe(false)
    const extra = task(draft, 'must', '补', '2026-11-20')
    extra.due = '2026-11-20'
    extra.extraDates = ['2026-11-30']
    expect(livesOnlyOn(extra, '2026-11-20')).toBe(false)
    expect(livesOnlyOn(once, '2026-11-27')).toBe(false)
    const only = task(draft, 'must', '当天', '2026-12-02')
    expect(livesOnlyOn(only, '2026-12-02')).toBe(true)
  })

  it('edits tasks, notes, and tags, and ignores blank or invalid writes', () => {
    const draft = board()
    expect(addTask(draft, 'must', '  ', DAY, [], 1)).toBeNull()
    const item = task(draft, 'must', '写文档')
    setCompleted(draft, 'missing', DAY, true)
    setCompleted(draft, item.id, '2026-11-01', true)
    setCompleted(draft, item.id, DAY, true)
    setCompleted(draft, item.id, DAY, true)
    setCompleted(draft, item.id, DAY, false)
    expect(item.completedDates).toEqual([])
    updateTask(draft, 'missing', { title: 'nope' })
    updateTask(draft, item.id, { start: '2026-12-01', due: '2026-11-01' })
    expect(item.start).toBe(DAY)
    updateTask(draft, item.id, { title: '   ', time: '', due: '2026-11-30', recurrence: 'daily' })
    expect(item.title).toBe('写文档')
    expect(item.time).toBeNull()
    expect(item.due).toBe('2026-11-30')
    addNote(draft, 'missing', 'x')
    addNote(draft, item.id, '  ')
    addNote(draft, item.id, '第一行')
    const noteId = item.notes[0]!.id
    updateNote(draft, 'missing', noteId, 'x')
    updateNote(draft, item.id, 'missing', 'x')
    updateNote(draft, item.id, noteId, '  ')
    expect(item.notes).toEqual([])
    addNote(draft, item.id, '留下')
    deleteNote(draft, 'missing', item.notes[0]!.id)
    deleteNote(draft, item.id, item.notes[0]!.id)
    expect(saveTag(draft, { name: '  ', color: 'blue', description: '' })).toBeNull()
    const tagId = saveTag(draft, { name: ' 工作 ', color: 'blue', description: ' 说明 ' })!
    const replaced = saveTag(draft, { id: 'gone', name: '新的', color: 'red', description: '' })
    expect(replaced).not.toBe('gone')
    deleteTag(draft, replaced!)
    expect(saveTag(draft, { id: tagId, name: '工作', color: 'green', description: '说明' })).toBe(tagId)
    toggleTaskTag(draft, 'missing', tagId)
    toggleTaskTag(draft, item.id, 'missing')
    toggleTaskTag(draft, item.id, tagId)
    toggleTaskTag(draft, item.id, tagId)
    expect(item.tagIds).toEqual([])
    togglePin(draft, 'missing')
    togglePin(draft, tagId)
    deleteTag(draft, tagId)
    expect(draft.tags).toEqual([])
    deleteTask(draft, 'missing')
    deleteTask(draft, item.id)
    expect(draft.tasks).toEqual([])
  })

  it('tidies, classifies, splits, syncs, and clears a day', () => {
    expect(standardizedTitle('  1.  写   文档 ')).toBe('写 文档')
    expect(standardizedTitle(' 1. ')).toBeNull()
    expect(classifiedColumn('没有关键词')).toBeNull()
    expect(classifiedColumn('optional 选做')).toBe('optional')
    expect(classifiedColumn('must 必做')).toBe('must')
    expect(classifiedColumn('必做然后选做')).toBe('must')
    expect(classifiedColumn('选做然后必做')).toBe('optional')
    expect(decomposeLines('写文档，再核对、发出去和归档')).toEqual(['写文档', '再核对', '发出去', '归档'])
    expect(decomposeLines('  单独  ')).toEqual(['单独'])
    expect(decomposeLines('   ')).toEqual(['   '])
    const draft = board()
    expect(applyStandardize(draft, 'missing')).toBe(false)
    expect(applyClassify(draft, 'missing')).toBe(false)
    const tidy = task(draft, 'optional', '1. 必做 收尾')
    expect(applyStandardize(draft, tidy.id)).toBe(true)
    expect(applyStandardize(draft, tidy.id)).toBe(true)
    expect(applyClassify(draft, tidy.id)).toBe(true)
    expect(tidy.column).toBe('must')
    const plain = task(draft, 'must', '没有')
    expect(applyClassify(draft, plain.id)).toBe(false)
    const emptyTitle = task(draft, 'must', '1.')
    expect(applyStandardize(draft, emptyTitle.id)).toBe(false)
    const other = task(draft, 'must', '另一天', '2026-11-25')
    syncDay(draft, DAY, DAY)
    syncDay(draft, '2026-11-25', DAY)
    expect(other.extraDates).toContain(DAY)
    setCompleted(draft, other.id, '2026-11-25', true)
    syncDay(draft, '2026-11-25', '2026-11-27')
    expect(other.extraDates).not.toContain('2026-11-27')
    clearDay(draft, DAY)
    expect(draft.tasks.some(item => item.id === plain.id)).toBe(false)
    expect(other.skippedDates).toContain(DAY)
  })

  it('groups rows by pairing, joining, dissolving, and dropping', () => {
    const draft = board()
    const first = task(draft, 'must', '甲')
    const second = task(draft, 'must', '乙')
    const third = task(draft, 'optional', '丙')
    applyDrop(draft, { kind: 'task', id: 'missing' }, { kind: 'append', column: 'must' })
    applyDrop(draft, { kind: 'task', id: first.id }, { kind: 'pair', taskId: first.id })
    applyDrop(draft, { kind: 'task', id: first.id }, { kind: 'pair', taskId: second.id })
    expect(draft.groups).toHaveLength(1)
    const groupId = draft.groups[0]!.id
    applyDrop(draft, { kind: 'group', id: 'missing' }, { kind: 'append', column: 'must' })
    applyDrop(draft, { kind: 'group', id: groupId }, { kind: 'pair', taskId: third.id })
    applyDrop(draft, { kind: 'group', id: groupId }, { kind: 'insert', column: 'optional', index: 0 })
    expect(draft.groups[0]!.column).toBe('optional')
    applyDrop(draft, { kind: 'task', id: third.id }, { kind: 'join', groupId: 'missing' })
    applyDrop(draft, { kind: 'task', id: third.id }, { kind: 'child', groupId: 'missing', index: 0 })
    applyDrop(draft, { kind: 'task', id: third.id }, { kind: 'join', groupId })
    expect(children(draft, groupId)).toEqual([first.id, second.id, third.id])
    applyDrop(draft, { kind: 'task', id: third.id }, { kind: 'child', groupId, index: 0 })
    expect(children(draft, groupId)[0]).toBe(third.id)
    renameGroup(draft, 'missing', '名字')
    renameGroup(draft, groupId, '   ')
    renameGroup(draft, groupId, ' 一组 ')
    expect(draft.groups[0]!.title).toBe('一组')
    dissolveGroup(draft, 'missing')
    dissolveGroup(draft, groupId)
    expect(draft.groups).toEqual([])
    expect(rowsFor(draft, 'optional', DAY, []).map(row => row.kind === 'task' ? row.task.title : row.group.title))
      .toEqual(['丙', '甲', '乙'])
    applyDrop(draft, { kind: 'task', id: first.id }, { kind: 'append', column: 'must' })
    const alone = task(draft, 'must', '丁')
    applyDrop(draft, { kind: 'task', id: alone.id }, { kind: 'pair', taskId: first.id })
    deleteTask(draft, alone.id)
    expect(draft.groups).toEqual([])
    expect(first.groupId).toBeNull()
  })

  it('filters rows, counts unfinished days, and marks time and focus', () => {
    const draft = board()
    const tagId = saveTag(draft, { name: '工作', color: 'cyan', description: '' })!
    const pinned = saveTag(draft, { name: '固定', color: 'white', description: '' })!
    togglePin(draft, pinned)
    const item = task(draft, 'must', '晚上 8 点开会，3点半复盘')
    toggleTaskTag(draft, item.id, tagId)
    const hidden = task(draft, 'must', '别的', '2026-11-20')
    hidden.due = '2026-11-24'
    expect(columnNotice(draft, 'optional', DAY, [])).toBe('empty')
    expect(columnNotice(draft, 'must', DAY, [pinned])).toBe('filtered')
    expect(columnNotice(draft, 'must', DAY, [tagId])).toBeNull()
    expect(barTags(draft, DAY).map(tag => tag.id)).toEqual([tagId, pinned])
    expect(unfinishedCount(draft, DAY)).toBe(1)
    expect(unfinishedDays(board(), DAY, DAY)).toEqual([])
    expect(unfinishedDays(draft, DAY, DAY).some(day => day.date === '2026-11-20')).toBe(true)
    expect(mustOn(draft, DAY)).toEqual({ done: 0, total: 1 })
    addNote(draft, item.id, `${AI_NOTE}\n请处理`)
    expect(noteLines(item)).toEqual([AI_NOTE, '请处理'])
    expect(copyBody(item)).toBe('请处理')
    expect(copyBody(hidden)).toBe('')
    addNote(draft, hidden.id, HUMAN_NOTE)
    expect(focusAvailable(hidden, '2026-11-20', '2026-11-20')).toBe(true)
    expect(focusAvailable(item, DAY, DAY)).toBe(false)
    expect(timeSpans(item.title).filter(span => span.time).map(span => span.text)).toEqual(['晚上 8 点', '3点半'])
    expect(timeSpans('没有时间')).toEqual([{ text: '没有时间', time: false }])
    expect(timeSpans('8:30 开始').map(span => span.time)).toEqual([true, false])
    expect(elapsedDays(DAY_MS * 2, 0)).toBe(2)
    moveToInspiration(draft, 'missing', 5)
    moveToInspiration(draft, item.id, 5)
    setInspirationStatus(draft, 'missing', 'archived')
    setInspirationStatus(draft, draft.inspiration[0]!.id, 'archived')
    setViewedDate(draft, '2026-11-27')
    setListHeight(draft, 10, 1000)
    expect(draft.listHeight).toBe(80)
    resetBoard(draft, DAY)
    expect(draft.tasks).toEqual([])
    expect(draft.viewedDate).toBe(DAY)
  })

  it('covers equal order, cross-column drops, empty groups, and open recurrence', () => {
    const draft = board()
    const kept = task(draft, 'must', '留下')
    const tied = task(draft, 'must', '并列')
    kept.order = 0
    tied.order = 0
    updateTask(draft, kept.id, { title: '留下了' })
    expect(rowsFor(draft, 'must', DAY, []).map(row => row.kind === 'task' ? row.task.title : '').sort()).toEqual(['并列', '留下了'])
    const early = task(draft, 'optional', '更早', '2026-11-20')
    early.due = '2026-11-20'
    early.extraDates = ['2026-11-01', '2026-11-20']
    expect(livesOnlyOn(early, '2026-11-20')).toBe(false)
    clearDay(draft, '2026-11-02')
    const open = task(draft, 'optional', '每天')
    open.recurrence = 'daily'
    open.due = null
    open.skippedDates = Array.from({ length: 14 }, (_, index) => addDays(DAY, index + 1))
    expect(livesOnlyOn(open, DAY)).toBe(true)
    open.skippedDates = [DAY]
    early.skippedDates = [DAY]
    syncDay(draft, '2026-11-20', DAY)
    expect(early.skippedDates).not.toContain(DAY)
    const other = task(draft, 'optional', '乙')
    applyDrop(draft, { kind: 'task', id: other.id }, { kind: 'pair', taskId: kept.id })
    const groupId = draft.groups[0]!.id
    expect(other.column).toBe('must')
    applyDrop(draft, { kind: 'task', id: tied.id }, { kind: 'insert', column: 'must', index: 0 })
    applyDrop(draft, { kind: 'task', id: early.id }, { kind: 'join', groupId })
    expect(early.column).toBe('must')
    const hidden = task(draft, 'must', '隐藏')
    applyDrop(draft, { kind: 'task', id: hidden.id }, { kind: 'child', groupId, index: 1 })
    hidden.skippedDates = [DAY]
    expect(rowsFor(draft, 'must', DAY, []).some(row => row.kind === 'group')).toBe(true)
    for (const member of draft.tasks.filter(item => item.groupId === groupId)) member.skippedDates = [DAY]
    expect(rowsFor(draft, 'must', DAY, []).every(row => row.kind !== 'group')).toBe(true)
    draft.tasks = draft.tasks.filter(item => item.groupId !== groupId)
    const mover = task(draft, 'optional', '必做 搬走')
    expect(applyClassify(draft, mover.id)).toBe(true)
    expect(draft.groups).toEqual([])
    tied.extraDates = ['2026-11-01', '2026-12-02']
    tied.due = '2026-12-01'
    expect(unfinishedDays(draft, DAY, DAY).some(day => day.date === '2026-12-01')).toBe(true)
    expect(timeSpans('8:30')).toEqual([{ text: '8:30', time: true }])
    const tagId = saveTag(draft, { name: '临时', color: 'red', description: '' })!
    toggleTaskTag(draft, kept.id, tagId)
    deleteTag(draft, tagId)
    expect(kept.tagIds).toEqual([])
  })
})

describe('board stats', () => {
  it('keeps empty days out of streaks and days without must-do tasks out of rates', () => {
    const draft = board()
    expect(rateBetween(draft, '2026-11-20', DAY).rate).toBeNull()
    expect(percentOf(null)).toBeNull()
    expect(percentOf(0.456)).toBe(46)
    expect(activity(draft, DAY)).toEqual({ activeDays: 0, current: 0, longest: 0, weakest: null })
    expect(columnRate(draft, DAY, 'optional')).toBeNull()
    expect(columnRate(draft, DAY, 'must')).toBeNull()
    const monday = task(draft, 'must', '周一', '2026-11-23')
    monday.due = DAY
    const tuesday = task(draft, 'optional', '周二', '2026-11-24')
    setCompleted(draft, monday.id, '2026-11-23', true)
    setCompleted(draft, monday.id, '2026-11-24', true)
    setCompleted(draft, tuesday.id, '2026-11-24', true)
    const stats = activity(draft, DAY)
    expect(stats).toMatchObject({ activeDays: 2, current: 0, longest: 2 })
    expect(stats.weakest).toBe(3)
    expect(columnRate(draft, '2026-11-23', 'must')).toBe(1)
    const future = emptyBoard('2026-12-01')
    task(future, 'must', '以后', '2026-12-01')
    expect(activity(future, DAY).activeDays).toBe(0)
    expect(heatBand(0, 0, true)).toBe('future')
    expect(heatBand(0, 0, false)).toBe('none')
    expect(heatBand(0, 2, false)).toBe('zero')
    expect(heatBand(1, 4, false)).toBe('low')
    expect(heatBand(3, 4, false)).toBe('mid')
    expect(heatBand(4, 4, false)).toBe('high')
    expect(heatOrigin(emptyBoard(DAY), DAY)).toBe(addDays(DAY, -53 * 7))
    expect(heatOrigin(draft, DAY) < addDays(DAY, -53 * 7)).toBe(false)
    const early = emptyBoard(DAY)
    task(early, 'must', '很早', '2024-01-01')
    expect(heatOrigin(early, DAY)).toBe('2024-01-01')
    const weeks = heatWeeks(draft, DAY, weekStart(DAY), 2)
    expect(weeks[0]?.month).toBe(11)
    expect(weeks.at(-1)?.days.at(-1)?.date).toBe('2026-11-28')
    expect(weeks.at(-1)?.days.at(-1)?.band).toBe('future')
    expect(clampHeatEnd('2026-12-06', DAY, '2026-01-01')).toBe(weekStart(DAY))
    expect(clampHeatEnd('2025-01-05', DAY, '2026-01-01')).toBe(weekStart('2026-01-01'))
    expect(clampHeatEnd(weekStart(DAY), DAY, '2026-01-01')).toBe(weekStart(DAY))
    const monthChange = heatWeeks(emptyBoard('2026-12-06'), '2026-12-06', '2026-11-29', 1)
    expect(monthChange[0]?.month).toBe(12)
  })

  it('counts tagged progress, stalled tags, and lingering ideas', () => {
    const draft = board()
    expect(tagInsight(draft, DAY)).toEqual({ completed: null, stalled: [] })
    const tagId = saveTag(draft, { name: '卡住', color: 'red', description: '' })!
    const moving = saveTag(draft, { name: '前进', color: 'green', description: '' })!
    const idle = task(draft, 'must', '没动')
    const moved = task(draft, 'must', '动了', '2026-11-20')
    toggleTaskTag(draft, idle.id, tagId)
    toggleTaskTag(draft, moved.id, moving)
    moved.due = DAY
    setCompleted(draft, moved.id, '2026-11-20', true)
    moved.completedDates.push('2026-12-01', '2019-01-01')
    const loose = task(draft, 'must', '无标签')
    const tags = tagInsight(draft, DAY)
    expect(tags.completed).toBe(1)
    expect(tags.stalled).toEqual(['卡住'])
    expect(ideaInsight(draft, 10)).toEqual({ total: 0, normal: 0, archived: 0, dwell: null })
    moveToInspiration(draft, idle.id, 0)
    draft.inspiration[0]!.movedAt = 0
    moveToInspiration(draft, moved.id, elapsedDays(10, 0))
    draft.inspiration[1]!.status = 'archived'
    const ideas = ideaInsight(draft, DAY_MS * 3)
    expect(ideas).toMatchObject({ total: 2, normal: 1, archived: 1, dwell: 3 })
    expect(loose.tagIds).toEqual([])
    const rated = board()
    const done = task(rated, 'must', '完成')
    setCompleted(rated, done.id, DAY, true)
    done.extraDates = ['2026-11-01', '2026-11-27']
    done.due = '2026-11-27'
    expect(rateBetween(rated, DAY, DAY).rate).toBe(1)
    expect(activity(rated, DAY).current).toBeGreaterThan(0)
    const gapped = board()
    const monday = task(gapped, 'must', '周一', '2026-11-23')
    monday.due = '2026-11-23'
    setCompleted(gapped, monday.id, '2026-11-23', true)
    const thursday = task(gapped, 'must', '周四')
    setCompleted(gapped, thursday.id, DAY, true)
    expect(activity(gapped, DAY).longest).toBeGreaterThan(1)
    const only = board()
    task(only, 'must', '仅今天')
    expect(activity(only, DAY).current).toBe(0)
  })
})

describe('dictionaries and store', () => {
  it('keeps every locale on the Chinese key set', () => {
    const keys = Object.keys(zh).sort()
    for (const dict of [en, ja, es, fr, de, ru, pt]) expect(Object.keys(dict).sort()).toEqual(keys)
  })

  it('writes through the store actions', () => {
    const instance = createBoardStore().create('board-spec')
    instance.actions.addTask('must', '必做 记录', DAY, [], 1)
    const id = instance.getSnapshot().tasks[0]!.id
    instance.actions.classify(id)
    instance.actions.standardize(id)
    instance.actions.updateTask(id, { recurrence: 'weekday' })
    instance.actions.addNote(id, '备注')
    const noteId = instance.getSnapshot().tasks[0]!.notes[0]!.id
    instance.actions.updateNote(id, noteId, '改过')
    instance.actions.saveTag('工作', 'blue', '说明')
    instance.actions.saveTag('工作', 'green', '改过', instance.getSnapshot().tags[0]!.id)
    const tagId = instance.getSnapshot().tags[0]!.id
    instance.actions.toggleTaskTag(id, tagId)
    instance.actions.togglePin(tagId)
    instance.actions.setCompleted(id, DAY, true)
    instance.actions.syncDay('2026-11-25', DAY)
    instance.actions.setViewedDate('2026-11-27')
    instance.actions.setListHeight(200, 800)
    instance.actions.moveToInspiration(id, 2)
    instance.actions.setInspirationStatus(instance.getSnapshot().inspiration[0]!.id, 'archived')
    instance.actions.deleteNote('missing', noteId)
    instance.actions.deleteTag(tagId)
    instance.actions.clearDay(DAY)
    instance.actions.reset(DAY)
    expect(instance.getSnapshot().tasks).toEqual([])
    instance.clearPersisted()
  })
})

const DAY_MS = 86_400_000

function children(draft: Board, groupId: string): string[] {
  return draft.tasks.filter(item => item.groupId === groupId).sort((left, right) => left.order - right.order).map(item => item.id)
}
