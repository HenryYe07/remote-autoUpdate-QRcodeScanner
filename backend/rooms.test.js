import { test } from 'node:test'
import assert from 'node:assert/strict'
import { io as connect } from 'socket.io-client'
process.env.SCANNER_LEASE_MS = '250'
const { server, io } = await import('./server.js')

const ack = (socket, event, value) => new Promise((resolve, reject) => socket.timeout(2000).emit(event, value, (error, result) => error ? reject(error) : resolve(result)))
const event = (socket, name) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('event timeout')), 2000); socket.once(name, data => { clearTimeout(timer); resolve(data) }) })
test('rooms isolate viewers and reject a second scanner until disconnect', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = `http://127.0.0.1:${server.address().port}`
  const sockets = [connect(address), connect(address), connect(address)]
  try {
    await Promise.all(sockets.map(s => s.connected ? Promise.resolve() : event(s, 'connect')))
    const [scanner, other, viewer] = sockets
    assert.equal((await ack(scanner, 'scanner:join', 'abc')).ok, false)
    assert.equal((await ack(viewer, 'viewer:join', '0123')).online, false)
    const joined = event(viewer, 'room:state')
    assert.equal((await ack(scanner, 'scanner:join', '0123')).ok, true)
    assert.equal((await joined).online, true)
    assert.equal((await ack(other, 'scanner:join', '0123')).ok, false)
    assert.equal((await ack(scanner, 'scanner:url', 'javascript:alert(1)')).ok, false)
    const delivered = event(viewer, 'room:state')
    assert.equal((await ack(scanner, 'scanner:url', 'https://example.com/a')).ok, true)
    assert.equal((await delivered).url, 'https://example.com/a')
    const offline = event(viewer, 'room:state')
    scanner.disconnect()
    assert.equal((await offline).online, false)
    assert.equal((await ack(other, 'scanner:join', '0123')).ok, true)
    for (let i = 0; i < 4; i++) {
      await new Promise(resolve => setTimeout(resolve, 80))
      other.emit('scanner:heartbeat')
    }
    assert.equal((await ack(viewer, 'scanner:join', '0123')).ok, false)
    const expired = event(other, 'scanner:expired')
    const offlineAfterSilence = event(viewer, 'room:state')
    await expired
    assert.equal((await offlineAfterSilence).online, false)
    assert.equal(other.connected, true)
    assert.equal((await ack(viewer, 'scanner:join', '0123')).ok, true)
    assert.equal((await ack(other, 'scanner:url', 'https://example.com/stale')).ok, false)
  } finally { sockets.forEach(s => s.disconnect()); await new Promise(resolve => io.close(resolve)) }
})
