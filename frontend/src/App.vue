<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import jsQR from 'jsqr'

const video = ref<HTMLVideoElement | null>(null)
const active = ref(false)
const starting = ref(false)
const wanted = ref(false)
const status = ref('准备就绪')
const error = ref('')
const lastQRCode = ref('')
const requestStatus = ref('尚未发送')
let stream: MediaStream | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let generation = 0
let requestId = 0
const canvas = document.createElement('canvas')
const context = canvas.getContext('2d', { willReadFrequently: true })

function release() {
  generation++
  if (timer !== null) clearTimeout(timer)
  timer = null
  stream?.getTracks().forEach(track => track.stop())
  stream = null
  if (video.value) video.value.srcObject = null
  active.value = false
  starting.value = false
}
function stop() {
  wanted.value = false
  release()
  status.value = '扫描已停止'
}
function messageFor(err: unknown) {
  const name = err instanceof Error ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return '摄像头权限被拒绝，请在浏览器设置中允许访问后重试。'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return '未找到可用的摄像头，请检查设备后重试。'
  if (name === 'NotReadableError' || name === 'AbortError') return '摄像头无法使用，可能正被其他应用占用。'
  return '摄像头启动失败，请检查权限、设备及 HTTPS 连接后重试。'
}
async function start() {
  if (active.value || starting.value) return
  wanted.value = true
  if (document.hidden) { status.value = '页面在后台，扫描已暂停'; return }
  if (!navigator.mediaDevices?.getUserMedia) {
    wanted.value = false
    error.value = '无法访问摄像头。请通过 HTTPS 或本机 localhost 打开页面。'
    status.value = '无法启动'; return
  }
  const current = ++generation
  starting.value = true
  error.value = ''
  status.value = '正在启动摄像头…'
  let acquired: MediaStream | null = null
  try {
    acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } })
    if (current !== generation || !wanted.value || document.hidden) { acquired.getTracks().forEach(t => t.stop()); return }
    stream = acquired
    const element = video.value
    if (!element) throw new Error('Video unavailable')
    element.srcObject = acquired
    await element.play()
    if (current !== generation) return
    active.value = true
    starting.value = false
    status.value = '正在扫描'
    acquired.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
      if (current !== generation) return
      release(); wanted.value = false; status.value = '摄像头已断开'; error.value = '摄像头连接已中断，请重新开始扫描。'
    }, { once: true }))
    schedule(current)
  } catch (err) {
    acquired?.getTracks().forEach(t => t.stop())
    if (current !== generation) return
    release(); wanted.value = false; status.value = '无法启动'; error.value = messageFor(err)
  }
}
function schedule(current: number) {
  timer = setTimeout(() => {
    if (current !== generation || !active.value) return
    try { scan() } catch (err) { console.error('识别失败', err) }
    if (current === generation && active.value) schedule(current)
  }, 1000)
}
function scan() {
  const el = video.value
  if (!el || !context || el.readyState < 2 || !el.videoWidth || !el.videoHeight) return
  const scale = Math.min(1, 960 / Math.max(el.videoWidth, el.videoHeight))
  canvas.width = Math.max(1, Math.round(el.videoWidth * scale))
  canvas.height = Math.max(1, Math.round(el.videoHeight * scale))
  context.drawImage(el, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const result = jsQR(pixels.data, pixels.width, pixels.height)
  if (!result) return
  const value = result.data
  try { if (!['http:', 'https:'].includes(new URL(value).protocol)) return } catch { return }
  if (value === lastQRCode.value) return
  lastQRCode.value = value
  void send(value)
}
async function send(url: string) {
  const id = ++requestId
  requestStatus.value = '正在发送…'
  try {
    const response = await fetch('/api/qrcode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    if (id === requestId) requestStatus.value = '发送成功'
  } catch (err) {
    console.error('发送失败', err)
    if (id === requestId) requestStatus.value = '发送失败，请检查网络或服务'
  }
}
function visibilityChanged() {
  if (document.hidden) {
    if (wanted.value) { release(); status.value = '页面在后台，扫描已暂停' }
  } else if (wanted.value) { void start() }
}
onMounted(() => document.addEventListener('visibilitychange', visibilityChanged))
onBeforeUnmount(() => { wanted.value = false; release(); document.removeEventListener('visibilitychange', visibilityChanged) })
</script>

<template>
  <main class="shell">
    <header><div class="eyebrow"><span class="brand-mark" aria-hidden="true">▦</span> QR SCANNER</div><h1>二维码扫描</h1><p>将二维码放入画面，识别到新链接时自动发送。</p></header>
    <section class="scanner" aria-label="摄像头预览">
      <video ref="video" autoplay muted playsinline></video>
      <div v-if="!active" class="placeholder"><div class="scan-icon" aria-hidden="true"><span></span></div><strong>{{ starting ? '正在启动摄像头' : '摄像头未开启' }}</strong><small>点击下方按钮开始扫描</small></div>
      <div v-else class="viewfinder" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="preview-label"><span :class="{ live: active }"></span>{{ active ? '实时画面' : '预览画面' }}</div>
    </section>
    <div class="controls"><button class="primary" :disabled="active || starting" @click="start">{{ starting ? '启动中…' : '开始扫描' }}</button><button class="secondary" :disabled="!active && !starting && !wanted" @click="stop">停止扫描</button></div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <section class="details" aria-label="扫描信息"><div class="detail"><span>扫描状态</span><strong aria-live="polite"><b :class="{ live: active }"></b>{{ status }}</strong></div><div class="detail url"><span>最近识别的有效链接</span><strong>{{ lastQRCode || '暂无识别结果' }}</strong></div><div class="detail"><span>最近发送状态</span><strong aria-live="polite">{{ requestStatus }}</strong></div></section>
    <footer>识别在本机完成 · 仅发送变化的有效链接</footer>
  </main>
</template>
