import type { RouteRecordRaw } from 'vue-router'
import TipTapEditor from '@cx/schemes/tiptap/index.vue'
import { createRouter, createWebHistory } from 'vue-router'
import MilldownEditor from '@cx/schemes/milkdown/index.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/milkdown',
  },
  {
    path: '/tiptap',
    name: 'TipTap Editor',
    component: TipTapEditor,
  },
  {
    path: '/milkdown',
    name: 'Milkdown Editor',
    component: MilldownEditor,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
