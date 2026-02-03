<template>
  <div class="custom-view" @click="onClick">
    <img
      :src="props.attrs.src.value"
      :alt="props.attrs.alt.value"
      :title="props.attrs.title.value"
    >
  </div>
</template>

<script setup lang="ts">
import { Ref } from 'vue'
import { CustomNodeConfig } from '../config'

type Direction = 'left' | 'center' | 'right'

interface Attrs {
  align: Direction
  alt: string
  src: string
  title: string
}

type AttrsRef = {
  [P in keyof Attrs]: Ref<Attrs[P] | undefined>
}

interface MilkdownCustomProps {
  attrs: AttrsRef
  config: CustomNodeConfig
  readonly: Ref<boolean>
  selected: Ref<boolean>
  setAttr: <T extends keyof Attrs>(attr: T, value: Attrs[T]) => void
}

const props = defineProps<MilkdownCustomProps>()

function onClick()
{
  if (props.readonly.value) return
  props.setAttr('title', 'clicked!')
}
</script>
