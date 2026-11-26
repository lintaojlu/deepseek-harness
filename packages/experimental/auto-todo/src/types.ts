/** Request and response types for the daily tasks model settings and actions. */

/** Model settings shared with the browser. */
export interface TaskModelSettings {
  mode: 'dsh' | 'jev'
  endpoint: string
  model: string
  keyConfigured: boolean
  dshProvider: string
  dshModel: string
}

/** A settings update. Omitting key retains the key for the same endpoint. */
export interface TaskModelUpdate {
  mode: TaskModelSettings['mode']
  endpoint: string
  model: string
  key?: string
}

/** Task text and the existing tags considered for classification. */
export interface TaskClassification {
  title: string
  notes: string[]
  assignedTags: { name: string; description: string }[]
  candidates: { name: string; description: string }[]
}
