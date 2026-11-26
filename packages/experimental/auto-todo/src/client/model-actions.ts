/** Model operations injected into the browser board. */
import type { TaskClassification, TaskModelSettings, TaskModelUpdate } from '../types.ts'

/** Model routes and actions available to the board. */
export interface ModelActions {
  settings: () => Promise<TaskModelSettings>
  save: (request: TaskModelUpdate) => Promise<TaskModelSettings>
  models: (request: TaskModelUpdate, signal: AbortSignal) => Promise<string[]>
  classify: (task: TaskClassification, signal: AbortSignal) => Promise<number[]>
  describeTag: (content: string, signal: AbortSignal) => Promise<string>
}
