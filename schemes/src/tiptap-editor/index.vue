<template>
  <div class="editor-tiptap">
    <div class="control-group">
      <button @click="onGetContent">
        Get Content
      </button>
      <button :disabled="!canInsertCustomNode" @click="onInsertCustomNode">
        Set CustomNode
      </button>
    </div>

    <EditorContent class="editor-content" :editor="editor" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { editorConfig } from './configs'

const editor = useEditor(editorConfig)

const content = `
<span>
  This is still the text editor you’re used to, but enriched with node views.
</span>

<custom-node>this is test content</custom-node>
`

const canInsertCustomNode = computed(() =>
{
  return editor.value?.can().insertCustomNode()
})

onMounted(() =>
{
  editor.value?.commands.setContent(content)
})

function onGetContent()
{
  console.log(editor.value!.getHTML())
}

function onInsertCustomNode()
{
  editor.value!.commands.insertCustomNode()
}

</script>

<style lang="scss" scoped>
.editor-tiptap {
  width: 800px;
  height: 500px;
  padding: 10px;
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid #4096ef;

  .control-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 4px;
  }

  .editor-content {
    box-sizing: border-box;
    width: 100%;
    height: calc(100% - 40px);
    overflow: auto;
    font-size: 14px;
    border-radius: 6px;

    &:has(.tiptap:focus) {
      border-color: #4096ef;
    }
  }
}

:deep(.tiptap) {
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  line-height: 24px;
  letter-spacing: 1px;
  overflow-wrap: break-word;
  outline: none;
}
</style>
