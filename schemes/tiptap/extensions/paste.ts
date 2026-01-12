import { Extension } from '@tiptap/vue-3'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Fragment, Node, DOMParser as ProseMirrorDOMParser, Slice } from '@tiptap/pm/model'
import { NodeName } from '../configs/enums'

/**
 * 递归处理粘贴内容中特定节点的id属性
 * @param fragment - 文档片段
 * @returns - 处理后的文档片段
 */
function processNodeIds(fragment: Fragment): Fragment
{
  const nodes: Node[] = []

  // 遍历fragment中的每个节点
  fragment.forEach((node) =>
  {
    let newNode = node

    // 检查节点类型
    switch (node.type.name)
    {
      case NodeName.CUSTOM_NODE: {
        newNode = node.type.create(
          { ...node.attrs, id: Math.random().toString(36).slice(2, 12) },
          node.content,
          node.marks,
        )
        break
      }
    // No default
    }

    // 如果节点有子内容，递归处理
    if (newNode.content && newNode.content.size > 0)
    {
      newNode = newNode.copy(processNodeIds(newNode.content))
    }

    nodes.push(newNode)
  })

  return Fragment.fromArray(nodes)
}

export const pastPlugin = Extension.create({
  name: 'pastePlugin',

  addProseMirrorPlugins()
  {
    return [
      new Plugin({
        key: new PluginKey('pastePlugin'),
        props: {
          handlePaste(view, event, slice)
          {
            const clipboardData = (event.clipboardData || window.clipboardData)
            const rawContent = clipboardData?.getData('text/html') || clipboardData?.getData('text')

            if (!rawContent)
            {
              return false
            }

            const parser = new DOMParser()
            const doc = parser.parseFromString(rawContent, 'text/html')

            const schema = view.state.schema
            const parseSlice = ProseMirrorDOMParser.fromSchema(schema).parseSlice(doc.body)
            const fragment = processNodeIds(parseSlice.content)

            const newSlice = new Slice(
              fragment,
              parseSlice.openStart,
              parseSlice.openEnd,
            )

            view.dispatch(view.state.tr.replaceSelection(newSlice))

            // 必须设置，否则可能粘贴出错，如内容重复
            return true
          },
        },
      }),
    ]
  },
})
