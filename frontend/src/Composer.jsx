import { useEffect, useRef, useState } from 'react'
import { ArrowUpIcon, StopIcon } from './icons.jsx'

export default function Composer({ onSend, onStop, streaming, ready, health }) {
  const [text, setText] = useState('')
  const ref = useRef(null)

  // Grow the textarea with its content, up to a maximum height.
  useEffect(() => {
    const el = ref.current
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [text])

  const submit = () => {
    if (!text.trim() || !ready || streaming) return
    onSend(text)
    setText('')
  }

  const placeholder = ready
    ? 'Ask a medical question…'
    : health?.index === 'loading' ? 'Loading the knowledge base, one moment…' : 'Waiting for the backend and Ollama…'

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
        />
        {streaming ? (
          <button className="send stop" onClick={onStop} aria-label="Stop"><StopIcon /></button>
        ) : (
          <button className="send" onClick={submit} disabled={!text.trim() || !ready} aria-label="Send"><ArrowUpIcon /></button>
        )}
      </div>
      <p className="footnote">
        MedRAG gives general information and can make mistakes. It does not replace a doctor. In an emergency, call 15 or 112.
      </p>
    </div>
  )
}
