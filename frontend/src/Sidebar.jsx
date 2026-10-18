import { CloseIcon, Logo, PlusIcon, TrashIcon } from './icons.jsx'

function statusOf(health) {
  if (!health) return { cls: 'loading', label: 'Connecting…' }
  if (health.index === 'offline') return { cls: 'error', label: 'Backend offline' }
  if (health.llm === 'offline') return { cls: 'error', label: 'Ollama is not running' }
  if (health.llm === 'model_missing') return { cls: 'error', label: 'MedGemma model missing' }
  if (health.index === 'error') return { cls: 'error', label: 'Index failed to load' }
  if (health.index === 'loading') return { cls: 'loading', label: 'Loading knowledge base…' }
  return { cls: 'ok', label: 'MedGemma 1.5 4B · local' }
}

export default function Sidebar({ open, conversations, activeId, health, onNew, onSelect, onDelete, onClose }) {
  const status = statusOf(health)
  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-head">
          <div className="brand"><Logo size={26} /><span>MedRAG</span></div>
          <button className="icon-btn mobile-only" onClick={onClose} aria-label="Close menu"><CloseIcon /></button>
        </div>

        <button className="new-chat" onClick={onNew}><PlusIcon /> New chat</button>

        <nav className="history">
          {conversations.length > 0 && <div className="history-label">Recent</div>}
          {conversations.map((c) => (
            <div key={c.id} className={`history-item ${c.id === activeId ? 'active' : ''}`}>
              <button className="history-title" onClick={() => onSelect(c.id)} title={c.title}>{c.title}</button>
              <button className="history-delete" onClick={() => onDelete(c.id)} aria-label="Delete conversation"><TrashIcon /></button>
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className={`dot ${status.cls}`} />
          <span>{status.label}</span>
        </div>
      </aside>
    </>
  )
}
