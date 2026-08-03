import express from 'express'
import { fileURLToPath } from 'node:url'

export const app = express()

app.get('/api/health', (_req, res) => {
  res.send('OK')
})

const PORT = 3001

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
  })
}
