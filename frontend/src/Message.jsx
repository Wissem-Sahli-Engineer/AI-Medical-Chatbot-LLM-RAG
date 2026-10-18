import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  AlertIcon, BookIcon, BrainIcon, CheckIcon, ChevronIcon, CopyIcon, ExternalIcon, FileIcon, Logo, RefreshIcon, ShieldIcon,
} from './icons.jsx'

// Turn "[2]" or "[1, 2]" citations into links that the renderer shows as small numbered chips.
// A reply that starts with "4. ..." (an answer, not a list) must not render as a numbered list.
const withCitations = (text) =>
  text.replace(/^([2-9]|\d{2,})\.(\s)/, '$1\\.$2').replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, nums) => nums.split(/\s*,\s*/).map((n) => `[${n}](#cite-${n})`).join(''))

const SOURCE_LABEL = { PubMedQA: 'PubMed', MedQuAD: 'NIH · MedQuAD', 'Your file': 'Your file' }
const SOURCE_CLASS = { PubMedQA: 'pubmed', MedQuAD: 'nih', 'Your file': 'file' }

function Process({ steps, reasoning, busy, writing }) {
  const [open, setOpen] = useState(null) // null = automatic: open while reasoning streams
  const expanded = open ?? (busy && !writing && !!reasoning)
  const current = steps.at(-1)
  return (
    <div className={`process ${expanded ? 'open' : ''}`}>
      <button className="process-head" onClick={() => setOpen(!expanded)}>
        {busy && !writing ? <span className="spinner" /> : <BrainIcon />}
        <span>
          {busy && !writing
            ? (reasoning ? 'Reasoning…' : `${current?.label ?? 'Starting'}…`)
            : `Process · ${steps.length} step${steps.length > 1 ? 's' : ''}${reasoning ? ' + reasoning' : ''}`}
        </span>
        <ChevronIcon open={expanded} />
      </button>
      {expanded && (
        <div className="process-body">
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={i}>
                <span className="step-dot" />
                <div><strong>{s.label}</strong>{s.detail && <span>{s.detail}</span>}</div>
              </li>
            ))}
          </ol>
          {reasoning && (
            <div className="reasoning">
              <div className="reasoning-label"><BrainIcon size={13} /> Model reasoning</div>
              <p>{reasoning.trim()}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
                <span className={`badge ${SOURCE_CLASS[s.source] ?? ''}`}>{SOURCE_LABEL[s.source] ?? s.source}</span>
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

export default function Message({ message: m, isLast, onRegenerate }) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [highlight, setHighlight] = useState(null)
  const [copied, setCopied] = useState(false)

  if (m.role === 'user') {
    return (
      <div className="msg user">
        {m.attachments?.length > 0 && (
          <div className="user-attachments">
            {m.attachments.map((a) => a.kind === 'image'
              ? <img key={a.id} src={a.thumb} alt={a.name} className="user-image" />
              : <span key={a.id} className="user-file"><FileIcon size={15} /> {a.name}</span>)}
          </div>
        )}
        {m.content && <div className="bubble">{m.content}</div>}
      </div>
    )
  }

  const category = m.meta?.category
  const busy = m.status && m.status !== 'done'
  const writing = m.status === 'writing'

  const openSource = (n) => {
    setSourcesOpen(true)
    setHighlight(n)
    setTimeout(() => document.getElementById(`src-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.content.replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, ''))
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
        {(m.steps?.length > 0 || busy) && (
          <Process steps={m.steps ?? []} reasoning={m.reasoning} busy={busy} writing={writing} />
        )}

        {category === 'emergency' && m.content ? (
          <div className="emergency"><AlertIcon /><div>{markdown}</div></div>
        ) : (
          m.content && <div className={`markdown ${writing ? 'typing' : ''}`}>{markdown}</div>
        )}

        {m.caution && <div className="caution"><ShieldIcon size={15} /> {m.caution}</div>}
        {m.error && <div className="error">Something went wrong: {m.error}</div>}
        {m.stopped && <div className="stopped">Stopped.</div>}

        {m.sources?.length > 0 && !busy && (
          <Sources sources={m.sources} highlight={highlight} open={sourcesOpen} onToggle={() => setSourcesOpen((o) => !o)} />
        )}

        {!busy && (m.content || m.error || m.stopped) && (
          <div className="msg-foot">
            {m.disclaimer && <span className="disclaimer">{m.disclaimer}</span>}
            <span className="msg-actions">
              {m.latency != null && <span className="latency">{m.latency}s</span>}
              {m.content && (
                <button className="icon-btn small" onClick={copy} aria-label="Copy answer" title="Copy">{copied ? <CheckIcon /> : <CopyIcon />}</button>
              )}
              {isLast && onRegenerate && (
                <button className="icon-btn small" onClick={onRegenerate} aria-label="Regenerate answer" title="Regenerate"><RefreshIcon /></button>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
