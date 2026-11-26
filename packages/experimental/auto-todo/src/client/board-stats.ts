/**
 * Completion, streak, tag, and inspiration figures for the stats page.
 * Rates count must-do tasks only. A day with no must-do tasks is left out
 * of a rate. A day counts as active when any visible task is checked.
 */

import {
  addDays, elapsedDays, type Board, type Column, mustOn, visibleOn, weekdayIndex, weekStart,
} from './board-model.ts'

/** Must-do totals over an inclusive date range. */
export interface RateWindow {
  /** Checked must-do occurrences. */
  done: number
  /** Visible must-do occurrences. Zero means the window has no rate. */
  total: number
  /** `done / total`, or null when `total` is zero. */
  rate: number | null
}

/** Streak figures through today. */
export interface Activity {
  /** Days, through today, on which at least one task was checked. */
  activeDays: number
  /** Current run of active days. Today is excluded until it has a completion. */
  current: number
  /** Longest run of active days. */
  longest: number
  /** Weekday index with the lowest must-do rate, or null when no must-do day exists. */
  weakest: number | null
}

/** Tagged-task completion and tags with no completion in the last 7 days. */
export interface TagInsight {
  /** Completed tagged occurrences, or null when the board has no tags. */
  completed: number | null
  /** Names of tags that had a visible task in the last 7 days and no completion. */
  stalled: string[]
}

/** Inspiration inventory. */
export interface IdeaInsight {
  /** Items on the inspiration list. */
  total: number
  /** Items that are not archived. */
  normal: number
  /** Archived items. */
  archived: number
  /** Mean age in days of normal items at least a day old, or null when none are lingering. */
  dwell: number | null
}

/** Heatmap color band. */
export type HeatBand = 'none' | 'zero' | 'low' | 'mid' | 'high' | 'future'

/** One heatmap day. */
export interface HeatCell {
  /** Calendar date. */
  date: string
  /** Color band. */
  band: HeatBand
  /** Checked must-do tasks. */
  done: number
  /** Visible must-do tasks. */
  total: number
}

/** One heatmap week, Sunday through Saturday. */
export interface HeatWeek {
  /** Seven days. */
  days: HeatCell[]
  /** Month number to print under the column, or null when the column is unlabeled. */
  month: number | null
}

/**
 * Sum must-do completion over an inclusive range.
 * @param board - board.
 * @param start - first date.
 * @param end - last date.
 * @returns totals and the rate. The rate is null when no must-do task falls in the range.
 */
export function rateBetween(board: Board, start: string, end: string): RateWindow {
  let done = 0
  let total = 0
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const day = mustOn(board, date)
    done += day.done
    total += day.total
  }
  return { done, total, rate: total === 0 ? null : done / total }
}

/**
 * Round a rate to a percentage.
 * @param rate - fraction, or null.
 * @returns a percentage from 0 to 100, or null.
 */
export function percentOf(rate: number | null): number | null {
  return rate === null ? null : Math.round(rate * 100)
}

function isActive(board: Board, date: string): boolean {
  return board.tasks.some(task => visibleOn(task, date) && task.completedDates.includes(date))
}

function hasTasks(board: Board, date: string): boolean {
  return board.tasks.some(task => visibleOn(task, date))
}

function earliest(board: Board): string | null {
  let first: string | null = null
  for (const task of board.tasks) {
    const candidate = task.extraDates.reduce((min, date) => date < min ? date : min, task.start)
    if (first === null || candidate < first) first = candidate
  }
  return first
}

function streakBack(board: Board, end: string, first: string): number {
  let count = 0
  for (let date = end; date >= first; date = addDays(date, -1)) {
    if (isActive(board, date)) count += 1
    else if (hasTasks(board, date)) break
  }
  return count
}

/**
 * Active-day counts and the weekday with the lowest must-do rate.
 * @param board - board.
 * @param today - today's date. Days after it are ignored.
 * @returns the activity summary.
 */
export function activity(board: Board, today: string): Activity {
  const first = earliest(board)
  if (first === null || first > today) return { activeDays: 0, current: 0, longest: 0, weakest: null }
  let activeDays = 0
  let run = 0
  let longest = 0
  const buckets = Array.from({ length: 7 }, () => ({ done: 0, total: 0 }))
  for (let date = first; date <= today; date = addDays(date, 1)) {
    if (isActive(board, date)) {
      activeDays += 1
      run += 1
      longest = Math.max(longest, run)
    } else if (hasTasks(board, date)) run = 0
    const day = mustOn(board, date)
    const bucket = buckets[weekdayIndex(date)]
    if (bucket === undefined) continue
    bucket.done += day.done
    bucket.total += day.total
  }
  const end = isActive(board, today) ? today : addDays(today, -1)
  const current = end < first ? 0 : streakBack(board, end, first)
  let weakest: number | null = null
  let weakestRate = 2
  buckets.forEach((bucket, index) => {
    if (bucket.total === 0) return
    const rate = bucket.done / bucket.total
    if (rate < weakestRate) {
      weakestRate = rate
      weakest = index
    }
  })
  return { activeDays, current, longest, weakest }
}

/**
 * Tagged completion, plus tags that were visible this week and not checked.
 * @param board - board.
 * @param today - today's date.
 * @returns the tag summary. `completed` is null when no tag exists.
 */
export function tagInsight(board: Board, today: string): TagInsight {
  if (board.tags.length === 0) return { completed: null, stalled: [] }
  let completed = 0
  for (const task of board.tasks) {
    if (task.tagIds.length === 0) continue
    for (const date of task.completedDates) {
      if (date <= today && visibleOn(task, date)) completed += 1
    }
  }
  const start = addDays(today, -6)
  const stalled = board.tags.filter((tag) => {
    let seen = false
    let progressed = false
    for (let date = start; date <= today; date = addDays(date, 1)) {
      for (const task of board.tasks) {
        if (!task.tagIds.includes(tag.id) || !visibleOn(task, date)) continue
        seen = true
        if (task.completedDates.includes(date)) progressed = true
      }
    }
    return seen && !progressed
  }).map(tag => tag.name)
  return { completed, stalled }
}

/**
 * Inspiration counts and the mean age of lingering items.
 * @param board - board.
 * @param now - current time in epoch milliseconds.
 * @returns the inspiration summary.
 */
export function ideaInsight(board: Board, now: number): IdeaInsight {
  const normal = board.inspiration.filter(item => item.status === 'normal')
  const lingering = normal
    .map(item => elapsedDays(now, item.movedAt))
    .filter(days => days >= 1)
  const dwell = lingering.length === 0
    ? null
    : Math.round(lingering.reduce((sum, days) => sum + days, 0) / lingering.length)
  return {
    total: board.inspiration.length,
    normal: normal.length,
    archived: board.inspiration.length - normal.length,
    dwell,
  }
}

/**
 * Heatmap band for one day's must-do rate.
 * @param done - checked must-do tasks.
 * @param total - visible must-do tasks.
 * @param future - whether the date is after today.
 * @returns the band. Future days stay empty even when tasks already fall on them.
 */
export function heatBand(done: number, total: number, future: boolean): HeatBand {
  if (future) return 'future'
  if (total === 0) return 'none'
  if (done === 0) return 'zero'
  const rate = done / total
  if (rate <= 0.4) return 'low'
  if (rate <= 0.8) return 'mid'
  return 'high'
}

/**
 * First date the heatmap may scroll to.
 * @param board - board.
 * @param today - today's date.
 * @returns at least 53 weeks before today, or earlier when a task starts earlier.
 */
export function heatOrigin(board: Board, today: string): string {
  const floor = addDays(today, -53 * 7)
  const first = earliest(board)
  return first !== null && first < floor ? first : floor
}

/**
 * Build the visible heatmap weeks ending at `end`.
 * @param board - board.
 * @param today - today's date. Later dates are future cells.
 * @param end - Sunday of the last visible week.
 * @param count - number of week columns.
 * @returns weeks from oldest to newest. The first column and each month change carry a month number.
 */
export function heatWeeks(board: Board, today: string, end: string, count: number): HeatWeek[] {
  const weeks: HeatWeek[] = []
  for (let index = count - 1; index >= 0; index -= 1) {
    const start = addDays(end, -7 * index)
    const days: HeatCell[] = []
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(start, offset)
      const counts = mustOn(board, date)
      days.push({
        date,
        done: counts.done,
        total: counts.total,
        band: heatBand(counts.done, counts.total, date > today),
      })
    }
    const firstOfMonth = days.find(day => day.date.endsWith('-01'))
    const month = firstOfMonth !== undefined
      ? Number(firstOfMonth.date.slice(5, 7))
      : weeks.length === 0 ? Number(start.slice(5, 7)) : null
    weeks.push({ days, month })
  }
  return weeks
}

/**
 * Keep a heatmap page inside the scrollable range.
 * @param candidate - Sunday of the proposed last visible week.
 * @param today - today's date.
 * @param origin - earliest date the map covers.
 * @returns the Sunday of the last visible week, never after this week or before the origin's week.
 */
export function clampHeatEnd(candidate: string, today: string, origin: string): string {
  const max = weekStart(today)
  const min = weekStart(origin)
  if (candidate > max) return max
  if (candidate < min) return min
  return candidate
}

/**
 * Must-do completion ratio for the tasks visible on a date.
 * @param board - board.
 * @param date - date.
 * @param column - column. Only `must` feeds the ring. Optional returns null.
 * @returns a fraction, or null when that column has nothing to count.
 */
export function columnRate(board: Board, date: string, column: Column): number | null {
  if (column !== 'must') return null
  const day = mustOn(board, date)
  return day.total === 0 ? null : day.done / day.total
}
