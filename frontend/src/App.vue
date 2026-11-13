<script setup lang="ts">
import { ref } from 'vue'
import Scanner from './Scanner.vue'
import Viewer from './Viewer.vue'
const page = ref<'scanner' | 'viewer'>(location.pathname === '/view' ? 'viewer' : 'scanner')
function navigate(next: 'scanner' | 'viewer') {
  page.value = next
  history.pushState(null, '', next === 'viewer' ? '/view' : '/')
}
window.addEventListener('popstate', () => { page.value = location.pathname === '/view' ? 'viewer' : 'scanner' })
</script>
<template>
  <nav class="page-nav" aria-label="页面切换"><button :class="{ selected: page === 'scanner' }" @click="navigate('scanner')">扫描端</button><button :class="{ selected: page === 'viewer' }" @click="navigate('viewer')">查看端</button></nav>
  <Scanner v-if="page === 'scanner'" /><Viewer v-else />
</template>
