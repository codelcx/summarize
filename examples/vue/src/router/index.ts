import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/milkdown',
  },
  {
    path: '/tiptap',
    name: 'TipTap Editor',
    component: () => import('@cx/schemes/tiptap/index.vue'),
  },
  {
    path: '/milkdown',
    name: 'Milkdown Editor',
    component: () => import('@cx/schemes/milkdown/index.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
