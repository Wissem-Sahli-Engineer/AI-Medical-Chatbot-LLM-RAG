export async function getHealth() {
  const r = await fetch('/api/health')
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

// Streams the chatbot's answer: the backend sends one JSON event per line (NDJSON).
export async function streamChat(message, onEvent, signal) {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    signal,
  })
  if (!r.ok) {
    let detail = `HTTP ${r.status}`
    try { detail = (await r.json()).detail || detail } catch { /* not JSON */ }
    throw new Error(detail)
  }
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line))
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer))
}
