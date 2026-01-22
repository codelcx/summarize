import { Ctx } from '@milkdown/kit/ctx'
import { commandsCtx } from '@milkdown/kit/core'
import { $command, $useKeymap } from '@milkdown/kit/utils'

export const insertTimestamp = $command('InsertTimestamp', (ctx: Ctx) =>
{
  return () => (state, dispatch) =>
  {
    const { from, to } = state.selection

    const timestamp = new Date().toLocaleString()
    const node = state.schema.text(timestamp)

    const tr = state.tr.insert(from, node)
    dispatch!(tr)

    return true
  }
})

export const timestampKeymap = $useKeymap('timestampKeymap', {
  InsertTimestamp: {
    shortcuts: 'Shift-T',
    command: (ctx) =>
    {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(insertTimestamp.key)
    },
    priority: 1000,
  },
})
