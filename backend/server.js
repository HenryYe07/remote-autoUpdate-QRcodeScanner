import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const app = express()
app.use(express.json({ limit: '16kb' }))
app.post('/api/qrcode', (req, res) => {
  const value = req.body?.url
  try {
    if (typeof value !== 'string' || !['http:', 'https:'].includes(new URL(value).protocol)) throw new Error('Invalid URL')
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
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT || 3000
  app.listen(port, '0.0.0.0', () => console.log(`Server listening on http://0.0.0.0:${port}`))
}
