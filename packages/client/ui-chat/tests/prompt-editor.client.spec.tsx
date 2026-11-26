// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { PromptEditor } from '../src/client/chat/PromptEditor.tsx'
import { MessageIconActions } from '../src/client/chat/MessageIconActions.tsx'
import { zh } from '../src/client/locale.ts'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'

const t = makeTranslate(zh, commonZh)
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('inline prompt editing', () => {
  it('opens from the pencil action beside copy and keeps the original text on cancel', () => {
    const onEdit = vi.fn()
    const view = render(<MessageIconActions text="Original prompt" clock="start" t={t} onEdit={onEdit} />)
    fireEvent.click(view.getByRole('button', { name: '编辑消息' }))
    expect(onEdit).toHaveBeenCalledOnce()
    expect(view.getByRole('button', { name: '复制' })).toBeTruthy()
    view.rerender(<MessageIconActions text="Original prompt" clock="start" t={t} onEdit={onEdit} editUnavailable />)
    fireEvent.click(view.getByRole('button', { name: '编辑消息' }))
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it('prefills a multiline prompt, explains artifact retention, and cancels without sending', () => {
    const onCancel = vi.fn()
    const onSend = vi.fn()
    const view = render(<PromptEditor text={'First line\nSecond line'} unavailable={false} onSend={onSend} onCancel={onCancel} t={t} />)
    expect((view.getByRole('textbox') as HTMLTextAreaElement).value).toBe('First line\nSecond line')
    expect(document.activeElement).toBe(view.getByRole('textbox'))
    expect(view.getByText('编辑后将从此处重新开始对话，已有产物不会被删除')).toBeTruthy()
    fireEvent.click(view.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables blank sends, retains failed drafts, and sends the revised prompt on retry', async () => {
    const onSend = vi.fn().mockRejectedValueOnce(new Error('Request unavailable')).mockResolvedValueOnce(undefined)
    const onCancel = vi.fn()
    const view = render(<PromptEditor text="Original" unavailable={false} onSend={onSend} onCancel={onCancel} t={t} />)
    fireEvent.change(view.getByRole('textbox'), { target: { value: '   ' } })
    expect((view.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(view.getByRole('textbox'), { target: { value: 'Revised prompt' } })
    await act(async () => { fireEvent.click(view.getByRole('button', { name: '发送' })) })
    expect(view.getByRole('alert').textContent).toContain('Request unavailable')
    expect((view.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Revised prompt')
    expect(onCancel).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(view.getByRole('button', { name: '发送' })) })
    expect(onSend).toHaveBeenLastCalledWith('Revised prompt')
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('prevents duplicate submits and keeps controls disabled while waiting', async () => {
    let settle!: () => void
    const onSend = vi.fn(() => new Promise<void>((resolve) => { settle = resolve }))
    const view = render(<PromptEditor text="Retry" unavailable={false} onSend={onSend} onCancel={vi.fn()} t={t} />)
    fireEvent.click(view.getByRole('button', { name: '发送' }))
    expect((view.getByRole('button', { name: '正在发送…' }) as HTMLButtonElement).disabled).toBe(true)
    expect((view.getByRole('button', { name: '取消' }) as HTMLButtonElement).disabled).toBe(true)
    expect(view.getByRole('textbox').matches(':disabled')).toBe(true)
    expect(onSend).toHaveBeenCalledOnce()
    await act(async () => { settle() })
  })
})
