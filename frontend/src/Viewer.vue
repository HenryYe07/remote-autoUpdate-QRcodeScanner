<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { io } from 'socket.io-client'
import QRCode from 'qrcode'
const socket = io()
const input = ref('')
const room = ref('')
const online = ref(false)
const url = ref('')
const image = ref('')
const error = ref('')
const joining = ref(false)
let renderId = 0
async function update(state: {online: boolean; url: string | null}) {
  online.value = state.online
  url.value = state.url || ''
  const id = ++renderId
  image.value = ''
  if (url.value) {
    try { const result = await QRCode.toDataURL(url.value, { width: 360, margin: 3, errorCorrectionLevel: 'M' }); if (id === renderId) image.value = result }
    catch { if (id === renderId) error.value = '链接过长，无法生成二维码' }
  }
}
function join() {
  if (!/^\d{4}$/.test(input.value)) { error.value = '请输入四位数字房间号'; return }
  if (!socket.connected) { error.value = '服务器未连接，请稍后重试'; return }
  joining.value = true
  socket.timeout(5000).emit('viewer:join', input.value, (err: Error | null, state: {ok: boolean; online: boolean; url: string | null; error?: string}) => {
    joining.value = false
    if (err || !state?.ok) { error.value = state?.error || '连接超时，请重试'; return }
    room.value = input.value; error.value = ''; void update(state)
  })
}
function leave() { socket.emit('viewer:leave'); room.value = ''; void update({online: false, url: null}) }
socket.on('room:state', update)
socket.on('disconnect', () => { if (room.value) { error.value = '连接已断开，请重新加入房间'; room.value = ''; void update({online: false, url: null}) } })
onBeforeUnmount(() => socket.disconnect())
</script>
<template>
  <main class="shell viewer"><header><div class="eyebrow"><span class="brand-mark" aria-hidden="true">▦</span> QR SCANNER</div><h1>查看二维码</h1><p>输入扫描端的房间号，接收并显示最新二维码。</p></header>
    <section class="room-card"><label for="viewer-room">查看房间号</label><p>与扫描端输入相同的四位数字。</p><div class="room-controls"><input id="viewer-room" v-model="input" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="输入四位数字" :disabled="!!room || joining" /><button v-if="!room" class="primary" :disabled="joining" @click="join">{{ joining ? '加入中…' : '加入房间' }}</button><button v-else class="secondary" @click="leave">退出房间</button></div><p v-if="error" class="error" role="alert">{{ error }}</p></section>
    <section class="qr-card" aria-live="polite"><div class="qr-heading"><strong>{{ room ? `房间 ${room}` : '等待加入房间' }}</strong><span>{{ room ? (online ? '扫描端在线' : '等待扫描端') : '未连接' }}</span></div><div class="qr-display"><img v-if="image" :src="image" alt="最新接收链接的二维码" /><p v-else>{{ room ? (online ? '等待扫描二维码' : '扫描端尚未加入') : '加入房间后在这里显示二维码' }}</p></div><div class="received"><span>收到的链接</span><strong>{{ url || '暂无链接' }}</strong></div></section>
  </main>
</template>
