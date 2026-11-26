// @vitest-environment jsdom
/** The tasks page commits edits, drag, focus, stats, and inspiration through the board store. */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AutoTodoPage } from '../src/client/AutoTodoPage.tsx'
import { createBoardStore } from '../src/client/board-store.ts'
import { zh, type AutoTodoKey } from '../src/client/locales.ts'

const NOW = new Date(2026, 10, 26, 15, 0, 0).getTime()

function text(key: AutoTodoKey, params?: Record<string, string | number>): string {
  let value: string = zh[key]
  if (params !== undefined) {
    for (const [name, replacement] of Object.entries(params)) value = value.replaceAll(`{${name}}`, String(replacement))
  }
  return value
}

function mount(options?: { now?: () => number; broken?: boolean }) {
  localStorage.clear()
  const clock = options?.now ?? (() => NOW)
  const instance = createBoardStore().create('page-spec')
  if (options?.broken) instance.actions.reset = instance.actions.reset
  function View() {
    const [, bump] = useState(0)
    useEffect(() => instance.subscribe(() => { bump(value => value + 1) }), [])
    const stored = options?.broken ? { version: 0 } : instance.getSnapshot()
    const useStore = (selector: (state: typeof stored) => unknown) => selector(stored)
    return <AutoTodoPage useStore={useStore as never} actions={instance.actions} now={clock} t={text as never} />
  }
  const view = render(<View />)
  return { ...view, instance }
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left, y: top, left, top, width, height, right: left + width, bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect
}

function change(run: () => void): void {
  act(run)
}

function taskRow(title: string): HTMLElement {
  const row = [...document.querySelectorAll<HTMLElement>('[data-kind="task"]')]
    .find(node => node.textContent?.includes(title) === true)
  if (row === undefined) throw new Error(`missing task ${title}`)
  return row
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.innerWidth = 1280
  localStorage.clear()
})

describe('auto todo page', () => {
  it('resets a board the page cannot read', () => {
    const reset = vi.fn()
    const view = mount({ broken: true })
    view.instance.actions.reset = reset as never
    fireEvent.click(screen.getByRole('button', { name: text('board.reset') }))
    expect(reset).toHaveBeenCalledWith('2026-11-26')
  })

  it('adds, completes, filters, edits, and clears a task', async () => {
    vi.useFakeTimers()
    const { instance } = mount()
    const must = screen.getByLabelText(text('add.must'))
    fireEvent.change(must, { target: { value: '  ' } })
    fireEvent.keyDown(must, { key: 'Enter', shiftKey: true })
    fireEvent.keyDown(must, { key: 'Enter', isComposing: true })
    fireEvent.change(must, { target: { value: '晚上 8 点写文档' } })
    fireEvent.keyDown(must, { key: 'Enter' })
    await act(async () => { await vi.advanceTimersByTimeAsync(40) })
    expect(taskRow('晚上 8 点写文档')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true')
    fireEvent.pointerDown(taskRow('晚上 8 点写文档'), { button: 0, clientX: 8, clientY: 8 })
    fireEvent.pointerUp(window, { clientX: 8, clientY: 8 })
    fireEvent.change(screen.getByLabelText(text('edit.due')), { target: { value: '2026-11-28' } })
    fireEvent.change(screen.getByLabelText(text('edit.start')), { target: { value: '2026-11-20' } })
    fireEvent.change(screen.getByLabelText(text('edit.time')), { target: { value: '20:00' } })
    fireEvent.change(screen.getByLabelText(text('edit.recurrence')), { target: { value: 'weekday' } })
    const note = screen.getByLabelText(text('note.placeholder'))
    fireEvent.change(note, { target: { value: '人类任务' } })
    fireEvent.keyDown(note, { key: 'Enter' })
    fireEvent.click(screen.getByText(text('edit.close')))
    expect(instance.getSnapshot().tasks[0]?.recurrence).toBe('weekday')
    fireEvent.click(screen.getAllByRole('button', { name: text('header.clear') })[0]!)
    fireEvent.click(screen.getAllByRole('button', { name: text('clear.confirm') }).at(-1)!)
    expect(instance.getSnapshot().tasks[0]?.skippedDates).toContain('2026-11-26')
  })

  it('syncs an unfinished day and explains why a sync cannot run', () => {
    const { instance } = mount()
    change(() => {
      instance.actions.addTask('must', '昨天的', '2026-11-25', [], NOW)
      instance.actions.addTask('optional', '今天的', '2026-11-26', [], NOW)
    })
    fireEvent.click(screen.getByRole('button', { name: text('header.sync') }))
    expect(screen.getByText(text('sync.sameDay'))).toBeTruthy()
    const syncDialog = screen.getByRole('dialog', { name: text('sync.title') })
    fireEvent.change(syncDialog.querySelector('input[type="date"]')!, { target: { value: '2026-11-25' } })
    fireEvent.click(screen.getAllByRole('button', { name: text('sync.confirm') }).at(-1)!)
    expect(instance.getSnapshot().tasks[0]?.extraDates).toContain('2026-11-26')
    change(() => {
      instance.actions.setCompleted(instance.getSnapshot().tasks[1]!.id, '2026-11-26', true)
      instance.actions.setCompleted(instance.getSnapshot().tasks[0]!.id, '2026-11-26', true)
    })
    fireEvent.click(screen.getByRole('button', { name: text('header.sync') }))
    expect(screen.getByText(text('sync.none'))).toBeTruthy()
  })

  it('pins and edits tags, then filters the column', async () => {
    vi.useFakeTimers()
    const { instance } = mount()
    fireEvent.click(screen.getByRole('button', { name: text('tags.settings') }))
    fireEvent.click(screen.getByRole('button', { name: text('tags.add') }))
    fireEvent.change(screen.getByLabelText(text('tags.name')), { target: { value: '工作' } })
    fireEvent.change(screen.getByLabelText(text('tags.description')), { target: { value: '白天' } })
    fireEvent.click(screen.getByRole('button', { name: text('tags.color.green') }))
    fireEvent.click(screen.getByRole('button', { name: text('tags.add') }))
    fireEvent.click(screen.getByRole('button', { name: text('edit.close') }))
    const tagId = instance.getSnapshot().tags[0]!.id
    change(() => {
      instance.actions.addTask('must', '带标签', '2026-11-26', [tagId], NOW)
      instance.actions.addTask('optional', '裸的', '2026-11-26', [], NOW)
    })
    fireEvent.click(screen.getByRole('button', { name: text('pin.pin') }))
    expect(instance.getSnapshot().tags[0]?.pinned).toBe(true)
    fireEvent.click(screen.getByText('工作'))
    await act(async () => { await vi.advanceTimersByTimeAsync(220) })
    expect(taskRow('带标签')).toBeTruthy()
    expect(document.body.textContent).not.toContain('裸的')
    fireEvent.doubleClick(screen.getByText('工作'))
    fireEvent.click(screen.getByRole('button', { name: text('tags.delete') }))
    expect(instance.getSnapshot().tags).toEqual([])
  })

  it('opens the menu, standardizes, classifies, and decomposes into the composer', async () => {
    vi.useFakeTimers()
    mount()
    const input = screen.getByLabelText(text('add.optional'))
    fireEvent.change(input, { target: { value: '1. 选做 写，核对' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await act(async () => { await vi.advanceTimersByTimeAsync(40) })
    expect(taskRow('选做 写，核对')).toBeTruthy()
    fireEvent.contextMenu(taskRow('选做 写，核对'), { clientX: 12, clientY: 20 })
    fireEvent.click(screen.getByRole('menuitem', { name: text('menu.decompose') }))
    await act(async () => { await vi.advanceTimersByTimeAsync(280) })
    const composer = screen.getByLabelText(text('composer.placeholder'))
    expect((composer as HTMLTextAreaElement).value).toContain('核对')
    fireEvent.keyDown(composer, { key: 'Enter' })
    expect(taskRow('核对')).toBeTruthy()
    fireEvent.contextMenu(taskRow('选做 写'), { clientX: 4, clientY: 4 })
    fireEvent.click(screen.getByRole('menuitem', { name: text('menu.standardize') }))
    await act(async () => { await vi.advanceTimersByTimeAsync(40) })
    fireEvent.contextMenu(taskRow('选做 写'), { clientX: 4, clientY: 4 })
    fireEvent.click(screen.getByRole('menuitem', { name: text('menu.classify') }))
    await act(async () => { await vi.advanceTimersByTimeAsync(40) })
    const blank = screen.getByLabelText(text('add.must'))
    fireEvent.change(blank, { target: { value: '1.' } })
    fireEvent.keyDown(blank, { key: 'Enter' })
    await act(async () => { await vi.advanceTimersByTimeAsync(40) })
    expect(screen.getByText(text('status.standardizeFailed'))).toBeTruthy()
    fireEvent.contextMenu(taskRow('选做 写'), { clientX: 4, clientY: 4 })
    fireEvent.click(screen.getByRole('menuitem', { name: text('menu.edit') }))
    expect(screen.getByRole('dialog', { name: text('edit.title') })).toBeTruthy()
  })

  it('drags a row onto another to form a group, then renames and dissolves it', async () => {
    vi.useFakeTimers()
    const { instance } = mount()
    change(() => {
      instance.actions.addTask('must', '甲', '2026-11-26', [], NOW)
      instance.actions.addTask('must', '乙', '2026-11-26', [], NOW)
    })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rectFor(this: Element) {
      const node = this as HTMLElement
      if (node.dataset.id === instance.getSnapshot().tasks[0]?.id) return rect(0, 0, 200, 40)
      if (node.dataset.id === instance.getSnapshot().tasks[1]?.id) return rect(0, 40, 200, 40)
      if (node.dataset.column === 'must') return rect(0, 0, 200, 240)
      return rect(0, 0, 0, 0)
    })
    const first = instance.getSnapshot().tasks[0]!.id
    fireEvent.pointerDown(taskRow('甲'), { button: 0, clientX: 20, clientY: 10 })
    fireEvent.pointerMove(window, { clientX: 20, clientY: 60 })
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    fireEvent.pointerUp(window, { clientX: 20, clientY: 60 })
    expect(instance.getSnapshot().groups).toHaveLength(1)
    fireEvent.doubleClick(screen.getByText(text('group.untitled')))
    const name = screen.getByLabelText(text('group.untitled'))
    fireEvent.change(name, { target: { value: '一组' } })
    fireEvent.keyDown(name, { key: 'Enter' })
    expect(instance.getSnapshot().groups[0]?.title).toBe('一组')
    fireEvent.contextMenu(screen.getByText('一组'))
    fireEvent.click(screen.getByRole('menuitem', { name: text('menu.dissolve') }))
    expect(instance.getSnapshot().groups).toEqual([])
    expect(instance.getSnapshot().tasks.some(task => task.id === first)).toBe(true)
  })

  it('runs the focus timer to completion and can abandon it', async () => {
    vi.useFakeTimers()
    let time = NOW
    const { instance } = mount({ now: () => time })
    change(() => {
      instance.actions.addTask('must', '专注', '2026-11-26', [], NOW)
      instance.actions.addNote(instance.getSnapshot().tasks[0]!.id, '人类任务')
    })
    const id = instance.getSnapshot().tasks[0]!.id
    fireEvent.click(screen.getAllByRole('button', { name: text('focus.dial') })[0]!)
    const handle = screen.getAllByRole('button', { name: text('focus.dial') }).at(-1)!
    vi.spyOn(handle.parentElement!, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 280, 280))
    fireEvent.pointerDown(handle, { clientX: 140, clientY: 20 })
    fireEvent.pointerMove(window, { clientX: 280, clientY: 140 })
    fireEvent.pointerUp(window)
    fireEvent.click(screen.getByRole('button', { name: text('focus.start') }))
    time = NOW + 60 * 60_000
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    fireEvent.click(screen.getByRole('button', { name: text('focus.done') }))
    expect(instance.getSnapshot().tasks[0]?.completedDates).toContain('2026-11-26')
    change(() => { instance.actions.setCompleted(id, '2026-11-26', false) })
    fireEvent.click(screen.getAllByRole('button', { name: text('focus.dial') })[0]!)
    fireEvent.click(screen.getByRole('button', { name: text('focus.abandon') }))
    expect(screen.queryByText(text('focus.pick'))).toBeNull()
  })

  it('copies an AI note from the task row', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    vi.useFakeTimers()
    const { instance } = mount()
    change(() => {
      instance.actions.addTask('must', '交给模型', '2026-11-26', [], NOW)
      instance.actions.addNote(instance.getSnapshot().tasks[0]!.id, 'AI任务\n请总结')
    })
    fireEvent.click(screen.getByRole('button', { name: text('copy.copy') }))
    expect(writeText).toHaveBeenCalledWith('请总结')
    await act(async () => { await vi.advanceTimersByTimeAsync(1200) })
    expect(screen.queryByRole('button', { name: text('nav.inspiration') })).toBeNull()
    expect(screen.queryByText(text('insight.ideas.module'))).toBeNull()
    expect(screen.queryByRole('button', { name: text('edit.inspire') })).toBeNull()
  })

  it('shows stats, heatmap bands, and the narrow layout', () => {
    const { instance } = mount()
    change(() => {
      instance.actions.addTask('must', '统计', '2026-11-22', [], NOW)
      const id = instance.getSnapshot().tasks[0]!.id
      instance.actions.updateTask(id, { due: '2026-11-27' })
      instance.actions.setCompleted(id, '2026-11-23', true)
      instance.actions.setCompleted(id, '2026-11-24', true)
    })
    fireEvent.click(screen.getByRole('button', { name: text('nav.stats') }))
    expect(screen.getByText(text('insights.title'))).toBeTruthy()
    const cell = document.querySelector('[data-band="high"]') ?? document.querySelector('[data-heat-cell]')
    expect(cell).toBeTruthy()
    fireEvent.focus(cell!)
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.scroll(window)
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: text('heatmap.earlier') }))
    fireEvent.click(screen.getByRole('button', { name: text('heatmap.later') }))
    act(() => { window.innerWidth = 800; window.dispatchEvent(new Event('resize')) })
    expect(document.querySelector('nav')?.parentElement?.parentElement?.parentElement?.className ?? '').toMatch(/narrow/)
  })

  it('walks date controls, notes, sync choices, resize, and a rejected copy', async () => {
    const writeText = vi.fn(async () => { throw new Error('denied') })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { instance } = mount()
    fireEvent.click(screen.getByRole('button', { name: text('header.previous') }))
    fireEvent.click(screen.getByRole('button', { name: text('header.next') }))
    fireEvent.click(screen.getByRole('button', { name: text('header.today') }))
    change(() => {
      instance.actions.addTask('must', '说明很长', '2026-11-26', [], NOW)
      const id = instance.getSnapshot().tasks[0]!.id
      instance.actions.addNote(id, 'AI任务\n正文')
      instance.actions.addNote(id, `${'字'.repeat(150)}\n第二行`)
      instance.actions.saveTag('工作', 'blue', '')
      instance.actions.toggleTaskTag(id, instance.getSnapshot().tags[0]!.id)
      instance.actions.addTask('optional', '前天', '2026-11-24', [], NOW)
    })
    fireEvent.contextMenu(taskRow('说明很长').querySelector('[data-no-drag]')!, { clientX: 1, clientY: 1 })
    fireEvent.pointerDown(taskRow('说明很长'), { button: 2, clientX: 1, clientY: 1 })
    fireEvent.pointerDown(taskRow('说明很长'), { button: 0, clientX: 3, clientY: 3 })
    fireEvent.pointerUp(window, { clientX: 3, clientY: 3 })
    const due = screen.getByLabelText(text('edit.due')) as HTMLInputElement
    fireEvent.change(due, { target: { value: '2026-11-28' } })
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(due, '')
    fireEvent.change(due)
    expect(instance.getSnapshot().tasks.find(task => task.title === '说明很长')!.due).toBeNull()
    fireEvent.change(due, { target: { value: '2026-11-28' } })
    fireEvent.click(screen.getByRole('button', { name: text('edit.clearDue') }))
    fireEvent.click(screen.getByRole('button', { name: '工作' }))
    fireEvent.click(screen.getByRole('button', { name: text('note.expand') }))
    fireEvent.click(screen.getByRole('button', { name: text('note.collapse') }))
    fireEvent.click(screen.getByRole('button', { name: /第二行/ }))
    const noteEditor = [...document.querySelectorAll('textarea')].find(node => (node as HTMLTextAreaElement).value.includes('第二行'))!
    fireEvent.change(noteEditor, { target: { value: '改过的说明' } })
    fireEvent.keyDown(noteEditor, { key: 'Enter' })
    const edited = screen.getByRole('button', { name: '改过的说明' }).closest('article')!
    fireEvent.click(edited.querySelectorAll('button')[1]!)
    fireEvent.click(screen.getByRole('button', { name: text('copy.copy') }))
    await vi.waitFor(() => { expect(writeText).toHaveBeenCalled() })
    fireEvent.click(screen.getByText(text('edit.close')))
    fireEvent.click(screen.getByRole('button', { name: text('header.sync') }))
    const source = screen.getByRole('button', { name: /1 条未完成/ })
    fireEvent.click(source)
    const syncDate = document.querySelector('[role="dialog"] input[type="date"]')!
    fireEvent.change(syncDate, { target: { value: '2026-01-01' } })
    expect(screen.getByText(text('sync.empty'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text('edit.close') }))
    fireEvent.pointerDown(taskRow('说明很长'), { button: 0, clientX: 4, clientY: 4 })
    fireEvent.pointerUp(window, { clientX: 4, clientY: 4 })
    fireEvent.click(screen.getAllByRole('button', { name: text('edit.delete') }).at(-1)!)
    const handle = screen.getByRole('separator', { name: text('nav.tasks') })
    fireEvent.pointerDown(handle, { clientY: 10 })
    fireEvent.pointerMove(window, { clientY: 80 })
    fireEvent.pointerUp(window)
    expect(instance.getSnapshot().listHeight).toBeGreaterThan(80)
    fireEvent.click(screen.getByRole('button', { name: text('nav.stats') }))
    const cell = document.querySelector('[data-heat-cell]')!
    fireEvent.mouseEnter(cell)
    fireEvent.mouseLeave(cell)
    fireEvent.focus(cell)
    fireEvent.blur(cell)
    expect(screen.queryByRole('button', { name: text('nav.inspiration') })).toBeNull()
    expect(screen.getByRole('button', { name: text('nav.stats') })).toBeTruthy()
  })

  it('reorders rows, joins a group, and closes dialogs from the chrome', async () => {
    vi.useFakeTimers()
    window.innerWidth = 0
    const { instance } = mount()
    window.dispatchEvent(new Event('resize'))
    window.innerWidth = 1280
    window.dispatchEvent(new Event('resize'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => undefined) } })
    fireEvent.click(screen.getByRole('button', { name: text('nav.stats') }))
    fireEvent.click(screen.getByRole('button', { name: text('nav.tasks') }))
    change(() => {
      instance.actions.addTask('must', '甲', '2026-11-26', [], NOW)
      instance.actions.addTask('must', '乙', '2026-11-26', [], NOW)
      instance.actions.addTask('must', '丙', '2026-11-26', [], NOW)
      instance.actions.addTask('optional', '丁', '2026-11-26', [], NOW)
    })
    const ids = () => instance.getSnapshot().tasks.map(task => task.id)
    const [first, second, third, side] = ids()
    const rectFor = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rectFor(this: Element) {
      const node = this as HTMLElement
      if (node.hasAttribute('data-dial')) return rect(0, 0, 280, 280)
      if (node.dataset.id === first) return rect(0, 0, 200, 40)
      if (node.dataset.id === second) return rect(0, 40, 200, 40)
      if (node.dataset.id === third) return rect(0, 80, 200, 40)
      if (node.dataset.id === side) return rect(300, 0, 200, 40)
      if (node.dataset.column === 'must') return rect(0, 0, 200, 400)
      if (node.dataset.column === 'optional') return rect(300, 0, 200, 400)
      return rect(0, 0, 0, 0)
    })
    fireEvent.pointerDown(taskRow('丙'), { button: 2, clientX: 20, clientY: 90 })
    fireEvent.pointerUp(window, { clientX: 20, clientY: 90 })
    fireEvent.pointerDown(taskRow('丙').querySelector('[data-no-drag]')!, { button: 0, clientX: 2, clientY: 2 })
    fireEvent.pointerDown(taskRow('丙'), { button: 0, clientX: 20, clientY: 90 })
    fireEvent.pointerMove(window, { clientX: 21, clientY: 90 })
    fireEvent.pointerUp(window, { clientX: 21, clientY: 90 })
    fireEvent.click(screen.getByText(text('edit.close')))
    fireEvent.pointerDown(taskRow('丙'), { button: 0, clientX: 20, clientY: 90 })
    fireEvent.pointerMove(window, { clientX: -40, clientY: -40 })
    fireEvent.pointerUp(window, { clientX: -40, clientY: -40 })
    fireEvent.pointerDown(taskRow('丙'), { button: 0, clientX: 20, clientY: 90 })
    fireEvent.pointerMove(window, { clientX: 30, clientY: 4 })
    fireEvent.pointerMove(window, { clientX: 30, clientY: 75 })
    fireEvent.pointerMove(window, { clientX: 30, clientY: 60 })
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    fireEvent.pointerMove(window, { clientX: 30, clientY: 60 })
    fireEvent.pointerMove(window, { clientX: 30, clientY: 4 })
    fireEvent.pointerUp(window, { clientX: 30, clientY: 4 })
    expect(instance.getSnapshot().groups).toEqual([])
    fireEvent.pointerDown(taskRow('丙'), { button: 0, clientX: 20, clientY: 90 })
    fireEvent.pointerMove(window, { clientX: 320, clientY: 4 })
    fireEvent.pointerMove(window, { clientX: 320, clientY: 200 })
    fireEvent.pointerUp(window, { clientX: 320, clientY: 200 })
    change(() => {
      instance.actions.applyDrop({ kind: 'task', id: first! }, { kind: 'pair', taskId: second! })
      instance.actions.addNote(first!, '人类任务')
      instance.actions.addNote(second!, 'AI任务\n正文')
      instance.actions.addNote(third!, 'AI任务\n另一段')
    })
    rectFor.mockImplementation(function grouped(this: Element) {
      const node = this as HTMLElement
      if (node.hasAttribute('data-dial')) return rect(0, 0, 280, 280)
      if (node.dataset.kind === 'group') return rect(0, 0, 200, 200)
      if (node.dataset.id === first) return rect(0, 80, 200, 30)
      if (node.dataset.id === second) return rect(0, 120, 200, 20)
      if (node.dataset.id === third) return rect(0, 210, 200, 40)
      if (node.dataset.column === 'must') return rect(0, 0, 220, 400)
      if (node.dataset.column === 'optional') return rect(300, 0, 200, 400)
      return rect(0, 0, 0, 0)
    })
    fireEvent.pointerDown(taskRow('丙'), { button: 0, clientX: 20, clientY: 220 })
    fireEvent.pointerMove(window, { clientX: 20, clientY: 10 })
    fireEvent.pointerMove(window, { clientX: 20, clientY: 190 })
    fireEvent.pointerMove(window, { clientX: 20, clientY: 70 })
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    fireEvent.pointerMove(window, { clientX: 20, clientY: 70 })
    fireEvent.pointerUp(window, { clientX: 20, clientY: 70 })
    expect(instance.getSnapshot().tasks.find(task => task.id === third)?.groupId).toBeTruthy()
    fireEvent.pointerDown(taskRow('丙'), { button: 0, clientX: 20, clientY: 220 })
    fireEvent.pointerMove(window, { clientX: 20, clientY: 85 })
    fireEvent.pointerMove(window, { clientX: 20, clientY: 108 })
    fireEvent.pointerUp(window, { clientX: 20, clientY: 108 })
    fireEvent.contextMenu(taskRow('乙'), { clientX: 8, clientY: 8 })
    fireEvent.click(screen.getByRole('menuitem', { name: text('menu.edit') }))
    fireEvent.click(screen.getByText(text('edit.close')))
    fireEvent.click(screen.getAllByRole('button', { name: text('focus.dial') })[0]!)
    const handle = screen.getAllByRole('button', { name: text('focus.dial') }).at(-1)!
    fireEvent.pointerDown(handle, { clientX: 140, clientY: 140 })
    fireEvent.pointerMove(window, { clientX: 140, clientY: 0 })
    fireEvent.pointerUp(window)
    fireEvent.click(screen.getByRole('button', { name: text('focus.start') }))
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    fireEvent.click(screen.getByRole('button', { name: text('focus.abandon') }))
    fireEvent.click(screen.getAllByRole('button', { name: text('copy.copy') })[0]!)
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getAllByRole('button', { name: text('copy.copy') })[0]!)
    await act(async () => { await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(1200) })
    fireEvent.click(taskRow('甲').querySelector('[role="checkbox"]')!)
    const frame = document.querySelector<HTMLElement>('[data-kind="group"]')!
    fireEvent.pointerDown(frame, { button: 0, clientX: 20, clientY: 10 })
    fireEvent.pointerUp(window, { clientX: 20, clientY: 10 })
    fireEvent.pointerDown(frame, { button: 0, clientX: 20, clientY: 10 })
    fireEvent.pointerMove(window, { clientX: 40, clientY: 300 })
    fireEvent.pointerUp(window, { clientX: 40, clientY: 300 })
    fireEvent.doubleClick(screen.getByText(text('group.untitled')))
    fireEvent.keyDown(screen.getByLabelText(text('group.untitled')), { key: 'Escape' })
    const composer = screen.getByLabelText(text('composer.placeholder'))
    fireEvent.change(composer, { target: { value: '一行\n  \n两行' } })
    fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true })
    fireEvent.keyDown(composer, { key: 'Enter' })
    expect(taskRow('一行')).toBeTruthy()
    expect(taskRow('两行')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text('header.clear') }))
    fireEvent.click(screen.getByRole('button', { name: text('edit.close') }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: text('tags.settings') }))
    expect(screen.getByText(text('tags.empty'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text('edit.close') }))
    const must = screen.getByLabelText(text('add.must'))
    fireEvent.change(must, { target: { value: '开会' } })
    fireEvent.keyDown(must, { key: 'Enter' })
    await act(async () => { await vi.advanceTimersByTimeAsync(40) })
    expect(screen.getByText(text('status.classifyFailed'))).toBeTruthy()
    fireEvent.keyDown(must, { key: 'Enter' })
    fireEvent.contextMenu(taskRow('开会'), { clientX: 4, clientY: 4 })
    fireEvent.keyDown(document, { key: 'Escape' })
    change(() => {
      instance.actions.saveTag('工作', 'blue', '说明')
      instance.actions.saveTag('卡住', 'red', '')
      instance.actions.saveTag('生活', '#F79410', '浅色')
      instance.actions.saveTag('工程', '#1784FC', '')
      instance.actions.saveTag('灰', 'gray', '')
      for (const name of ['生活', '工程', '灰']) {
        const tag = instance.getSnapshot().tags.find(item => item.name === name)!
        instance.actions.togglePin(tag.id)
      }
      const tags = instance.getSnapshot().tags
      instance.actions.toggleTaskTag(instance.getSnapshot().tasks[0]!.id, tags[0]!.id)
      const stalled = instance.getSnapshot().tasks.find(task => task.title === '两行')!
      instance.actions.toggleTaskTag(stalled.id, tags[1]!.id)
      instance.actions.updateTask(instance.getSnapshot().tasks[0]!.id, { recurrence: 'daily' })
      const other = instance.getSnapshot().tasks.find(task => task.title === '乙')!
      instance.actions.updateTask(other.id, { recurrence: 'weekday', due: '2026-11-28' })
      instance.actions.setCompleted(instance.getSnapshot().tasks[0]!.id, '2026-11-26', true)
      instance.actions.addTask('must', '上周', '2026-11-16', [], NOW)
      const lastWeek = instance.getSnapshot().tasks.find(task => task.title === '上周')!
      instance.actions.updateTask(lastWeek.id, { due: '2026-11-16' })
      instance.actions.setCompleted(lastWeek.id, '2026-11-16', true)
      instance.actions.addTask('must', '一半甲', '2026-11-20', [], NOW)
      instance.actions.addTask('must', '一半乙', '2026-11-20', [], NOW)
      const half = instance.getSnapshot().tasks.find(task => task.title === '一半甲')!
      instance.actions.updateTask(half.id, { due: '2026-11-20' })
      instance.actions.updateTask(instance.getSnapshot().tasks.find(task => task.title === '一半乙')!.id, { due: '2026-11-20' })
      instance.actions.setCompleted(half.id, '2026-11-20', true)
      instance.actions.moveToInspiration(instance.getSnapshot().tasks.find(task => task.title === '一行')!.id, 0)
    })
    fireEvent.click(screen.getByText('工作'))
    await act(async () => { await vi.advanceTimersByTimeAsync(220) })
    fireEvent.click(screen.getByText('工作'))
    await act(async () => { await vi.advanceTimersByTimeAsync(220) })
    fireEvent.doubleClick(screen.getByText('工作'))
    await act(async () => { await vi.advanceTimersByTimeAsync(220) })
    document.querySelector('span[title="说明"]')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    fireEvent.click(screen.getByRole('button', { name: '工作' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog.querySelector('button[aria-label="关闭"]')!)
    fireEvent.pointerDown(taskRow('乙'), { button: 0, clientX: 4, clientY: 4 })
    fireEvent.pointerUp(window, { clientX: 4, clientY: 4 })
    const note = screen.getAllByRole('button', { name: /正文/ }).find(button => button.textContent?.includes('AI任务'))!
    const fresh = screen.getByRole('dialog').querySelector('textarea')!
    fireEvent.click(note)
    fireEvent.keyDown(fresh, { key: 'Enter' })
    fireEvent.keyDown(fresh, { key: 'Escape' })
    fireEvent.pointerDown(taskRow('乙'), { button: 0, clientX: 8, clientY: 8 })
    fireEvent.pointerUp(window, { clientX: 8, clientY: 8 })
    fireEvent.click(screen.getAllByRole('button', { name: /正文/ }).find(button => button.textContent?.includes('AI任务'))!)
    const editor = [...document.querySelectorAll('textarea')].find(node => (node as HTMLTextAreaElement).value.includes('正文'))!
    fireEvent.keyDown(editor, { key: 'Escape' })
    change(() => {
      const plain = instance.getSnapshot().tasks.find(task => task.title === '开会')!
      instance.actions.setCompleted(plain.id, '2026-11-26', true)
      instance.actions.addTask('must', '1.', '2026-11-26', [], NOW)
    })
    fireEvent.contextMenu(taskRow('开会'), { clientX: 4, clientY: 4 })
    fireEvent.click(screen.getByRole('menuitem', { name: text('menu.decompose') }))
    fireEvent.contextMenu(taskRow('1.'), { clientX: 4, clientY: 4 })
    fireEvent.click(screen.getByRole('menuitem', { name: text('menu.classify') }))
    await act(async () => { await vi.advanceTimersByTimeAsync(40) })
    window.innerHeight = 0
    const separator = screen.getByRole('separator', { name: text('nav.tasks') })
    fireEvent.pointerDown(separator, { clientY: 10 })
    fireEvent.pointerMove(window, { clientY: 40 })
    fireEvent.pointerUp(window)
    window.innerHeight = 800
    const clear = vi.spyOn(window, 'clearInterval').mockImplementation(() => {})
    change(() => { instance.actions.setCompleted(first!, '2026-11-26', false) })
    fireEvent.click(screen.getAllByRole('button', { name: text('focus.dial') })[0]!)
    fireEvent.click(screen.getByRole('button', { name: text('focus.start') }))
    change(() => { instance.actions.deleteTask(first!) })
    fireEvent.click(screen.getByRole('button', { name: text('focus.abandon') }))
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    clear.mockRestore()
    fireEvent.click(screen.getByRole('button', { name: text('nav.stats') }))
    for (const cell of document.querySelectorAll('[data-heat-cell]')) fireEvent.mouseEnter(cell)
    rectFor.mockRestore()
  })
})
