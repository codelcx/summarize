<template>
  <div class="app">
    <!-- 模板中的注释 -->
    <span>{{ returnText() }}</span>
    <span>{{ getAvatarBaseInfoCall() }}</span>

    <span>静态节点文本</span>

    <span>{{ stringLiteralText }}</span>

    <span>{{ `这是一段${templateLiteralText}, ${stringLiteralText}文本` }}</span>
  </div>
</template>

<script setup lang="ts">
const stringLiteralText = '这是一段字面量声明的文本'
const templateLiteralText = '模板字符串'

// 这是vue文件中的单行注释

/**
 * 这是vue文件中的多行注释
 */

function returnText()
{
  return '这是同步方法中返回的一段文本'
}

async function getAvatarBaseInfoCall()
{
  return '这是异步方法中返回的一段文本'
}
</script>

<style>
  /* 这是css中的注释 */
</style>
