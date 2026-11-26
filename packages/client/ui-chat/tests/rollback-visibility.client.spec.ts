import { describe, expect, it } from 'vitest'
import {
  isRolledBackSeq, rollbackIntervals, rollbackTurnOutline, rolledBackTurnSet,
} from '../src/client/chat/rollback-visibility.ts'

describe('rollbackIntervals', () => {
  it('accepts a valid single interval', () => {
    expect(rollbackIntervals({ resets: [{ startSeq: 3, endSeq: 7 }] })).toEqual([
      { startSeq: 3, endSeq: 7 },
    ])
  })

  it('sorts intervals ascending by startSeq', () => {
    expect(rollbackIntervals({ resets: [{ startSeq: 9, endSeq: 12 }, { startSeq: 1, endSeq: 2 }] })).toEqual([
      { startSeq: 1, endSeq: 2 }, { startSeq: 9, endSeq: 12 },
    ])
  })

  it('drops malformed entries but keeps valid ones', () => {
    expect(rollbackIntervals({ resets: [
      { startSeq: 1, endSeq: 2 },
      { startSeq: -1, endSeq: 5 },
      { startSeq: 'x', endSeq: 5 },
      { startSeq: 5, endSeq: 3 },
      { startSeq: 1.5, endSeq: 4 },
      { startSeq: 2, endSeq: NaN },
      null,
    ] })).toEqual([{ startSeq: 1, endSeq: 2 }])
  })

  it('degrades to empty for absent, non-object, or non-array resets', () => {
    expect(rollbackIntervals(undefined)).toEqual([])
    expect(rollbackIntervals(null)).toEqual([])
    expect(rollbackIntervals(7)).toEqual([])
    expect(rollbackIntervals({})).toEqual([])
    expect(rollbackIntervals({ resets: 'nope' })).toEqual([])
  })
})

describe('isRolledBackSeq', () => {
  const intervals = [{ startSeq: 3, endSeq: 7 }, { startSeq: 10, endSeq: 12 }]

  it('matches inclusive endpoints', () => {
    expect(isRolledBackSeq(3, intervals)).toBe(true)
    expect(isRolledBackSeq(7, intervals)).toBe(true)
    expect(isRolledBackSeq(10, intervals)).toBe(true)
    expect(isRolledBackSeq(12, intervals)).toBe(true)
  })

  it('misses outside and between intervals', () => {
    expect(isRolledBackSeq(2, intervals)).toBe(false)
    expect(isRolledBackSeq(8, intervals)).toBe(false)
    expect(isRolledBackSeq(13, intervals)).toBe(false)
  })

  it('is false for empty intervals', () => {
    expect(isRolledBackSeq(3, [])).toBe(false)
  })
})

describe('rollbackTurnOutline', () => {
  it('extracts turn and seq, ascending', () => {
    expect(rollbackTurnOutline([
      { turn: 2, seq: 30 }, { turn: 0, seq: 10 }, { turn: 1, seq: 20 },
    ])).toEqual([
      { turn: 0, seq: 10 }, { turn: 1, seq: 20 }, { turn: 2, seq: 30 },
    ])
  })

  it('drops malformed entries and degrades non-arrays to empty', () => {
    expect(rollbackTurnOutline([
      { turn: 0, seq: 10 }, { turn: 'x', seq: 20 }, { turn: 1 }, { turn: 2, seq: -1 }, null,
    ])).toEqual([{ turn: 0, seq: 10 }])
    expect(rollbackTurnOutline(undefined)).toEqual([])
    expect(rollbackTurnOutline({})).toEqual([])
  })
})

describe('rolledBackTurnSet', () => {
  // turn/start seqs precede each turn's messages: a turn opened at seq N has its
  // first prompt after N, so a reset [start, end] begins after the first
  // rolled-back turn's turn/start.
  const turns = [
    { turn: 0, seq: 10 },
    { turn: 1, seq: 20 },
    { turn: 2, seq: 30 },
    { turn: 3, seq: 40 },
  ]

  it('hides a single rolled-back turn', () => {
    // Reset [31, 39] covers turn 2 (turn/start 30 < 31; next turn starts at 40 > 31).
    expect([...rolledBackTurnSet(turns, [{ startSeq: 31, endSeq: 39 }])]).toEqual([2])
  })

  it('hides the last turn when no next turn exists', () => {
    const last = turns.slice(0, 3)
    expect([...rolledBackTurnSet(last, [{ startSeq: 31, endSeq: 35 }])]).toEqual([2])
  })

  it('hides a multi-turn reset', () => {
    // Reset [21, 39] covers turns 1 and 2.
    expect([...rolledBackTurnSet(turns, [{ startSeq: 21, endSeq: 39 }])]).toEqual([1, 2])
  })

  it('merges across multiple intervals', () => {
    expect([...rolledBackTurnSet(turns, [
      { startSeq: 11, endSeq: 19 },
      { startSeq: 31, endSeq: 39 },
    ])]).toEqual([0, 2])
  })

  it('returns empty for no turns or no intervals', () => {
    expect([...rolledBackTurnSet([], [{ startSeq: 1, endSeq: 2 }])]).toEqual([])
    expect([...rolledBackTurnSet(turns, [])]).toEqual([])
  })
})
