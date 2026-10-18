import { useEffect, useRef, useState } from 'react'
import { ArrowUpIcon, CloseIcon, FileIcon, ImageIcon, PlusIcon, StopIcon } from './icons.jsx'
import { FILE_ACCEPT, MAX_FILE_MB, MAX_FILES, MAX_IMAGES, formatSize, readFile, readImage } from './utils.js'

export default function Composer({ onSend, onStop, streaming, ready, health }) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const textRef = useRef(null)
  const imageInput = useRef(null)
  const fileInput = useRef(null)

  // Grow the textarea with its content, up to a maximum height.
  useEffect(() => {
    const el = textRef.current
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 220) + 'px'
  }, [text])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 4000)
    return () => clearTimeout(t)
  }, [error])

  async function addFiles(list) {
    setMenuOpen(false)
    const files = [...list]
    let images = attachments.filter((a) => a.kind === 'image').length
    let docs = attachments.filter((a) => a.kind === 'file').length
    const added = []
    for (const f of files) {
      try {
        if (f.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`${f.name} is larger than ${MAX_FILE_MB} MB.`)
        if (f.type.startsWith('image/')) {
          if (images >= MAX_IMAGES) throw new Error(`You can attach up to ${MAX_IMAGES} images.`)
          added.push(await readImage(f)); images++
        } else if (/\.(pdf|txt|md)$/i.test(f.name)) {
          if (docs >= MAX_FILES) throw new Error(`You can attach up to ${MAX_FILES} documents.`)
          added.push(await readFile(f)); docs++
        } else {
          throw new Error(`${f.name}: only images, PDF, TXT and MD files are supported.`)
        }
      } catch (e) {
        setError(e.message)
      }
    }
    if (added.length) setAttachments((a) => [...a, ...added])
    textRef.current?.focus()
  }

  const canSend = ready && !streaming && (text.trim() || attachments.some((a) => a.kind === 'image'))

  const submit = () => {
    if (!canSend) return
    onSend(text, attachments)
    setText('')
    setAttachments([])
  }

  const placeholder = ready
    ? attachments.length ? 'Ask about your attachment…' : 'Ask a medical question…'
    : health?.index === 'loading' ? 'Loading the knowledge base, one moment…' : 'Waiting for the backend and Ollama…'

  return (
    <div className="composer-wrap">
      <div
        className={`composer ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
      >
        {attachments.length > 0 && (
          <div className="attachments">
            {attachments.map((a) => (
              <div key={a.id} className={`attachment ${a.kind}`}>
                {a.kind === 'image' ? (
                  <img src={a.thumb} alt={a.name} />
                ) : (
                  <>
                    <span className="file-badge"><FileIcon size={16} /></span>
                    <span className="file-meta"><strong>{a.name}</strong><small>{formatSize(a.size)}</small></span>
                  </>
                )}
                <button className="remove" onClick={() => setAttachments((all) => all.filter((x) => x.id !== a.id))} aria-label={`Remove ${a.name}`}>
                  <CloseIcon size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textRef}
          rows={1}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const imgs = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'))
            if (imgs.length) { e.preventDefault(); addFiles(imgs) }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
          }}
        />

        <div className="composer-bar">
          <div className="attach">
            <button className="icon-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Add photos or files" title="Add photos or files" disabled={!ready}>
              <PlusIcon size={19} />
            </button>
            {menuOpen && (
              <>
                <div className="menu-scrim" onClick={() => setMenuOpen(false)} />
                <div className="menu">
                  <button onClick={() => imageInput.current.click()}><ImageIcon /> Add photos <small>JPG, PNG</small></button>
                  <button onClick={() => fileInput.current.click()}><FileIcon /> Add files <small>PDF, TXT, MD</small></button>
                </div>
              </>
            )}
            <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            <input ref={fileInput} type="file" accept={FILE_ACCEPT} multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
          </div>
          {streaming ? (
            <button className="send stop" onClick={onStop} aria-label="Stop" title="Stop (Esc)"><StopIcon /></button>
          ) : (
            <button className="send" onClick={submit} disabled={!canSend} aria-label="Send" title="Send (Enter)"><ArrowUpIcon /></button>
          )}
        </div>
        {dragging && <div className="drop-hint">Drop images or documents here</div>}
      </div>
      {error ? (
        <p className="footnote error-note">{error}</p>
      ) : (
        <p className="footnote">MedRAG can make mistakes and does not replace a doctor. In an emergency, call 15 or 112.</p>
      )}
    </div>
  )
}
