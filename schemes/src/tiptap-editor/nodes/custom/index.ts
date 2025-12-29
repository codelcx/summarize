import { DefineComponent } from 'vue'
import { mergeAttributes, Node, NodeViewProps, RawCommands, VueNodeViewRenderer } from '@tiptap/vue-3'
import Component from './index.vue'
import { NodeName } from '../../configs/enums'
import { getNodeById, getNodePosById } from '../../utils'

declare module '@tiptap/core'
{
  interface Commands<ReturnType> {
    customNode: {
      insertCustomNode: (attrs?: Record<string, any>) => ReturnType
      updateCustomNode: (attrs: Record<string, any>, id: string) => ReturnType
      deleteCustomNode: (id: string) => ReturnType
    }
  }
}

interface CustomNodeOptions
{
  customNodeOptions: Record<string, any>
}

export interface CustomNodeAttributes
{
  id: string
  name: string
}

export const CustomNode = Node.create<CustomNodeOptions>({
  name: NodeName.CUSTOM_NODE,
  group: 'block',
  content: 'inline*',

  addOptions()
  {
    return {
      customNodeOptions: {},
    }
  },

  addAttributes()
  {
    return {
      id: {
        default: '',
        parseHTML: (element) =>
        {
          return element.getAttribute('id') || Math.random().toString(36).slice(2, 12)
        },
      },
      name: { default: '' },
    }
  },

  parseHTML()
  {
    return [
      {
        tag: NodeName.CUSTOM_NODE,
        getAttrs: (node) =>
        {
          return {
            name: node.getAttribute('name'),
          }
        },
      },
    ]
  },
  renderHTML({ HTMLAttributes, node })
  {
    return [NodeName.CUSTOM_NODE, mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView()
  {
    return VueNodeViewRenderer(Component as DefineComponent<NodeViewProps>)
  },

  addCommands()
  {
    return {
      insertCustomNode: (attrs?: CustomNodeAttributes) => ({ commands, state, chain }) =>
      {
        const { selection } = state
        const { empty, $from, $to } = selection

        // 已选择内容
        if (!empty)
        {
          console.log('has select content')
          return false
        }

        // 可插入节点
        if (!attrs)
        {
          console.log('no attrs')
          return true
        }

        // 判断是否嵌套
        state.doc.nodesBetween($from.pos, $to.pos, (node) =>
        {
          if (node.type.name === NodeName.CUSTOM_NODE)
          {
            console.log('nesting content')
            return false
          }
        })

        // 选中的内容
        const selectionContent = state.doc.slice($from.pos, $to.pos).content.toJSON()

        return chain()
          .deleteSelection()
          .insertContent({
            type: this.name,
            attrs: { ...attrs, id: Math.random().toString(36).slice(2, 11) },
            content: selectionContent,
          })
          .focus()
          .run()
      },

      updateCustomNode: (attrs: Partial<CustomNodeAttributes>, id: string) => ({ state, dispatch }) =>
      {
        const pos = getNodePosById(state, id)
        const node = pos === undefined ? undefined : state.doc.nodeAt(pos)

        if (pos === undefined || !node)
        {
          return
        }

        const newAttrs = { ...node.attrs, ...attrs }
        // 更新属性、标记
        dispatch!(state.tr.setNodeMarkup(pos, undefined, newAttrs))
      },

      deleteCustomNode: (id: string) => ({ state, dispatch }) =>
      {
        const targetNode = getNodeById(state, id)!
        const posStart = getNodePosById(state, id)!
        const posEnd = posStart + targetNode.nodeSize
        const fragment = targetNode.content

        // 删除节点
        state.tr.delete(posStart, posEnd)
        // 插入自定义节点下的子节点
        state.tr.insert(posStart, fragment)
        // 更新指定位置文档内容
        dispatch!(state.tr)
      },

    } as Partial<RawCommands>
  },
})
