import { visit } from 'unist-util-visit'
import { commandsCtx } from '@milkdown/kit/core'
import { NodeSchema } from '@milkdown/kit/transformer'
import { Paragraph } from '@tiptap/extension-paragraph'
import { Meta, MilkdownPlugin } from '@milkdown/kit/ctx'
import { expectDomTypeError } from '@milkdown/exception'
import { InputRule } from '@milkdown/kit/prose/inputrules'
import { headingSchema, imageSchema, paragraphSchema } from '@milkdown/kit/preset/commonmark'
import { $command, $inputRule, $markSchema, $node, $nodeAttr, $nodeSchema, $remark, $useKeymap } from '@milkdown/kit/utils'
/**
 * Markdown 文本
      ↓ (remark 解析)
  MDAST（Markdown AST）
      ↓ (各种 remark 插件转换)
  修改后的 MDAST
      ↓ (transform 转换)
  ProseMirror 节点树
      ↓ (渲染)
  编辑器视图
 */

/**
 * 编辑器视图
      ↓ (编辑)
  ProseMirror 节点树
      ↓ (序列化)
  MDAST（Markdown AST）
      ↓ (生成)
  Markdown 文本
 */

// 节点语法
export const customNodeSchema = $nodeSchema('custom', ctx => ({
  group: 'block',
  draggable: false,
  selectable: true,
  // 节点允许添加的标记如：加粗、斜体，空格表示不允许添加任何标记
  marks: '',
  priority: 99,
  // 原子节点，不能拆分
  atom: true,
  // 保持节点的完整性与独立性
  defining: true,
  attrs: {
    src: { default: '' },
    media: { default: '' },
    url: { default: '' },
    title: { default: '' },
    align: { default: 'left' },
  },
  parseDOM: [
    {
      tag: 'div.custom',
      getAttrs: (dom) =>
      {
        if (!(dom instanceof HTMLVideoElement)) throw expectDomTypeError(dom)
        return {
          src: dom.getAttribute('src'),
          media: dom.getAttribute('media'),
          url: dom.getAttribute('url'),
          title: dom.getAttribute('title'),
          align: dom.getAttribute('align') || 'left',
        }
      },
    },
  ],
  toDOM: node => ['img', { ...node.attrs }],
  parseMarkdown: {
    match: node => node.type === 'custom',
    runner: (state, node, type) =>
    {
      console.log('parse custom', node)
      const { src, media, url, title, align } = node
      state.addNode(type, { src, media, url, title, align })
    },
  },
  toMarkdown: {
    match: node => node.type.name === 'custom',
    runner: (state, node) =>
    {
      console.log('serialize custom', node)
      state.openNode('paragraph')
      state.addNode('image', undefined, undefined, {
        url: node.attrs.src,
        alt: `${node.attrs.media}|${node.attrs.url}`,
        title: node.attrs.title,
        align: node.attrs.align,
      })
      state.closeNode()
    },
  },
}))

// 输入规则 ![|url](src "alt")
const customInputRule = $inputRule((ctx) =>
{
  return new InputRule(/!\[(?<media>image|video)\|(?<url>[^\]]+)\]\((?<cover>[^\s)]+?)\s*(?="|\))"?(?<title>[^"]+)?"?\)/, (state, match, start, end) =>
  {
    const nodeType = state.schema.nodes.custom
    if (!nodeType) return null

    const { tr } = state
    const [matched, media, url, src, title] = match
    const node = nodeType.create({ src, media, url, title })
    // 替换掉前面的空行及标记(!)
    tr.replaceWith(start - 2, end, node)
    return tr
  })
})

// 节点处理
const customRemark = $remark('remark-custom', ctx => () => (tree) =>
{
  visit(tree, 'paragraph', (node, index, parent) =>
  {
    if (node.children?.length !== 1) return
    const target = node.children?.[0]
    if (!target || target.type !== 'image') return

    const { url, alt, title } = target
    const [media, realUrl] = (alt || '').split('|')
    const newNode = {
      type: 'custom',
      src: url,
      url: realUrl,
      title,
      media,

    }

    parent!.children.splice(index!, 1, newNode as any)
  })
})

// 自定义命令
export const insertCustomCommand = $command('insert-custom', (ctx) =>
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

// 快捷键映射
export const customStampKeyMap = $useKeymap('custom-stamp-keymap', {
  InsertTimestamp: {
    shortcuts: 'Shift-T',
    command: (ctx) =>
    {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(insertCustomCommand.key)
    },
    priority: 1000,
  },
})

export const customSchema = [
  customNodeSchema,
  customInputRule,
  customRemark,
  customStampKeyMap,
  insertCustomCommand,
] as MilkdownPlugin[]
