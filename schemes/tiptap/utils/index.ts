import { Node } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'

/**
 * 获取节点实例
 * @param state
 * @param id
 */
export function getNodeById(state: EditorState, id: string)
{
  let foundNode: Node | undefined
  state.doc.descendants((node) =>
  {
    if (node.attrs.id === id)
    {
      foundNode = node
      return false
    }
    return true
  })
  return foundNode
}

/**
 * 获取节点在文档中的位置
 * @param state
 * @param id - 要查找的节点 ID
 * @returns {number | null} 节点在文档中的位置
 */
export function getNodePosById(state: EditorState, id: string)
{
  let foundPos: number | undefined

  state.doc.descendants((node, pos) =>
  {
    if (node.attrs.id === id)
    {
      foundPos = pos
      return false
    }
    return true
  })

  return foundPos
}
