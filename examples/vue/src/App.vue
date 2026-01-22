<template>
  <div class="app">
    <nav class="sidebar">
      <ul>
        <li v-for="menu in menuItems" :key="menu.path">
          <router-link
            :to="menu.path"
          >
            {{ menu.name }}
          </router-link>
        </li>
      </ul>
    </nav>
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { routes } from './router'

const menuItems = routes.filter(route => route.name && route.path !== '/')
</script>

<style scoped>
.app {
  display: flex;
  height: 100%;
}

.sidebar {
  box-sizing: border-box;
  width: 200px;
  height: 100%;
  padding: 20px;
  overflow-y: auto;
  background-color: #f4f4f4;
}

.sidebar ul {
  padding: 0;
  list-style: none;
}

.sidebar li {
  margin-bottom: 10px;
}

.sidebar a {
  display: block;
  padding: 10px;
  color: #333;
  text-decoration: none;
  border-radius: 4px;
}

.sidebar a.router-link-active {
  background-color: #ddd;
}

.content {
  box-sizing: border-box;
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
</style>
