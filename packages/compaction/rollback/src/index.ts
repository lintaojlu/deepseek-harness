/**
 * In-place edit/resend of a historical human prompt, same Session.
 *
 * The durable commit is one `user/message` shadow node whose `surfaceOp:
 * replace` hides the tail from the model surface. Its content provides a
 * brief restart marker instead of an empty wire message, and its
 * `message.source` carries the reset start so the `rollback` projection can
 * fold the transcript-hiding interval. No new session event discriminant.
 * @module @deepseek-ai/dsh-rollback
 */

import { z } from 'zod'
import { Context, Service } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { toolPairingBalancedBefore } from '@deepseek-ai/dsh-compaction'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { Session, SessionSeq } from '@deepseek-ai/dsh-session'
import type { ProjectionHandle } from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/dsh-jobs'
import {
  rollbackStateSchema,
  type RollbackResetInterval,
  type RollbackState,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Optional same-session prompt edit/resend service. */
    rollback: RollbackService
  }
}

/** Input for one in-place edit/resend. */
export interface EditPromptInput {
  /** Raw-log seq of the human prompt to edit. */
  readonly targetSeq: SessionSeq
  /** Full edited content, including preserved image/file blocks. */
  readonly content: readonly ContentBlock[]
}

/** Result of one committed edit/resend. */
export interface EditPromptResult {
  /** Raw-log interval the transcript must hide. */
  readonly reset: RollbackResetInterval
}

/** Stable failure classes for one edit/resend attempt. */
export type RollbackErrorCode = 'busy' | 'target' | 'content' | 'unbalanced' | 'committed'

/** Typed edit/resend failure, mapped to RemoteError codes by the API owner. */
export class RollbackError extends Error {
  override readonly name = 'RollbackError'

  constructor(
    readonly code: RollbackErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

/** Whether edited content carries any non-whitespace text or an attachment. */
function hasMeaningfulContent(content: readonly ContentBlock[]): boolean {
  for (const block of content) {
    if (block.type === 'text') {
      if (block.text.trim().length > 0) return true
    } else {
      return true
    }
  }
  return false
}

/** Bounds for stopping work before a transcript reset. */
export interface Config {
  /** Maximum wait for owned jobs to settle, in milliseconds; omission uses 10000. */
  jobStopTimeoutMs?: number
}

/**
 * Backend service for in-place edit/resend. Mounts as `ctx.rollback`.
 */
export class RollbackService extends Service {
  static inject = ['sessions', 'sessionProjections']
  static Config = z.object({
    jobStopTimeoutMs: z.number().int().positive().max(2_147_483_647).default(10_000),
  }).prefault({})

  private projection!: ProjectionHandle<RollbackState>
  private readonly jobStopTimeoutMs: number

  constructor(ctx: Context, config: Config) {
    super(ctx, 'rollback')
    const timeout = config.jobStopTimeoutMs
    if (timeout === undefined) throw new Error('rollback jobStopTimeoutMs is missing after config parse')
    this.jobStopTimeoutMs = timeout
  }

  protected async [Service.init](): Promise<void> {
    this.projection = await this.ctx.sessionProjections.register({
      key: 'rollback',
      stateVersion: 1,
      stateSchema: rollbackStateSchema,
      init: (): RollbackState => ({ resets: [] }),
      apply: (state, event): RollbackState => {
        if (event.type !== 'user/message') return state
        const source = event.data.source
        if (source.kind !== 'rollback') return state
        // The commit event's own seq is the end of the hidden interval.
        return {
          resets: [...state.resets, { startSeq: source.reset.startSeq, endSeq: event.seq }],
        }
      },
      wire: {
        viewSchema: rollbackStateSchema,
        view: state => state,
      },
    })
  }

  /**
   * Read the current reset intervals for one Session (host-only).
   * @param session - Session whose projected reset state is read.
   * @returns the folded reset intervals.
   */
  resetIntervals(session: Session): RollbackState {
    return this.projection.stateOf(session)
  }

  /**
   * Edit and re-enqueue one historical human prompt in place. Stops owned jobs
   * within the configured deadline before committing; unrelated jobs continue.
   * A failed stop leaves history intact, but cancellation already requested for
   * jobs is not undone. A committed reset discards all pending inbox input.
   * @param agent - idle agent whose Session is mutated.
   * @param input - raw-log target seq and the full edited content.
   * @param signal - cancellation scoped to this request.
   * @returns the reset interval to hide from the transcript.
   */
  async editPrompt(agent: Agent, input: EditPromptInput, signal: AbortSignal): Promise<EditPromptResult> {
    let maintenance: Promise<EditPromptResult>
    try {
      maintenance = agent.runMaintenance(agentSignal => this.operate(agent, input, AbortSignal.any([signal, agentSignal])))
    } catch (error: unknown) {
      throw new RollbackError('busy', 'edit is unavailable while the agent is active', { cause: error })
    }
    return await maintenance
  }

  /** Validate a cut against the current model history. */
  private resetRange(session: Session, targetSeq: SessionSeq) {
    const nodes = session.surface.nodes
    const targetIdx = nodes.indexOf(targetSeq)
    if (targetIdx < 0) {
      throw new RollbackError('target', 'target prompt is not on the current surface')
    }
    const targetEvent = session.eventAt(targetSeq)
    if (targetEvent?.type !== 'user/message' || targetEvent.data.source.kind !== 'user') {
      throw new RollbackError('target', 'target is not a human prompt')
    }
    if (!toolPairingBalancedBefore(session, targetSeq)) {
      throw new RollbackError('unbalanced', 'an unfinished tool call crosses the cut')
    }
    const shadowed = nodes.slice(targetIdx)
    const startSeq = shadowed[0]
    const endSeq = shadowed[shadowed.length - 1]
    if (startSeq === undefined || endSeq === undefined) {
      throw new RollbackError('target', 'empty shadow range')
    }
    return { shadowed, startSeq, endSeq }
  }

  /** Perform the idle-session edit, atomically committing one shadow node. */
  private async operate(agent: Agent, input: EditPromptInput, signal: AbortSignal): Promise<EditPromptResult> {
    signal.throwIfAborted()
    if (!hasMeaningfulContent(input.content)) {
      throw new RollbackError('content', 'edited content must contain non-whitespace text or an attachment')
    }
    const session = agent.session
    this.resetRange(session, input.targetSeq)

    // Revalidate the cut after asynchronous work has settled.
    const subagents = this.ctx.get('subagents')
    if (subagents !== undefined) {
      const descendants = await subagents.listDescendants(session.id, signal)
      if (descendants.some(entry => entry.kind === 'child' && entry.activity === 'running')) {
        throw new RollbackError('busy', 'an active subagent would contaminate the reset transcript')
      }
    }
    const jobs = this.ctx.get('jobs')
    if (jobs !== undefined) {
      const active = jobs.list(session.id).filter(job => job.owner === session.id
        && (job.status === 'running' || job.status === 'stopping'))
      // Register waits before cancellation so synchronous settlement is collected
      // rather than delivered as fresh input by the job completion reporter.
      const waits = active.map(job => jobs.wait(job.id, this.jobStopTimeoutMs, session.id, signal))
      try {
        for (const job of active) {
          if (job.status === 'running') jobs.kill(job.id, session.id, 'Conversation restarted by editing a prompt')
        }
      } catch (error: unknown) {
        await Promise.allSettled(waits)
        signal.throwIfAborted()
        throw new RollbackError('busy', 'Could not stop background work. Stop the session’s jobs and retry editing.', { cause: error })
      }
      const stopped = await Promise.all(waits).catch((error: unknown) => {
        signal.throwIfAborted()
        throw error
      })
      if (stopped.some(job => job.status === 'running' || job.status === 'stopping')) {
        throw new RollbackError('busy', 'Background work is still stopping. Wait for the session’s jobs to finish, then retry editing.')
      }
    }
    signal.throwIfAborted()

    // From here the surface read, validation, and commit are synchronous.
    const { shadowed, startSeq, endSeq } = this.resetRange(session, input.targetSeq)

    // Replay a brief transparent restart marker as the replacement, never empty.
    const restartContent: ContentBlock[] = [{ type: 'text', text: 'Conversation restarted.' }]
    const replacement = createUserMessage({
      content: restartContent,
      source: { kind: 'rollback', reset: { startSeq: input.targetSeq } },
    })
    const commitEvent = session.append('user/message', replacement, {
      surfaceOp: { op: 'replace', startSeq, endSeq },
      sourceEventSeqs: [...shadowed],
    })

    try {
      agent.inbox.clear()
      const edited = createUserMessage({ content: input.content, source: { kind: 'user' } })
      agent.followup(edited)
      await this.ctx.sessions.flush(session)
    } catch (error: unknown) {
      signal.throwIfAborted()
      throw new RollbackError('committed', 'reset committed; resend is pending', { cause: error })
    }

    return { reset: { startSeq: input.targetSeq, endSeq: commitEvent.seq } }
  }
}

export default RollbackService
