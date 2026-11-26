import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createUserMessage, LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { LlmResolvedModelInfo, RequestMessage, StreamChunk } from '@deepseek-ai/dsh-llm'
import { Session, SessionId, SessionSeq, type SessionEvent } from '@deepseek-ai/dsh-session'
import * as JsonlPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import type { JobOutcome } from '@deepseek-ai/dsh-jobs'
import LocalJobRegistry from '@deepseek-ai/dsh-jobs-local'
import * as ToolJobs from '@deepseek-ai/dsh-tool-jobs'
import RollbackService from '../src/index.ts'

/** Only the external model is replaced; all session, projection, and loop owners are real. */
class ReplyAdapter extends LlmAdapter {
  readonly requests: RequestMessage[][] = []
  gate: Promise<void> | undefined
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model, context: { contextWindow: 100_000 } })
  }
  override async * stream(options: { messages: readonly RequestMessage[] }): AsyncIterable<StreamChunk> {
    this.requests.push([...options.messages])
    if (this.gate !== undefined) await this.gate
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: `Answer ${this.requests.length}` } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

const owned: Array<{ ctx: Context; root: string }> = []
afterEach(async () => {
  for (const { ctx, root } of owned.splice(0)) {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

async function harness(options: { jobs?: boolean; jobStopTimeoutMs?: number } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-edit-prompt-'))
  const ctx = new Context()
  owned.push({ ctx, root })
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(JsonlPersistence, { root: join(root, 'sessions'), compression: 'none' })
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-agent-loop', AgentLoop],
    ['@deepseek-ai/dsh-rollback', RollbackService],
    ['@deepseek-ai/dsh-jobs-local', LocalJobRegistry],
    ['@deepseek-ai/dsh-tool-jobs', ToolJobs],
  ])
  const originalLoader = ctx.loader.internal
  if (originalLoader === undefined) throw new Error('Loader module bridge unavailable')
  ctx.loader.internal = {
    ...originalLoader,
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`Unexpected module: ${specifier}`)
      return modules.get(specifier)
    },
  }
  const path = join(root, 'cordis.yml')
  const composition = [
    "- name: '@deepseek-ai/dsh-agent-loop'\n  config:\n    agents: []",
    ...(options.jobs === true ? ["- name: '@deepseek-ai/dsh-jobs-local'", "- name: '@deepseek-ai/dsh-tool-jobs'\n  config:\n    completionDelivery: quiet"] : []),
    `- name: '@deepseek-ai/dsh-rollback'\n  config:\n    jobStopTimeoutMs: ${options.jobStopTimeoutMs ?? 10_000}`,
  ]
  await writeFile(path, composition.join('\n') + '\n')
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(path).href } })
  await ctx.loader.await()
  const adapter = new ReplyAdapter()
  ctx.llm.registerAdapter(['fixture'], adapter)
  const agent = await ctx.agentLoop.create(SessionId('edit-fixture'), { provider: 'fixture', model: 'fixture' })
  const send = async (text: string) => {
    agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text }] }))
    await agent.whenIdle()
  }
  const promptSeq = (text: string) => {
    const event = agent.session.snapshotEvents().find(event => event.type === 'user/message'
      && event.data.content.some(block => block.type === 'text' && block.text === text))
    if (event === undefined) throw new Error(`Missing prompt ${text}`)
    return event.seq
  }
  return { ctx, root, agent, adapter, send, promptSeq }
}

function textHistory(messages: readonly RequestMessage[]) {
  return messages.map(message => ({ role: message.role, text: message.content.map(block => block.type === 'text' ? block.text : '').join('') }))
}

describe('same-session prompt editing through real Loader composition', () => {
  it('removes the edited prompt and all later model history, keeps files, and replays after serialization', async () => {
    const h = await harness()
    await h.send('Keep earlier context')
    await h.send('Wrong prompt')
    await h.send('Also discard this follow-up')
    const artifact = join(h.root, 'existing-artifact.txt')
    await writeFile(artifact, 'Keep this generated file')
    const id = h.agent.session.id
    const before = textHistory(h.adapter.requests.at(-1)!)
    const targetSeq = h.promptSeq('Wrong prompt')
    const result = await h.ctx.rollback.editPrompt(h.agent, {
      targetSeq, content: [{ type: 'text', text: 'Corrected prompt' }],
    }, new AbortController().signal)
    await h.agent.whenIdle()
    const after = textHistory(h.adapter.requests.at(-1)!)
    expect(h.agent.session.id).toBe(id)
    expect(h.ctx.sessions.list()).toHaveLength(1)
    expect(after.map(message => message.text)).toEqual(['You are an AI agent powered by DeepSeek Harness.', 'Keep earlier context', 'Answer 1', 'Conversation restarted.', 'Corrected prompt'])
    expect(after.some(message => message.role === 'user' && message.text === '')).toBe(false)
    expect(h.ctx.rollback.resetIntervals(h.agent.session).resets).toContainEqual(result.reset)
    expect(await readFile(artifact, 'utf8')).toBe('Keep this generated file')
    const events: SessionEvent[] = JSON.parse(JSON.stringify(h.agent.session.snapshotEvents()))
    const restored = Session.create(id, events)
    expect(restored.deriveMessages()).toEqual(h.agent.session.deriveMessages())
    await h.ctx.sessions.flush(h.agent.session)
    const stored = await h.ctx.sessionPersistence.open(id, 'read')
    try {
      const read = await stored.read()
      const diskSession = Session.create(id, read.events)
      expect(diskSession.deriveMessages()).toEqual(h.agent.session.deriveMessages())
    } finally { await stored.close() }
    await expect(JSON.stringify({ before, after }, null, 2) + '\n').toMatchFileSnapshot('./expected/edit-resend.json')
  })

  it('supports repeated edits without creating sessions or resurrecting discarded prompts', async () => {
    const h = await harness()
    await h.send('First')
    await h.send('Second')
    await h.ctx.rollback.editPrompt(h.agent, {
      targetSeq: h.promptSeq('Second'), content: [{ type: 'text', text: 'Second revised' }],
    }, new AbortController().signal)
    await h.agent.whenIdle()
    await h.ctx.rollback.editPrompt(h.agent, {
      targetSeq: h.promptSeq('First'), content: [{ type: 'text', text: 'Start again' }],
    }, new AbortController().signal)
    await h.agent.whenIdle()
    expect(textHistory(h.adapter.requests.at(-1)!)).toEqual([{ role: 'system', text: 'You are an AI agent powered by DeepSeek Harness.' }, { role: 'user', text: 'Conversation restarted.' }, { role: 'user', text: 'Start again' }])
    expect(h.ctx.sessions.list()).toHaveLength(1)
    expect(h.ctx.rollback.resetIntervals(h.agent.session).resets.length).toBeGreaterThan(0)
  })

  it('rejects stale or non-user targets without changing the surface', async () => {
    const h = await harness()
    await h.send('Original')
    const targetSeq = h.promptSeq('Original')
    await h.ctx.rollback.editPrompt(h.agent, { targetSeq, content: [{ type: 'text', text: 'Replacement' }] }, new AbortController().signal)
    await h.agent.whenIdle()
    const before = h.agent.session.deriveMessages()
    await expect(h.ctx.rollback.editPrompt(h.agent, { targetSeq, content: [{ type: 'text', text: 'Stale' }] }, new AbortController().signal)).rejects.toMatchObject({ code: 'target' })
    await expect(h.ctx.rollback.editPrompt(h.agent, { targetSeq: SessionSeq(0), content: [{ type: 'text', text: 'Bad target' }] }, new AbortController().signal)).rejects.toMatchObject({ code: 'target' })
    expect(h.agent.session.deriveMessages()).toEqual(before)
  })

  it('rejects empty edits and cancelled requests before changing history', async () => {
    const h = await harness()
    await h.send('Original')
    const before = h.agent.session.deriveMessages()
    const targetSeq = h.promptSeq('Original')
    await expect(h.ctx.rollback.editPrompt(h.agent, { targetSeq, content: [{ type: 'text', text: '  ' }] }, new AbortController().signal)).rejects.toMatchObject({ code: 'content' })
    const cancelled = new AbortController()
    cancelled.abort(new Error('Cancelled by caller'))
    await expect(h.ctx.rollback.editPrompt(h.agent, { targetSeq, content: [{ type: 'text', text: 'New' }] }, cancelled.signal)).rejects.toThrow('Cancelled by caller')
    expect(h.agent.session.deriveMessages()).toEqual(before)
  })

  it('stops owned jobs and waits for settlement before committing the reset', async () => {
    const h = await harness({ jobs: true })
    await h.send('Original')
    const done = Promise.withResolvers<JobOutcome>()
    const cancelled = Promise.withResolvers<undefined>()
    const id = h.ctx.jobs.start({
      kind: 'bash', label: 'old background work', owner: h.agent.id,
      run: () => ({ done: done.promise, cancel: () => { cancelled.resolve(undefined) } }),
    })
    const before = h.agent.session.deriveMessages()
    const edit = h.ctx.rollback.editPrompt(h.agent, {
      targetSeq: h.promptSeq('Original'), content: [{ type: 'text', text: 'Revised' }],
    }, new AbortController().signal)
    try {
      await cancelled.promise
      expect(h.ctx.jobs.get(id, h.agent.id).status).toBe('stopping')
      expect(h.agent.session.deriveMessages()).toEqual(before)
    } finally {
      done.resolve({ status: 'killed', result: 'Discard this old result' })
      await edit
      await h.agent.whenIdle()
    }
    expect(h.ctx.jobs.get(id, h.agent.id).status).toBe('killed')
    const history = textHistory(h.adapter.requests.at(-1)!)
    expect(history.map(message => message.text)).toEqual([
      expect.any(String), 'Conversation restarted.', 'Revised',
    ])
    await expect(JSON.stringify(history, null, 2) + '\n').toMatchFileSnapshot('./expected/edit-stops-jobs.json')
  })

  it('ignores unowned jobs and removes already queued completion notices', async () => {
    const h = await harness({ jobs: true })
    await h.send('Original')
    const shared = Promise.withResolvers<JobOutcome>()
    let sharedCancels = 0
    const sharedId = h.ctx.jobs.start({
      kind: 'bash', label: 'shared server',
      run: () => ({ done: shared.promise, cancel: () => { sharedCancels++; shared.resolve({ status: 'killed' }) } }),
    })
    const done = Promise.withResolvers<JobOutcome>()
    const id = h.ctx.jobs.start({
      kind: 'bash', label: 'finished old job', owner: h.agent.id,
      run: () => ({ done: done.promise, cancel: () => done.resolve({ status: 'killed' }) }),
    })
    const notified = Promise.withResolvers<undefined>()
    h.ctx.on('agent/inbox/inserted', ({ message }) => {
      if (message.source.kind === 'tool-jobs') notified.resolve(undefined)
    })
    done.resolve({ status: 'completed', result: 'Stale result' })
    await notified.promise
    expect(h.ctx.jobs.get(id, h.agent.id).status).toBe('completed')
    await h.ctx.rollback.editPrompt(h.agent, {
      targetSeq: h.promptSeq('Original'), content: [{ type: 'text', text: 'Revised' }],
    }, new AbortController().signal)
    await h.agent.whenIdle()
    expect(textHistory(h.adapter.requests.at(-1)!).map(message => message.text)).toEqual([
      expect.any(String), 'Conversation restarted.', 'Revised',
    ])
    expect(h.ctx.jobs.get(sharedId).status).toBe('running')
    expect(sharedCancels).toBe(0)
    shared.resolve({ status: 'completed' })
    await h.ctx.jobs.wait(sharedId, 10_000)
  })

  it('keeps history intact when a job does not settle before the stop deadline', async () => {
    const h = await harness({ jobs: true, jobStopTimeoutMs: 1 })
    await h.send('Original')
    const done = Promise.withResolvers<JobOutcome>()
    const id = h.ctx.jobs.start({
      kind: 'bash', label: 'slow shutdown', owner: h.agent.id,
      run: () => ({ done: done.promise, cancel: () => {} }),
    })
    const before = h.agent.session.deriveMessages()
    try {
      await expect(h.ctx.rollback.editPrompt(h.agent, {
        targetSeq: h.promptSeq('Original'), content: [{ type: 'text', text: 'Revised' }],
      }, new AbortController().signal)).rejects.toMatchObject({ code: 'busy' })
      expect(h.agent.session.deriveMessages()).toEqual(before)
      expect(h.ctx.rollback.resetIntervals(h.agent.session).resets).toEqual([])
    } finally {
      done.resolve({ status: 'killed' })
      await h.ctx.jobs.wait(id, 10_000, h.agent.id)
    }
  })

  it('does not reset history when cancellation arrives while a job is stopping', async () => {
    const h = await harness({ jobs: true })
    await h.send('Original')
    const done = Promise.withResolvers<JobOutcome>()
    const cancelled = Promise.withResolvers<undefined>()
    const id = h.ctx.jobs.start({
      kind: 'bash', label: 'shutdown in progress', owner: h.agent.id,
      run: () => ({ done: done.promise, cancel: () => { cancelled.resolve(undefined) } }),
    })
    const before = h.agent.session.deriveMessages()
    const controller = new AbortController()
    const edit = h.ctx.rollback.editPrompt(h.agent, {
      targetSeq: h.promptSeq('Original'), content: [{ type: 'text', text: 'Revised' }],
    }, controller.signal)
    const rejected = expect(edit).rejects.toThrow('Edit cancelled')
    try {
      await cancelled.promise
      controller.abort(new Error('Edit cancelled'))
      await rejected
      expect(h.agent.session.deriveMessages()).toEqual(before)
    } finally {
      done.resolve({ status: 'killed' })
      await h.ctx.jobs.wait(id, 10_000, h.agent.id)
    }
  })

  it('collects immediate job cancellation and rejects stale targets before stopping work', async () => {
    const h = await harness({ jobs: true })
    await h.send('Original')
    const done = Promise.withResolvers<JobOutcome>()
    let cancels = 0
    const id = h.ctx.jobs.start({
      kind: 'bash', label: 'immediate shutdown', owner: h.agent.id,
      run: () => ({ done: done.promise, cancel: () => { cancels++; done.resolve({ status: 'killed' }) } }),
    })
    const content = [{ type: 'text' as const, text: 'Revised' }]
    await expect(h.ctx.rollback.editPrompt(h.agent, {
      targetSeq: SessionSeq(999999), content,
    }, new AbortController().signal)).rejects.toMatchObject({ code: 'target' })
    expect(cancels).toBe(0)
    await h.ctx.rollback.editPrompt(h.agent, {
      targetSeq: h.promptSeq('Original'), content,
    }, new AbortController().signal)
    await h.agent.whenIdle()
    expect(h.ctx.jobs.get(id, h.agent.id).status).toBe('killed')
    expect(textHistory(h.adapter.requests.at(-1)!).map(message => message.text)).toEqual([
      expect.any(String), 'Conversation restarted.', 'Revised',
    ])
  })

  it('preserves history when a producer refuses cancellation', async () => {
    const h = await harness({ jobs: true, jobStopTimeoutMs: 1 })
    await h.send('Original')
    const done = Promise.withResolvers<JobOutcome>()
    const id = h.ctx.jobs.start({
      kind: 'bash', label: 'failed cancellation', owner: h.agent.id,
      run: () => ({ done: done.promise, cancel: () => { throw new Error('Cancel failed') } }),
    })
    const before = h.agent.session.deriveMessages()
    try {
      await expect(h.ctx.rollback.editPrompt(h.agent, {
        targetSeq: h.promptSeq('Original'), content: [{ type: 'text', text: 'Revised' }],
      }, new AbortController().signal)).rejects.toMatchObject({ code: 'busy', cause: { message: 'Cancel failed' } })
      expect(h.agent.session.deriveMessages()).toEqual(before)
      expect(h.ctx.jobs.get(id, h.agent.id).status).toBe('running')
    } finally {
      done.resolve({ status: 'completed' })
      await h.ctx.jobs.wait(id, 10_000, h.agent.id)
    }
  })

  it('waits for already stopping jobs without cancelling them twice', async () => {
    const h = await harness({ jobs: true })
    await h.send('Original')
    const done = Promise.withResolvers<JobOutcome>()
    let cancels = 0
    const id = h.ctx.jobs.start({
      kind: 'bash', label: 'already stopping', owner: h.agent.id,
      run: () => ({ done: done.promise, cancel: () => { cancels++ } }),
    })
    h.ctx.jobs.kill(id, h.agent.id)
    const edit = h.ctx.rollback.editPrompt(h.agent, {
      targetSeq: h.promptSeq('Original'), content: [{ type: 'text', text: 'Revised' }],
    }, new AbortController().signal)
    done.resolve({ status: 'killed' })
    await edit
    await h.agent.whenIdle()
    expect(cancels).toBe(1)
    expect(textHistory(h.adapter.requests.at(-1)!).map(message => message.text)).toEqual([
      expect.any(String), 'Conversation restarted.', 'Revised',
    ])
  })

  it('rejects editing while a model response is still running', async () => {
    const h = await harness()
    await h.send('Original')
    const gate = Promise.withResolvers<undefined>()
    h.adapter.gate = gate.promise
    h.agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Running' }] }))
    await new Promise<void>((resolve) => {
      if (h.agent.status === 'running') { resolve(); return }
      const stop = h.ctx.on('agent/status', ({ status }) => { if (status === 'running') { stop(); resolve() } })
    })
    try {
      await expect(h.ctx.rollback.editPrompt(h.agent, { targetSeq: h.promptSeq('Original'), content: [{ type: 'text', text: 'New' }] }, new AbortController().signal)).rejects.toMatchObject({ code: 'busy' })
    } finally {
      gate.resolve(undefined)
      await h.agent.whenIdle()
    }
  })
})
