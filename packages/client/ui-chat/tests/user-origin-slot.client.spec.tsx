// @vitest-environment jsdom
/**
 * The official user renderer owns the source-decoration chain above its bubble.
 * Steering rows do not render the chain; changing its occupant preserves the
 * existing message content and actions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type {
  ChatConversationViewNode, SteeringMessageNode, UserMessageNode,
} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { ChatNodeViewProps, UserContentInput } from '../src/client/contract/slots.ts'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import { UserMessageNodeView } from '../src/client/chat/MessageItem.tsx'
import { zh } from '../src/client/locale.ts'
import { createUserContentFixture } from './user-content-component-fixture.tsx'
import { unusedImageLoader } from './reasoning-component-fixture.tsx'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const t: ChatNodeViewProps['t'] = makeTranslate(zh, commonZh)
type UserSlots = PropsRenderSlots<'conversation.chat.user.before'>
const userSlots: UserSlots = {
  renderSlot: () => null,
  renderSlotChain: (_key, _owner, opts) => opts?.fallback ?? null,
  SessionProvider: ({ children }) => <>{children}</>,
}

/** One durable source, unread by Chat itself. */
const SHARED = { kind: 'user', principal: { kind: 'share-viewer', shareId: 'share-1', actor: { subjectId: 'subject-42' } } }

let renderUserContent: ReturnType<typeof createUserContentFixture>
beforeEach(() => {
  renderUserContent = createUserContentFixture()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
})

const renderUserFactory: ChatNodeViewProps['renderFactorySlot'] = (name, input) => {
  if (name !== 'conversation.chat.user.content') throw new Error(`Unexpected Chat Factory: ${name}`)
  return renderUserContent(input as UserContentInput, () => null, t)
}

function viewProps(data: UserMessageNode): ChatNodeViewProps<'user'>
function viewProps(data: SteeringMessageNode): ChatNodeViewProps<'steering'>
function viewProps(data: UserMessageNode | SteeringMessageNode): ChatNodeViewProps<'user' | 'steering'> {
  const node = {
    key: `fixture:${data.kind}:${String(data.seq)}`,
    id: String(data.seq),
    kind: data.kind,
    target: 'chat',
    anchorSeq: data.seq,
    location: { kind: 'session' },
    visibility: 'visible',
    data,
  } as ChatConversationViewNode
  const props: Partial<Omit<ChatNodeViewProps, 'node'>> & { node: ChatConversationViewNode } = {
    node, t, loadImage: unusedImageLoader, renderFactorySlot: renderUserFactory, openFile: vi.fn(),
    useSession: selector => selector({ running: false } as never), useProjection: () => undefined, useAccess: () => true,
  }
  return props as ChatNodeViewProps<'user' | 'steering'>
}

const userData: UserMessageNode = {
  kind: 'user',
  seq: 7,
  time: 7_000,
  content: [{ type: 'text', text: 'hello' }] as never,
  source: SHARED,
}

const steeringData: SteeringMessageNode = {
  kind: 'steering',
  messageId: 'fixture-steering' as SteeringMessageNode['messageId'],
  seq: 8,
  time: 8_000,
  content: [{ type: 'text', text: 'steer' }] as never,
  source: SHARED,
}

describe('official user renderer origin seat', () => {
  it('edits the original prompt in place, restores focus on cancel, and resends without creating a session', async () => {
    const editPrompt = vi.fn().mockResolvedValue(undefined)
    const props = { ...viewProps(userData), useProjection: () => ({ resets: [] }) as never }
    const view = render(<UserMessageNodeView {...props} {...userSlots} editPrompt={editPrompt} />)
    fireEvent.click(view.getByRole('button', { name: '编辑消息' }))
    expect((view.getByRole('textbox') as HTMLTextAreaElement).value).toBe('hello')
    fireEvent.change(view.getByRole('textbox'), { target: { value: 'discarded draft' } })
    fireEvent.click(view.getByRole('button', { name: '取消' }))
    expect(view.getByText('hello')).toBeTruthy()
    expect(document.activeElement).toBe(view.getByRole('button', { name: '编辑消息' }))
    expect(editPrompt).not.toHaveBeenCalled()
    fireEvent.click(view.getByRole('button', { name: '编辑消息' }))
    fireEvent.change(view.getByRole('textbox'), { target: { value: 'new prompt' } })
    await act(async () => { fireEvent.click(view.getByRole('button', { name: '发送' })) })
    expect(editPrompt).toHaveBeenCalledExactlyOnceWith(7, [{ type: 'text', text: 'new prompt' }])
  })

  it('preserves file attachments when revising the text', async () => {
    const file = { type: 'file' as const, attachment: { attachmentId: AttachmentId(`sha256:${'b'.repeat(64)}`), name: 'notes.txt', bytes: 23 } }
    const data = { ...userData, content: [...userData.content, file] }
    const editPrompt = vi.fn().mockResolvedValue(undefined)
    const props = { ...viewProps(data), useProjection: () => ({ resets: [] }) as never }
    const view = render(<UserMessageNodeView {...props} {...userSlots} editPrompt={editPrompt} />)
    fireEvent.click(view.getByRole('button', { name: '编辑消息' }))
    fireEvent.change(view.getByRole('textbox'), { target: { value: 'Read this attachment' } })
    await act(async () => { fireEvent.click(view.getByRole('button', { name: '发送' })) })
    expect(editPrompt).toHaveBeenCalledExactlyOnceWith(7, [{ type: 'text', text: 'Read this attachment' }, file])
  })

  it('keeps the pencil unavailable during an active task', () => {
    const props = { ...viewProps(userData), useProjection: () => ({ resets: [] }) as never,
      useSession: ((select: (value: { running: boolean }) => unknown) => select({ running: true })) as ChatNodeViewProps['useSession'] }
    const view = render(<UserMessageNodeView {...props} {...userSlots} editPrompt={vi.fn()} />)
    const pencil = view.getByRole('button', { name: '编辑消息' })
    expect(pencil.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(pencil)
    expect(view.queryByRole('textbox')).toBeNull()
  })

  it('renders the source chain above the bubble and passes the durable source', () => {
    const renderSlotChain = vi.fn(() => <span data-test-origin="">来自会话分享</span>)
    const view = render(<UserMessageNodeView {...viewProps(userData)} {...userSlots} renderSlotChain={renderSlotChain} />)
    const row = view.container.firstElementChild as HTMLElement
    const origin = row.querySelector('[data-test-origin]')
    const bubble = row.querySelector('[data-message-bubble]')

    expect(renderSlotChain).toHaveBeenCalledExactlyOnceWith(
      'conversation.chat.user.before', { source: SHARED, kind: 'user' }, { fallback: null },
    )
    expect(origin).not.toBeNull()
    expect(bubble).not.toBeNull()
    expect(row.firstElementChild).toBe(origin)
    expect(origin!.compareDocumentPosition(bubble!) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })

  it('preserves the bubble, text and actions across empty and occupied chain output', () => {
    const props = viewProps(userData)
    const absent = vi.fn(() => null)
    const occupied = vi.fn(() => <span data-test-origin="">来自会话分享</span>)
    const empty = vi.fn(() => null)
    const view = render(<UserMessageNodeView {...props} {...userSlots} renderSlotChain={absent} />)
    const row = view.container.firstElementChild
    const bubble = view.container.querySelector('[data-message-bubble]')
    const text = view.getByText('hello').firstChild
    const copy = view.getByRole('button', { name: '复制' })
    const actions = copy.closest('[data-clock]')
    expect(bubble).not.toBeNull()
    expect(text?.nodeType).toBe(Node.TEXT_NODE)
    expect(actions).not.toBeNull()
    expect(view.container.querySelector('[data-test-origin]')).toBeNull()

    for (const renderSlotChain of [occupied, empty, absent]) {
      view.rerender(<UserMessageNodeView {...props} {...userSlots} renderSlotChain={renderSlotChain} />)
      expect(view.container.firstElementChild).toBe(row)
      expect(view.container.querySelector('[data-message-bubble]')).toBe(bubble)
      expect(view.getByText('hello').firstChild).toBe(text)
      expect(view.getByRole('button', { name: '复制' })).toBe(copy)
      expect(copy.closest('[data-clock]')).toBe(actions)
      expect(view.container.querySelector('[data-test-origin]') !== null).toBe(renderSlotChain === occupied)
    }
  })

  it('asks the chain only for the user row beside a steering row', () => {
    const renderSlotChain = vi.fn(() => <span data-test-origin="" />)
    const view = render(<>
      <UserMessageNodeView {...viewProps(userData)} {...userSlots} renderSlotChain={renderSlotChain} />
      <UserMessageNodeView {...viewProps(steeringData)} renderSlotChain={() => null} />
    </>)
    const steeringRow = view.container.lastElementChild!
    expect(steeringRow.textContent).toContain('steer')

    expect(renderSlotChain).toHaveBeenCalledExactlyOnceWith(
      'conversation.chat.user.before', { source: SHARED, kind: 'user' }, { fallback: null },
    )
    expect(view.container.querySelectorAll('[data-test-origin]')).toHaveLength(1)
    expect(steeringRow.querySelector('[data-test-origin]')).toBeNull()
    expect(view.container.querySelector('[data-chat-steering-batch]')).toBeNull()
  })
})
