/**
 * First-run board. `seed/board.json` matches `data/board.json`, the CEOS copy.
 * A board already stored in this browser is left as it is.
 */

import seed from './seed/board.json' with { type: 'json' }
import { isBoard, type Board } from './board-model.ts'

/** Storage key shared with the tasks store. */
export const BOARD_STORAGE_KEY = 'dsh.auto-todo.board'

/**
 * Write the copied board when this browser has none yet.
 * @returns nothing.
 */
export function installBoardSeed(): void {
  /* v8 ignore next -- node tests have no localStorage. */
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(BOARD_STORAGE_KEY) !== null) return
  const board = seed as Board
  /* v8 ignore next -- data/board.json is a version-1 board. */
  if (!isBoard(board)) return
  localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(board))
}
