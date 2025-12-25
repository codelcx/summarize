<template>
  <div class="button">
    Button
  </div>
</template>

<script lang="ts" setup>
console.log('Button component')
</script>

<style scoped lang="scss">
.button {
  padding: 10px 20px;
  color: blue;
  cursor: pointer;
  background-color: #4096ef;
  border-radius: 5px;

  &:hover {
    background-color: #5cb3fa;
  }
}
</style>
