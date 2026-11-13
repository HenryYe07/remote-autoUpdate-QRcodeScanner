import { test } from 'node:test'
import assert from 'node:assert/strict'
import { app } from './server.js'

test('POST accepts only HTTP(S) URL strings', async () => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    for (const [body, status] of [[{url:'https://example.com'}, 200], [{url:'http://example.com/a'}, 200], [{url:'ftp://example.com'}, 400], [{url:'hello'}, 400], [{}, 400], [{url:42}, 400]]) {
      const response = await fetch(`${base}/api/qrcode`, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)})
      assert.equal(response.status, status)
      assert.equal((await response.json()).success, status === 200)
    }
    const malformed = await fetch(`${base}/api/qrcode`, {method:'POST', headers:{'content-type':'application/json'}, body:'{'})
    assert.equal(malformed.status, 400)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
