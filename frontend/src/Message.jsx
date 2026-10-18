import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { AlertIcon, BookIcon, CheckIcon, ChevronIcon, CopyIcon, ExternalIcon, Logo } from './icons.jsx'

const STATUS_TEXT = {
  routing: 'Checking your message…',
  searching: 'Searching medical sources…',
  writing: 'Writing the answer…',
}

// Turn "[2]" citations into links that the renderer shows as small numbered chips.
const withCitations = (text) => text.replace(/\[(\d+)\]/g, '[$1](#cite-$1)')

function Sources({ sources, highlight, onToggle, open }) {
  return (
    <div className="sources">
      <button className="sources-toggle" onClick={onToggle}>
        <BookIcon /> {sources.length} sources <ChevronIcon open={open} />
      </button>
      {open && (
        <ol className="source-list">
          {sources.map((s) => (
            <li key={s.n} id={`src-${s.n}`} className={highlight === s.n ? 'highlight' : ''}>
              <div className="source-head">
                <span className="cite static">{s.n}</span>
                <span className={`badge ${s.source === 'PubMedQA' ? 'pubmed' : 'nih'}`}>{s.source === 'PubMedQA' ? 'PubMed' : 'NIH · MedQuAD'}</span>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="source-title">{s.title} <ExternalIcon /></a>
                ) : (
                  <span className="source-title">{s.title}</span>
                )}
              </div>
              <p className="source-text">{s.text.length > 420 ? s.text.slice(0, 420) + '…' : s.text}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default function Message({ message: m }) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [highlight, setHighlight] = useState(null)
  const [copied, setCopied] = useState(false)

  if (m.role === 'user') {
    return <div className="msg user"><div className="bubble">{m.content}</div></div>
  }

  const category = m.meta?.category
  const busy = m.status && m.status !== 'done'

  const openSource = (n) => {
    setSourcesOpen(true)
    setHighlight(n)
    setTimeout(() => document.getElementById(`src-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.content.replace(/\s*\[\d+\]/g, ''))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }

  const markdown = (
    <ReactMarkdown
      components={{
        a: ({ href, children }) =>
          href?.startsWith('#cite-') ? (
            <button className="cite" onClick={() => openSource(Number(href.slice(6)))}>{children}</button>
          ) : (
            <a href={href} target="_blank" rel="noreferrer">{children}</a>
          ),
      }}
    >
      {withCitations(m.content)}
    </ReactMarkdown>
  )

  return (
    <div className="msg assistant">
      <Logo size={28} />
      <div className="body">
        {busy && !m.content && (
          <div className="status"><span className="pulse" />{STATUS_TEXT[m.status] ?? 'Thinking…'}</div>
        )}

        {category === 'emergency' && m.content ? (
          <div className="emergency"><AlertIcon /><div>{markdown}</div></div>
        ) : (
          m.content && <div className={`markdown ${busy ? 'typing' : ''}`}>{markdown}</div>
        )}

        {m.caution && <div className="caution"><AlertIcon size={16} /> {m.caution}</div>}
        {m.error && <div className="error">Something went wrong: {m.error}</div>}
        {m.stopped && <div className="stopped">Stopped.</div>}

        {m.sources?.length > 0 && !busy && (
          <Sources sources={m.sources} highlight={highlight} open={sourcesOpen} onToggle={() => setSourcesOpen((o) => !o)} />
        )}

        {!busy && m.content && (
          <div className="msg-foot">
            {m.disclaimer && <span className="disclaimer">{m.disclaimer}</span>}
            <span className="msg-actions">
              {m.latency != null && <span className="latency">{m.latency}s</span>}
              <button className="icon-btn small" onClick={copy} aria-label="Copy answer">{copied ? <CheckIcon /> : <CopyIcon />}</button>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
