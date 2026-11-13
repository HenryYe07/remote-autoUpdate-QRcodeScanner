import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const app = express()
export const server = createServer(app)
export const io = new Server(server)
const rooms = new Map()
const leaseMs = Number(process.env.SCANNER_LEASE_MS) > 0 ? Number(process.env.SCANNER_LEASE_MS) : 15000
const validRoom = value => typeof value === 'string' && /^\d{4}$/.test(value)
const validUrl = value => {
  try { return typeof value === 'string' && ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}
io.on('connection', socket => {
  let scannerRoom = null
  let viewerRoom = null
  function leaveScanner() {
    if (scannerRoom && rooms.get(scannerRoom)?.owner === socket.id) {
      clearTimeout(rooms.get(scannerRoom).timer)
      rooms.delete(scannerRoom)
      io.to(`view:${scannerRoom}`).emit('room:state', { online: false, url: null })
    }
    scannerRoom = null
  }
  function renewLease() {
    const entry = scannerRoom && rooms.get(scannerRoom)
    if (!entry || entry.owner !== socket.id) return
    clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      leaveScanner()
      socket.emit('scanner:expired')
    }, leaseMs)
    entry.timer.unref()
  }
  socket.on('scanner:heartbeat', renewLease)
  socket.on('scanner:join', (room, ack) => {
    if (typeof ack !== 'function') return
    if (!validRoom(room)) return ack({ ok: false, error: '请输入四位数字房间号' })
    if (rooms.has(room) && rooms.get(room).owner !== socket.id) return ack({ ok: false, error: '该房间已有扫描端，请换一个房间号' })
    if (scannerRoom !== room) leaveScanner()
    scannerRoom = room
    if (!rooms.has(room)) rooms.set(room, { owner: socket.id, url: null })
    renewLease()
    io.to(`view:${room}`).emit('room:state', { online: true, url: rooms.get(room).url })
    ack({ ok: true })
  })
  socket.on('scanner:leave', leaveScanner)
  socket.on('scanner:url', (value, ack) => {
    if (typeof ack !== 'function') return
    const room = scannerRoom && rooms.get(scannerRoom)
    if (!room || room.owner !== socket.id || !validUrl(value)) return ack({ ok: false })
    room.url = value
    io.to(`view:${scannerRoom}`).emit('room:state', { online: true, url: value })
    ack({ ok: true })
  })
  socket.on('viewer:join', (room, ack) => {
    if (typeof ack !== 'function') return
    if (!validRoom(room)) return ack({ ok: false, error: '请输入四位数字房间号' })
    if (viewerRoom) socket.leave(`view:${viewerRoom}`)
    viewerRoom = room
    socket.join(`view:${room}`)
    const state = rooms.get(room)
    ack({ ok: true, online: !!state, url: state?.url ?? null })
  })
  socket.on('viewer:leave', () => { if (viewerRoom) socket.leave(`view:${viewerRoom}`); viewerRoom = null })
  socket.on('disconnect', leaveScanner)
})
app.use(express.json({ limit: '16kb' }))
app.post('/api/qrcode', (req, res) => {
  const value = req.body?.url
  try {
    if (!validUrl(value)) throw new Error('Invalid URL')
    console.log(`[QR CODE] ${value}`)
    res.json({ success: true })
  } catch {
    res.status(400).json({ success: false, error: '请输入有效的 HTTP 或 HTTPS URL' })
  }
})
app.use((err, _req, res, next) => {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ success: false, error: '无效的 JSON' })
  next(err)
})
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend/dist')
app.use(express.static(dist))
app.get('/view', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT || 3000
  server.listen(port, '0.0.0.0', () => console.log(`Server listening on http://0.0.0.0:${port}`))
}
