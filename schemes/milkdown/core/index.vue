<template>
  <div class="milkdown-core">
    <div class="milkdown-content">
      <div class="custom-toolbar">
        <button @click="onUpload('image')">
          上传图片
        </button>
        <button @click="onUpload('video')">
          上传视频
        </button>
      </div>
      <div ref="milkdown" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Ctx } from '@milkdown/kit/ctx'
import { nord } from '@milkdown/theme-nord'
import { insert } from '@milkdown/kit/utils'
import { gfm } from '@milkdown/kit/preset/gfm'
import { history } from '@milkdown/kit/plugin/history'
import { TextSelection } from '@milkdown/kit/prose/state'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { codeBlockComponent } from '@milkdown/kit/component/code-block'
import { imageBlockComponent } from '@milkdown/kit/component/image-block'
import { listItemBlockComponent } from '@milkdown/kit/component/list-item-block'
import { defaultValueCtx, Editor, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { customComponent } from '../nodes/custom'
import { placeholder, placeholderConfig } from '../plugins/placeholder'
import '@milkdown/theme-nord/style.css'
import '@milkdown/kit/prose/view/style/prosemirror.css'

const editor = ref<Editor>()
const milkdown = ref<HTMLElement>()
const markdown = ref('')
const placeholderText = ref('Write something...')

function initEditor()
{
  Editor.make()
    .config((ctx) =>
    {
      // ctx.inject(placeholderConfig.key, { text: () => placeholderText.value })
      ctx.set(placeholderConfig.key, { text: () => placeholderText.value })
      // ctx.update(placeholderConfig.key, prev => ({ ...prev, text: () => placeholderText.value }))
      ctx.set(rootCtx, milkdown.value!)
      // ctx.set(defaultValueCtx, markdown.value)
      ctx.get(listenerCtx).mounted(ctx => autoFocusEditor(ctx))
      ctx.get(listenerCtx).blur(ctx => listenEditorBlur())
      ctx.get(listenerCtx).focus(ctx => listenEditorFocus())
      ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => saveEditor(markdown))
    })
    // UI主题
    .config(nord)
    // 事件监听
    .use(listener)
    // markdown语法
    .use(commonmark)
    // 自定义节点
    .use(customComponent)
    // 占位符
    .use(placeholder)
    // 内置图片格式
    .use(imageBlockComponent)
    // 代码块
    .use(codeBlockComponent)
    // 列表
    .use(listItemBlockComponent)
    // 历史记录操作，如撤销、重做
    .use(history)
    // 增强markdown语法，如表格、删除线、任务列表等
    .use(gfm)
    .create()
    .then(app => editor.value = app)
}

onMounted(() => initEditor())

function markdownToHtml(ctx: Ctx)
{
  const editorView = ctx.get(editorViewCtx)
  const html = editorView.dom.innerHTML
}

function autoFocusEditor(ctx: Ctx)
{
  const view = ctx.get(editorViewCtx)
  const { state } = view
  const { doc } = state
  const selection = TextSelection.atEnd(doc)
  view.dispatch(state.tr.setSelection(selection))
  view.focus()
}

function listenEditorFocus()
{
  // console.log('focus')
}

function listenEditorBlur()
{
  // console.log('blur')
}

function saveEditor(markdown: string)
{
  console.log(markdown)
}

function onUpload(type: 'image' | 'video')
{
  placeholderText.value = 'write something here...'
  const videoMd = `![video|url](https://picsum.photos/200/200)`
  const imageMd = `![image|url](https://picsum.photos/200/300 "this is a title")`
  const scheme = type === 'image' ? imageMd : videoMd
  editor.value?.action(insert(scheme))
}
</script>

<style scoped lang="scss">
.milkdown-core {
  width: 100%;
  height: 400px;
  padding: 20px 10px 20px 20px;
  border: 1px solid #ccc;

  .milkdown-content {
    width: 100%;
    height: 100%;
    overflow-y: auto;
  }

  .custom-toolbar {
    display: flex;
    gap: 20px;
    margin-bottom: 10px;

    button {
      padding: 5px 10px;
      cursor: pointer;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
  }

  :deep(.milkdown) {
    .editor {
      padding: 0;
    }
  }
}
</style>
