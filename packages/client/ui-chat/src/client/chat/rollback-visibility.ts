/**
 * Pure view-layer helpers that map the `rollback` projection's wire value to
 * Chat row and turn-rail visibility. The wire boundary forbids sharing code
 * with the host package, so these validators mirror its value contract.
 */

/** One validated inclusive raw-log seq interval from the rollback projection. */
export interface RollbackInterval {
  readonly startSeq: number
  readonly endSeq: number
}

/** One started turn's identity facts the rollback filter needs. */
export interface RollbackTurn {
  readonly turn: number
  readonly seq: number
}

const EMPTY_INTERVALS: readonly RollbackInterval[] = []

function isSeq(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)
}

/**
 * Validate the `rollback` projection wire value into ascending reset intervals.
 * A malformed entry or value degrades to no resets, so a damaged projection
 * never hides a transcript row.
 * @param value - the `rollback` projection value, treated as wire data.
 * @returns valid inclusive intervals, ascending by `startSeq`.
 */
export function rollbackIntervals(value: unknown): readonly RollbackInterval[] {
  if (typeof value !== 'object' || value === null) return EMPTY_INTERVALS
  const resets = (value as { resets?: unknown }).resets
  if (!Array.isArray(resets)) return EMPTY_INTERVALS
  const intervals: RollbackInterval[] = []
  for (const raw of resets) {
    if (typeof raw !== 'object' || raw === null) continue
    const item = raw as { startSeq?: unknown; endSeq?: unknown }
    if (!isSeq(item.startSeq) || !isSeq(item.endSeq) || item.endSeq < item.startSeq) continue
    intervals.push({ startSeq: item.startSeq, endSeq: item.endSeq })
  }
  intervals.sort((left, right) => left.startSeq - right.startSeq)
  return intervals
}

/**
 * Whether one raw-log seq falls inside any reset interval.
 * @param seq - the raw-log event seq to test.
 * @param intervals - validated reset intervals.
 * @returns true when the seq is rolled back.
 */
export function isRolledBackSeq(seq: number, intervals: readonly RollbackInterval[]): boolean {
  for (const interval of intervals) {
    if (seq >= interval.startSeq && seq <= interval.endSeq) return true
  }
  return false
}

/**
 * Extract the started turns, ascending, from the `turnOutline` projection wire
 * value. `seq` is the turn's `turn/start` event seq.
 * @param value - the `turnOutline` projection value, treated as wire data.
 * @returns validated turns in ascending order.
 */
export function rollbackTurnOutline(value: unknown): readonly RollbackTurn[] {
  if (!Array.isArray(value)) return []
  const turns: RollbackTurn[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue
    const entry = raw as { turn?: unknown; seq?: unknown }
    if (!isSeq(entry.turn) || !isSeq(entry.seq)) continue
    turns.push({ turn: entry.turn, seq: entry.seq })
  }
  turns.sort((left, right) => left.turn - right.turn)
  return turns
}

/**
 * Compute the rolled-back turn numbers from the turn outline and reset
 * intervals. A turn is rolled back when a reset interval [start, end] covers
 * it: its `turn/start` seq is at or before `end`, and the next turn starts
 * after `start` (the last turn has no next boundary).
 * @param turns - ascending started turns with their `turn/start` seqs.
 * @param intervals - validated reset intervals.
 * @returns turn numbers whose rail mark must be hidden.
 */
export function rolledBackTurnSet(
  turns: readonly RollbackTurn[],
  intervals: readonly RollbackInterval[],
): ReadonlySet<number> {
  const rolledBack = new Set<number>()
  if (turns.length === 0 || intervals.length === 0) return rolledBack
  for (const interval of intervals) {
    for (let index = 0; index < turns.length; index += 1) {
      const turn = turns[index]
      if (turn === undefined || turn.seq > interval.endSeq) continue
      const next = turns[index + 1]
      if (next === undefined || next.seq > interval.startSeq) rolledBack.add(turn.turn)
    }
  }
  return rolledBack
}
