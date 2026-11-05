import { serve } from '@hono/node-server'
import { createApp } from './app.ts'

/** Chosen by the comparison logged in NOTES.md. */
const MODEL = 'anthropic/claude-sonnet-5.5'

const PORT = 8787
/** Local only, so nobody else on the network can spend the key's credit. */
const HOSTNAME = '127.0.0.1'

const apiKey = process.env.OPENROUTER_API_KEY ?? ''
if (apiKey === '') {
  console.warn('[server] OPENROUTER_API_KEY is not set. Suggestions will show an error until it is.')
}

serve({ fetch: createApp({ apiKey, model: MODEL }).fetch, port: PORT, hostname: HOSTNAME }, () => {
  console.log(`[server] listening on http://${HOSTNAME}:${PORT}`)
})
