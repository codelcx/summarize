<template>
  <NodeViewWrapper class="custom-node">
    <div class="title">
      <span contenteditable="false" class="label">Custom Node {{ attrs }}</span>
      <span contenteditable="false" class="op update" @click="onUpdate">update</span>
      <span contenteditable="false" class="op delete" @click="onDelate">delete</span>
    </div>

    <NodeViewContent class="content is-editable" />
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NodeViewContent, nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'
import { CustomNodeAttributes } from '.'

const props = defineProps(nodeViewProps)

const attrs = computed(() =>
{
  return props.node.attrs as CustomNodeAttributes
})

function onUpdate()
{
  props.editor.commands.updateCustomNode({ name: Math.random().toString(36).slice(2, 12) }, attrs.value.id)
}

function onDelate()
{
  const content = props.node.textContent

  // 恢复选中内容
  if (content)
  {
    props.editor.commands.deleteCustomNode(attrs.value.id)
  }

  // 删除节点
  else
  {
    props.deleteNode()
  }
}
</script>

<style lang="scss" scoped>
.custom-node {
  position: relative;
  margin: 10px 0;
  overflow: hidden;
  background-color: #f6f2ff;
  border: 2px solid #6a00f5;
  border-radius: 10px;

  .title {
    display: flex;
    gap: 10px;
    align-items: center;

    .label {
      padding: 4px 8px;
      font-size: 14px;
      font-weight: bold;
      color: #fff;
      cursor: default;
      background-color: #6a00f5;
    }

    .op {
      padding: 4px 8px;
      color: #fff;
      cursor: pointer;

      &.update {
        background-color: #f90;
      }

      &.delete {
        background-color: #f00;
      }
    }
  }

  .content {
    padding: 1rem;

    &.is-editable {
      padding: 10px;
      margin: 10px;
      border: 2px dashed #e0d9e2;
      border-radius: 8px;
    }
  }
}
</style>
