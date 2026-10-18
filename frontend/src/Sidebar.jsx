import { useState } from 'react'
import { Logo, NewChatIcon, PanelIcon, PencilIcon, SearchIcon, SettingsIcon, TrashIcon } from './icons.jsx'

function statusOf(health) {
  if (!health) return { cls: 'loading', label: 'Connecting…' }
  if (health.index === 'offline') return { cls: 'error', label: 'Backend offline' }
  if (health.llm === 'offline') return { cls: 'error', label: 'Ollama is not running' }
  if (health.llm === 'model_missing') return { cls: 'error', label: 'MedGemma model missing' }
  if (health.index === 'error') return { cls: 'error', label: 'Index failed to load' }
  if (health.index === 'loading') return { cls: 'loading', label: 'Loading knowledge base…' }
  return { cls: 'ok', label: 'MedGemma 1.5 4B · local' }
}

function HistoryItem({ conv, active, onSelect, onDelete, onRename }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(conv.title)
  const commit = () => { onRename(conv.id, title); setEditing(false) }

  return (
    <div className={`history-item ${active ? 'active' : ''}`}>
      {editing ? (
        <input
          className="history-input"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setTitle(conv.title); setEditing(false) } }}
        />
      ) : (
        <button className="history-title" onClick={() => onSelect(conv.id)} onDoubleClick={() => setEditing(true)} title={conv.title}>
          {conv.title}
        </button>
      )}
      {!editing && (
        <span className="history-actions">
          <button onClick={() => { setTitle(conv.title); setEditing(true) }} aria-label="Rename conversation" title="Rename"><PencilIcon /></button>
          <button className="danger" onClick={() => onDelete(conv.id)} aria-label="Delete conversation" title="Delete"><TrashIcon size={15} /></button>
        </span>
      )}
    </div>
  )
}

export default function Sidebar({ open, mobileOpen, conversations, activeId, health, onNew, onSelect, onDelete, onRename, onCollapse, onSettings }) {
  const [query, setQuery] = useState('')
  const status = statusOf(health)
  const shown = conversations.filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <>
      <div className={`scrim ${mobileOpen ? 'show' : ''}`} onClick={onCollapse} />
      <aside className={`sidebar ${open ? '' : 'collapsed'} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-head">
          <div className="brand"><Logo size={26} /><span>MedRAG</span></div>
          <button className="icon-btn" onClick={onCollapse} aria-label="Close sidebar" title="Close sidebar (Ctrl+B)"><PanelIcon /></button>
        </div>

        <button className="new-chat" onClick={onNew}><NewChatIcon size={17} /> New chat</button>

        {conversations.length > 0 && (
          <label className="search">
            <SearchIcon />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" />
          </label>
        )}

        <nav className="history">
          {conversations.length > 0 && <div className="history-label">Recent</div>}
          {shown.map((c) => (
            <HistoryItem key={c.id} conv={c} active={c.id === activeId} onSelect={onSelect} onDelete={onDelete} onRename={onRename} />
          ))}
          {conversations.length > 0 && shown.length === 0 && <div className="history-empty">No chat matches “{query}”.</div>}
          {conversations.length === 0 && <div className="history-empty">Your conversations will appear here.</div>}
        </nav>

        <div className="sidebar-foot">
          <div className="status" title={health?.chunks ? `${health.chunks.toLocaleString()} indexed passages` : ''}>
            <span className={`dot ${status.cls}`} />
            <span>{status.label}</span>
          </div>
          <button className="icon-btn" onClick={onSettings} aria-label="Settings" title="Settings"><SettingsIcon /></button>
        </div>
      </aside>
    </>
  )
}
