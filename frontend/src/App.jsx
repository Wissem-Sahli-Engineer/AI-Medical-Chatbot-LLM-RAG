import { useCallback, useEffect, useRef, useState } from 'react'
import { getHealth, streamChat } from './api.js'
import Sidebar from './Sidebar.jsx'
import Message from './Message.jsx'
import Composer from './Composer.jsx'
import Settings from './Settings.jsx'
import { ArrowDownIcon, DownloadIcon, Logo, MonitorIcon, MoonIcon, NewChatIcon, PanelIcon, SunIcon, TrashIcon } from './icons.jsx'
import { exportMarkdown, load, newId, save } from './utils.js'

const SUGGESTIONS = [
  { title: 'Iron deficiency anemia', prompt: 'What are the symptoms of iron deficiency anemia?' },
  { title: 'Maladie de Lyme', prompt: 'Comment se transmet la maladie de Lyme ?' },
  { title: "Parkinson's disease", prompt: "What is the outlook for people with Parkinson's disease?" },
  { title: 'Asthme', prompt: "Qu'est-ce que l'asthme et comment le traite-t-on ?" },
]

const DEFAULT_SETTINGS = { theme: 'system', showReasoning: false, topK: 3 }
const THEMES = ['system', 'light', 'dark']
const THEME_ICON = { system: MonitorIcon, light: SunIcon, dark: MoonIcon }

function loadConversations() {
  const saved = load('medrag-conversations', [])
  if (!Array.isArray(saved)) return []
  // An answer interrupted by a page reload cannot resume: mark it as stopped.
  return saved.map((c) => ({
    ...c,
    messages: c.messages.map((m) => (m.status && m.status !== 'done' ? { ...m, status: 'done', stopped: true } : m)),
  }))
}

export default function App() {
  const [conversations, setConversations] = useState(loadConversations)
  const [activeId, setActiveId] = useState(null)
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...load('medrag-settings', {}) }))
  const [sidebarOpen, setSidebarOpen] = useState(() => load('medrag-sidebar', true))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [health, setHealth] = useState(null)
  const [streaming, setStreaming] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const abortRef = useRef(null)
  const scrollRef = useRef(null)
  const payloads = useRef({}) // full attachments of each conversation's last question, for "regenerate"

  const active = conversations.find((c) => c.id === activeId)
  const messages = active?.messages ?? []
  const ready = health?.index === 'ready' && health?.llm === 'ready'

  useEffect(() => save('medrag-conversations', conversations), [conversations])
  useEffect(() => save('medrag-settings', settings), [settings])
  useEffect(() => save('medrag-sidebar', sidebarOpen), [sidebarOpen])

  // Theme: "system" follows the operating system; light and dark force it.
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  // Poll the backend until the index and the model are ready, then every 15 s.
  useEffect(() => {
    let timer
    const poll = async () => {
      let h
      try { h = await getHealth() } catch { h = { index: 'offline', llm: 'offline' } }
      setHealth(h)
      timer = setTimeout(poll, h.index === 'ready' && h.llm === 'ready' ? 15000 : 3000)
    }
    poll()
    return () => clearTimeout(timer)
  }, [])

  // Follow the answer while it streams, unless the user scrolled up.
  useEffect(() => {
    if (atBottom) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, atBottom])

  const onScroll = () => {
    const el = scrollRef.current
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }

  const newChat = useCallback(() => { setActiveId(null); setMobileOpen(false) }, [])

  // Keyboard shortcuts: Ctrl/Cmd+Shift+O new chat, Ctrl/Cmd+B toggle the panel, Esc stops the answer.
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); newChat() }
      else if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); setSidebarOpen((o) => !o) }
      else if (e.key === 'Escape') abortRef.current?.abort()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newChat])

  const updateLast = (convId, fn) =>
    setConversations((cs) =>
      cs.map((c) => {
        if (c.id !== convId) return c
        const msgs = [...c.messages]
        msgs[msgs.length - 1] = fn(msgs[msgs.length - 1])
        return { ...c, messages: msgs }
      }),
    )

  async function ask(convId, question, attachments, previous) {
    const history = previous.filter((m) => m.content).slice(-6).map((m) => ({ role: m.role, content: m.content }))
    const payload = {
      message: question,
      history,
      images: attachments.filter((a) => a.kind === 'image').map((a) => a.data),
      files: attachments.filter((a) => a.kind === 'file').map((a) => ({ name: a.name, data: a.data })),
      show_reasoning: settings.showReasoning,
      top_k: settings.topK,
    }
    const controller = new AbortController()
    abortRef.current = controller
    setStreaming(true)
    setAtBottom(true)
    const started = Date.now()
    try {
      await streamChat(
        payload,
        (ev) =>
          updateLast(convId, (m) => {
            switch (ev.type) {
              case 'meta': return { ...m, meta: ev }
              case 'step': return { ...m, steps: [...(m.steps ?? []), { label: ev.label, detail: ev.detail }] }
              case 'reasoning': return { ...m, reasoning: (m.reasoning ?? '') + ev.text, status: 'reasoning' }
              case 'sources': return { ...m, sources: ev.sources }
              case 'token': return { ...m, content: m.content + ev.text, status: 'writing' }
              case 'caution': return { ...m, caution: ev.text }
              case 'done': return { ...m, disclaimer: ev.disclaimer, latency: ev.latency_s, status: 'done' }
              case 'error': return { ...m, error: ev.message, status: 'done' }
              default: return m
            }
          }),
        controller.signal,
      )
    } catch (e) {
      const aborted = e.name === 'AbortError'
      updateLast(convId, (m) => ({ ...m, status: 'done', stopped: aborted, error: aborted ? null : e.message,
                                   latency: Math.round((Date.now() - started) / 100) / 10 }))
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function send(text, attachments = []) {
    const question = text.trim()
    if ((!question && !attachments.some((a) => a.kind === 'image')) || streaming || !ready) return
    const userMsg = {
      role: 'user',
      content: question,
      attachments: attachments.map(({ data, ...rest }) => rest), // thumbnails only: images stay out of storage
    }
    const botMsg = { role: 'assistant', content: '', status: 'working', steps: [] }
    let convId = activeId
    const previous = active?.messages ?? []
    if (!convId) {
      convId = newId()
      const title = question || attachments[0]?.name || 'New chat'
      setConversations((cs) => [{ id: convId, title: title.slice(0, 60), messages: [userMsg, botMsg] }, ...cs])
      setActiveId(convId)
    } else {
      setConversations((cs) => cs.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, userMsg, botMsg] } : c)))
    }
    payloads.current[convId] = attachments
    ask(convId, question, attachments, previous)
  }

  function regenerate() {
    if (!active || streaming) return
    const msgs = active.messages
    const lastUser = msgs.findLastIndex((m) => m.role === 'user')
    if (lastUser < 0) return
    const botMsg = { role: 'assistant', content: '', status: 'working', steps: [] }
    setConversations((cs) => cs.map((c) => (c.id === active.id ? { ...c, messages: [...msgs.slice(0, lastUser + 1), botMsg] } : c)))
    ask(active.id, msgs[lastUser].content, payloads.current[active.id] ?? [], msgs.slice(0, lastUser))
  }

  function deleteConversation(id) {
    setConversations((cs) => cs.filter((c) => c.id !== id))
    if (id === activeId) setActiveId(null)
  }

  const renameConversation = (id, title) =>
    setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, title: title.trim() || c.title } : c)))

  const cycleTheme = () =>
    setSettings((s) => ({ ...s, theme: THEMES[(THEMES.indexOf(s.theme) + 1) % THEMES.length] }))
  const ThemeIcon = THEME_ICON[settings.theme]

  const composer = (
    <Composer onSend={send} onStop={() => abortRef.current?.abort()} streaming={streaming} ready={ready} health={health} />
  )

  return (
    <div className={`app ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <Sidebar
        open={sidebarOpen}
        mobileOpen={mobileOpen}
        conversations={conversations}
        activeId={activeId}
        health={health}
        onNew={newChat}
        onSelect={(id) => { setActiveId(id); setMobileOpen(false) }}
        onDelete={deleteConversation}
        onRename={renameConversation}
        onCollapse={() => (window.matchMedia('(max-width: 820px)').matches ? setMobileOpen(false) : setSidebarOpen(false))}
        onSettings={() => setSettingsOpen(true)}
      />

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-only" onClick={() => setMobileOpen(true)} aria-label="Open menu"><PanelIcon /></button>
            {!sidebarOpen && (
              <span className="desktop-only">
                <button className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar" title="Open sidebar (Ctrl+B)"><PanelIcon /></button>
                <button className="icon-btn" onClick={newChat} aria-label="New chat" title="New chat (Ctrl+Shift+O)"><NewChatIcon /></button>
              </span>
            )}
            <span className="topbar-title">{active ? active.title : 'MedRAG'}</span>
          </div>
          <div className="topbar-right">
            {active && (
              <>
                <button className="icon-btn" onClick={() => exportMarkdown(active)} aria-label="Export conversation" title="Export as Markdown"><DownloadIcon /></button>
                <button className="icon-btn danger" onClick={() => deleteConversation(active.id)} aria-label="Delete conversation" title="Delete conversation"><TrashIcon size={17} /></button>
              </>
            )}
            <button className="icon-btn" onClick={cycleTheme} aria-label={`Theme: ${settings.theme}`} title={`Theme: ${settings.theme} (click to change)`}><ThemeIcon /></button>
          </div>
        </header>

        {messages.length === 0 ? (
          <div className="empty">
            <div className="hero">
              <Logo size={48} />
              <h1>How can I help with your health question?</h1>
              <p>Ask in English or French, or add a photo or a document. Answers cite PubMed abstracts and NIH health pages.</p>
            </div>
            {composer}
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s.prompt} className="suggestion" onClick={() => send(s.prompt)} disabled={!ready || streaming}>
                  <strong>{s.title}</strong>
                  <span>{s.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="thread" ref={scrollRef} onScroll={onScroll}>
              <div className="thread-inner">
                {messages.map((m, i) => (
                  <Message key={i} message={m} isLast={i === messages.length - 1} onRegenerate={streaming ? null : regenerate} />
                ))}
              </div>
            </div>
            {!atBottom && (
              <button className="to-bottom" onClick={() => setAtBottom(true)} aria-label="Scroll to bottom"><ArrowDownIcon size={17} /></button>
            )}
            {composer}
          </>
        )}
      </main>

      {settingsOpen && (
        <Settings
          settings={settings}
          setSettings={setSettings}
          health={health}
          count={conversations.length}
          onClearAll={() => { setConversations([]); setActiveId(null) }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
