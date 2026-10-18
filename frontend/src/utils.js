export const newId = () => Math.random().toString(36).slice(2, 10)

export const MAX_IMAGES = 3
export const MAX_FILES = 3
export const MAX_FILE_MB = 10
export const FILE_ACCEPT = '.pdf,.txt,.md,text/plain,text/markdown,application/pdf'

// Downscale an image in the browser: a large version for the model, a small thumbnail to keep in history.
export function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const draw = (max, quality) => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/jpeg', quality)
      }
      const full = draw(1024, 0.88)
      const thumb = draw(240, 0.8)
      URL.revokeObjectURL(url)
      resolve({ kind: 'image', id: newId(), name: file.name || 'image.jpg', data: full.split(',')[1], thumb })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Cannot read image ${file.name}`)) }
    img.src = url
  })
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ kind: 'file', id: newId(), name: file.name, size: file.size, data: String(reader.result).split(',')[1] })
    reader.onerror = () => reject(new Error(`Cannot read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export const formatSize = (bytes) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`

export function exportMarkdown(conversation) {
  const lines = [`# ${conversation.title}`, '']
  for (const m of conversation.messages) {
    if (m.role === 'user') {
      lines.push(`**You:** ${m.content}`)
      for (const a of m.attachments ?? []) lines.push(`_Attached: ${a.name}_`)
    } else {
      lines.push(`**MedRAG:** ${m.content}`)
      if (m.caution) lines.push(`> ${m.caution}`)
      for (const s of m.sources ?? []) lines.push(`- [${s.n}] ${s.source}: ${s.title}${s.url ? ` (${s.url})` : ''}`)
      if (m.disclaimer) lines.push(`_${m.disclaimer}_`)
    }
    lines.push('')
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${conversation.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 50) || 'conversation'}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}

export const load = (key, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(key))
    return v ?? fallback
  } catch {
    return fallback
  }
}

export const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked */ }
}
