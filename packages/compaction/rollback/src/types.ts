/**
 * Durable record and projection types for in-place edit/resend.
 *
 * The durable commit is a `user/message` shadow node (an already-known
 * event type) whose `message.source` carries the reset interval as a custom
 * `MessageSourceMap` member. No new session event discriminant, so no
 * `KNOWN_SESSION_EVENT_TYPES` or format change.
 * @module @deepseek-ai/dsh-rollback
 */

import { z as zod } from 'zod'
import type { SessionSeq } from '@deepseek-ai/dsh-session'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /** Producer marker carried by an in-place edit/resend shadow node. */
    rollback: {
      kind: 'rollback'
      /** Raw-log seq of the edited prompt; the interval ends at the commit event's own seq. */
      reset: { startSeq: SessionSeq }
    }
  }
}

/** One raw-log interval hidden from the transcript by an edit/resend. */
export interface RollbackResetInterval {
  startSeq: number
  endSeq: number
}

/** Host projection state folded from committed rollback shadow nodes. */
export interface RollbackState {
  resets: RollbackResetInterval[]
}

const sessionSeqSchema = zod.number().int().min(0)

export const rollbackResetIntervalSchema = zod.object({
  startSeq: sessionSeqSchema,
  endSeq: sessionSeqSchema,
})

export const rollbackStateSchema = zod.object({
  resets: zod.array(rollbackResetIntervalSchema),
})

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Raw-log intervals hidden from the transcript by edit/resend operations. */
    rollback: RollbackState
  }
}
