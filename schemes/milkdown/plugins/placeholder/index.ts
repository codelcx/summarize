import type { Node } from '@milkdown/kit/prose/model'
import type { Selection } from '@milkdown/kit/prose/state'
import { findParent } from '@milkdown/kit/prose'
import { $ctx, $prose } from '@milkdown/kit/utils'
import { MilkdownPlugin } from '@milkdown/kit/ctx'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'

import { EditorState, Plugin, PluginKey } from '@milkdown/kit/prose/state'
import './style.css'

function isDocEmpty(doc: Node)
{
  return doc.childCount <= 1 && !doc.firstChild?.content.size
}

export function isInCodeBlock(selection: Selection)
{
  const type = selection.$from.parent.type
  return type.name === 'code_block'
}

export function isInList(selection: Selection)
{
  const type = selection.$from.node(selection.$from.depth - 1)?.type
  return type?.name === 'list_item'
}

function createPlaceholderDecoration(
  state: EditorState,
  placeholderText: string,
): Decoration | null
{
  const { selection } = state
  if (!selection.empty) return null

  const $pos = selection.$anchor
  const node = $pos.parent
  if (node.content.size > 0) return null

  const inTable = findParent(node => node.type.name === 'table')($pos)
  if (inTable) return null

  const before = $pos.before()

  return Decoration.node(before, before + node.nodeSize, {
    'class': 'core-placeholder',
    'data-placeholder': placeholderText,
  })
}

interface PlaceholderConfig {
  mode: 'doc' | 'block'
  text: string | (() => string)
}

const defaultPlaceholderConfig: PlaceholderConfig = {
  mode: 'block',
  text: 'Please enter...',
}

export const placeholderConfig = $ctx(
  defaultPlaceholderConfig as Partial<PlaceholderConfig>,
  'placeholderConfigCtx',
)

export const placeholderPlugin = $prose((ctx) =>
{
  return new Plugin({
    key: new PluginKey('MILKDOWN_PLACEHOLDER'),
    props: {
      decorations: (state) =>
      {
        const config = ctx.isInjected(placeholderConfig.key) ? ctx.get(placeholderConfig.key) : defaultPlaceholderConfig

        if (config.mode === 'doc' && !isDocEmpty(state.doc)) return null

        if (isInCodeBlock(state.selection) || isInList(state.selection)) return null

        const placeholderText = typeof config.text === 'function' ? config.text() : config.text
        const deco = createPlaceholderDecoration(state, placeholderText!)
        if (!deco) return null

        return DecorationSet.create(state.doc, [deco])
      },
    },
  })
})

export const placeholder: MilkdownPlugin[] = [
  placeholderConfig,
  placeholderPlugin,
]
