<template>
  <MilkdownProvider>
    <MilkdownCoreEditor />
    <MilkdownCrepeEditor />
  </MilkdownProvider>
</template>

<script setup lang="ts">
import { MilkdownProvider } from '@milkdown/vue'
import MilkdownCoreEditor from './core/index.vue'
import MilkdownCrepeEditor from './crepe/index.vue'
</script>
