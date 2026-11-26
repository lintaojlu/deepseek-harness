/** API owner delegates prompt revision to the optional same-session edit backend. */
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import RollbackService from '@deepseek-ai/dsh-rollback'
import { expect, it, onTestFinished } from 'vitest'
import { MockAdapter, textResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'
import { createSessionTestController } from './test-remote.ts'

it('reports an absent backend and edits a current prompt through the Session API when mounted', async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(AgentLoop, { agents: [] })
  const adapter = new MockAdapter([textResponse('Original answer'), textResponse('Corrected answer')])
  ctx.effect(() => ctx.llm.registerAdapter(['mock'], adapter))
  const api = await createSessionTestController(ctx, { defaultModelSelection: () => ({ provider: 'mock', model: 'mock' }), cwd: '/workspace' })
  const agent = await ctx.agentLoop.create(SessionId('api-edit'), { provider: 'mock', model: 'mock' })
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Wrong prompt' }] }))
  await agent.whenIdle()
  const target = agent.session.snapshotEvents().find(event => event.type === 'user/message' && event.data.source.kind === 'user')
  if (target === undefined) throw new Error('Missing user prompt')
  const request = { sessionId: agent.id, targetSeq: target.seq, content: [{ type: 'text' as const, text: 'Corrected prompt' }] }
  await expect(api.editPrompt(request, new AbortController().signal)).rejects.toMatchObject({ code: 'session/rollback-not-mounted' })
  await ctx.plugin(RollbackService)
  const result = await api.editPrompt(request, new AbortController().signal)
  await agent.whenIdle()
  expect(result.reset.startSeq).toBe(target.seq)
  expect(JSON.stringify(adapter.requests.at(-1)?.messages)).toContain('Corrected prompt')
  expect(JSON.stringify(adapter.requests.at(-1)?.messages)).not.toContain('Wrong prompt')
  expect(ctx.sessions.list()).toHaveLength(1)
  await expect(api.editPrompt(request, new AbortController().signal)).rejects.toMatchObject({ code: 'session/rollback-failed', details: { reason: 'target', committed: false } })
})
