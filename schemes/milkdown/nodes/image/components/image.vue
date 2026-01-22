<template>
  <img
    class="image"
    :src="props.src.value"
    :alt="props.alt.value"
    :title="props.alt.value"
  >
</template>

<script setup lang="ts">
import { Ref } from 'vue'
import { ImageConfig } from '../config'

type Attrs = {
  alt: string
  src: string
  title: string
}

type AttrsRef = {
  [P in keyof Attrs]: Ref<Attrs[P] | undefined>
}

interface MilkdownImageProps extends AttrsRef {
  config: ImageConfig
  readonly: Ref<boolean>
  selected: Ref<boolean>
  setAttr: <T extends keyof Attrs>(attr: T, value: Attrs[T]) => void
}

const props = defineProps<MilkdownImageProps>()
</script>
