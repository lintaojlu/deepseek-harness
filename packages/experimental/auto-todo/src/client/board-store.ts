/**
 * Root-scoped board store. The tasks page and the stats page share one
 * persisted record, `dsh.auto-todo.board`.
 */

import { defineStore } from '@deepseek-ai/dsh-client-store'
import {
  addNote, addTask, applyClassify, applyDrop, applyStandardize, clearDay, deleteNote, deleteTag, deleteTask,
  dissolveGroup, emptyBoard, isoDate, moveToInspiration, renameGroup, resetBoard, saveTag, setCompleted,
  setInspirationStatus, setListHeight, setViewedDate, syncDay, togglePin, toggleTaskTag, updateNote, updateTask,
  type Board, type Column, type DragSubject, type DropTarget, type Inspiration, type Tag, type TaskPatch,
} from './board-model.ts'

/**
 * Create the board store handle. The framework keeps one instance for the panel.
 * @returns the store handle.
 */
export function createBoardStore() {
  return defineStore({
    init: (): Board => emptyBoard(isoDate(Date.now())),
    persist: 'dsh.auto-todo.board',
    actions: {
      addTask: (draft, column: Column, title: string, date: string, tagIds: string[], now: number) => {
        addTask(draft, column, title, date, tagIds, now)
      },
      setCompleted: (draft, id: string, date: string, done: boolean) => { setCompleted(draft, id, date, done) },
      updateTask: (draft, id: string, patch: TaskPatch) => { updateTask(draft, id, patch) },
      addNote: (draft, taskId: string, text: string) => { addNote(draft, taskId, text) },
      updateNote: (draft, taskId: string, noteId: string, text: string) => { updateNote(draft, taskId, noteId, text) },
      deleteNote: (draft, taskId: string, noteId: string) => { deleteNote(draft, taskId, noteId) },
      toggleTaskTag: (draft, taskId: string, tagId: string) => { toggleTaskTag(draft, taskId, tagId) },
      saveTag: (draft, name: string, color: string, description: string, id?: string) => {
        saveTag(draft, { name, color, description, ...(id === undefined ? {} : { id }) })
      },
      deleteTag: (draft, tagId: string) => { deleteTag(draft, tagId) },
      togglePin: (draft, tagId: string) => { togglePin(draft, tagId) },
      deleteTask: (draft, id: string) => { deleteTask(draft, id) },
      moveToInspiration: (draft, id: string, now: number) => { moveToInspiration(draft, id, now) },
      setInspirationStatus: (draft, id: string, status: Inspiration['status']) => { setInspirationStatus(draft, id, status) },
      standardize: (draft, id: string) => { applyStandardize(draft, id) },
      classify: (draft, id: string) => { applyClassify(draft, id) },
      syncDay: (draft, source: string, target: string) => { syncDay(draft, source, target) },
      clearDay: (draft, date: string) => { clearDay(draft, date) },
      renameGroup: (draft, id: string, title: string) => { renameGroup(draft, id, title) },
      dissolveGroup: (draft, id: string) => { dissolveGroup(draft, id) },
      applyDrop: (draft, subject: DragSubject, target: DropTarget) => { applyDrop(draft, subject, target) },
      setViewedDate: (draft, date: string) => { setViewedDate(draft, date) },
      setListHeight: (draft, height: number, viewport: number) => { setListHeight(draft, height, viewport) },
      reset: (draft, today: string) => { resetBoard(draft, today) },
    },
  })
}

/** Actions written by the tasks page. */
export type BoardActions = ReturnType<typeof createBoardStore>['create'] extends (...args: never[]) => infer Instance
  ? Instance extends { actions: infer Actions } ? Actions : never
  : never

/** Tag fields the settings dialog edits. Re-exported for the page's prop types. */
export type { Tag }
