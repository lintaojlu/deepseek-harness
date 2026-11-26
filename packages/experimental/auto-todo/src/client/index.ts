/** Client entry for daily tasks and model operations. */
import type { Context } from '@deepseek-ai/cordis'
import remote from '@deepseek-ai/dsh-client-ui-auto-todo/remote'
import { inject, mountBoard } from './mount.ts'

export { inject } from './mount.ts'

/**
 * Mount the model API and both daily task views.
 * @param ctx - client plugin context.
 * @returns the model API disposer.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(remote)
  const ui = ctx.inject(['remote.autoTodoModel', ...inject], mountBoard)
  try {
    await ui
  } catch (error) {
    await ui.dispose()
    await unmount()
    throw error
  }
  return async () => {
    await ui.dispose()
    await unmount()
  }
}
