<template>
  <div class="milkdown-crepe">
    <div class="custom-toolbar">
      <button @click="onUpload('image')">
        上传图片
      </button>
      <button @click="onUpload('video')">
        上传视频
      </button>
    </div>
    <Milkdown />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Crepe } from '@milkdown/crepe'
import { Ctx } from '@milkdown/kit/ctx'
import { insert } from '@milkdown/kit/utils'
import { editorViewCtx } from '@milkdown/kit/core'
import { Milkdown, useEditor } from '@milkdown/vue'
import { TextSelection } from '@milkdown/kit/prose/state'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import '@milkdown/crepe/theme/frame.css'
import '@milkdown/crepe/theme/common/style.css'

const crepe = ref<Crepe>()
let rawCrepe: Crepe | undefined
const milkdown = ref<HTMLElement>()
const markdown = ref('Hello Milkdown')

/**
 *  要想外部能够访问编辑器必须是非响应式的
 * 1、使用 get 方法获取编辑器实例
 * 2、使用非响应式变量保存编辑器实例
 */
const { get } = useEditor((root) =>
{
  const crepe = new Crepe({
    root,
    // defaultValue: markdown.value,
    features: {
      'toolbar': false,
      'block-edit': false,
    },
    featureConfigs: {
      placeholder: {
        text: 'Write something...',
      },
    },
  })

  crepe.editor
    .config((ctx) =>
    {
      ctx.get(listenerCtx).mounted(ctx => autoFocusEditor(ctx))
      ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => saveEditor(markdown))
    })
    .use(listener)

  rawCrepe = crepe
  return crepe
})

function autoFocusEditor(ctx: Ctx)
{
  const view = ctx.get(editorViewCtx)
  const { state } = view
  const { doc } = state
  const selection = TextSelection.atEnd(doc)
  view.dispatch(state.tr.setSelection(selection))
  view.focus()
}

function saveEditor(markdown: string)
{
  console.log(markdown)
}

function onUpload(type: 'image' | 'video')
{
  const imageMd = `![image](https://picsum.photos/200/300)`
  const videoMd = `![video](https://picsum.photos/200/300)`
  const scheme = type === 'image' ? imageMd : videoMd
  // 无法访问响应式变量
  get()!.action(insert(scheme))
}
</script>

<style scoped lang="scss">
.milkdown-crepe {
  width: 100%;
  height: 400px;
  padding: 20px;
  overflow: auto;
  border: 1px solid #ccc;

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
