import { useEffect, useRef, useState } from 'react'
import { getHealth, streamChat } from './api.js'
import Sidebar from './Sidebar.jsx'
import Message from './Message.jsx'
import Composer from './Composer.jsx'
import { Logo, MenuIcon } from './icons.jsx'

const STORAGE_KEY = 'medrag-conversations'

const SUGGESTIONS = [
  { title: 'Iron deficiency anemia', prompt: 'What are the symptoms of iron deficiency anemia?' },
  { title: 'Maladie de Lyme', prompt: 'Comment se transmet la maladie de Lyme ?' },
  { title: "Parkinson's disease", prompt: "What is the outlook for people with Parkinson's disease?" },
  { title: 'Asthme', prompt: "Qu'est-ce que l'asthme et comment le traite-t-on ?" },
]

const newId = () => Math.random().toString(36).slice(2, 10)

function loadConversations() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(saved)) return []
    // An answer interrupted by a page reload cannot resume: mark it as stopped.
    return saved.map((c) => ({
      ...c,
      messages: c.messages.map((m) => (m.status && m.status !== 'done' ? { ...m, status: 'done', stopped: true } : m)),
    }))
  } catch {
    return []
  }
}

export default function App() {
  const [conversations, setConversations] = useState(loadConversations)
  const [activeId, setActiveId] = useState(null)
  const [health, setHealth] = useState(null)
  const [streaming, setStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const abortRef = useRef(null)
  const scrollRef = useRef(null)

  const active = conversations.find((c) => c.id === activeId)
  const messages = active?.messages ?? []
  const ready = health?.index === 'ready' && health?.llm === 'ready'

  // Save conversations (without the ones still streaming) in this browser.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
    } catch { /* storage unavailable */ }
  }, [conversations])

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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const updateLast = (convId, fn) =>
    setConversations((cs) =>
      cs.map((c) => {
        if (c.id !== convId) return c
        const msgs = [...c.messages]
        msgs[msgs.length - 1] = fn(msgs[msgs.length - 1])
        return { ...c, messages: msgs }
      }),
    )

  async function send(text) {
    const question = text.trim()
    if (!question || streaming) return
    let convId = activeId
    const userMsg = { role: 'user', content: question }
    const botMsg = { role: 'assistant', content: '', status: 'routing', sources: [] }
    if (!convId) {
      convId = newId()
      setConversations((cs) => [{ id: convId, title: question.slice(0, 60), messages: [userMsg, botMsg] }, ...cs])
      setActiveId(convId)
    } else {
      setConversations((cs) => cs.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, userMsg, botMsg] } : c)))
    }

    const controller = new AbortController()
    abortRef.current = controller
    setStreaming(true)
    try {
      await streamChat(
        question,
        (ev) =>
          updateLast(convId, (m) => {
            switch (ev.type) {
              case 'meta':
                return { ...m, meta: ev, status: ev.category === 'answered' || ev.category === 'prescription' || ev.category === 'diagnosis' ? 'searching' : 'writing' }
              case 'sources':
                return { ...m, sources: ev.sources, query: ev.query, status: 'writing' }
              case 'token':
                return { ...m, content: m.content + ev.text, status: 'writing' }
              case 'caution':
                return { ...m, caution: ev.text }
              case 'done':
                return { ...m, disclaimer: ev.disclaimer, latency: ev.latency_s, status: 'done' }
              case 'error':
                return { ...m, error: ev.message, status: 'done' }
              default:
                return m
            }
          }),
        controller.signal,
      )
    } catch (e) {
      updateLast(convId, (m) => ({ ...m, status: 'done', error: e.name === 'AbortError' ? null : e.message, stopped: e.name === 'AbortError' }))
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function deleteConversation(id) {
    setConversations((cs) => cs.filter((c) => c.id !== id))
    if (id === activeId) setActiveId(null)
  }

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        conversations={conversations}
        activeId={activeId}
        health={health}
        onNew={() => { setActiveId(null); setSidebarOpen(false) }}
        onSelect={(id) => { setActiveId(id); setSidebarOpen(false) }}
        onDelete={deleteConversation}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <span className="topbar-title">MedRAG</span>
        </header>

        {messages.length === 0 ? (
          <div className="empty">
            <Logo size={44} />
            <h1>How can I help with your health question?</h1>
            <p>Ask in English or French. Answers come from PubMed abstracts and NIH health pages, with their sources.</p>
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
          <div className="thread" ref={scrollRef}>
            <div className="thread-inner">
              {messages.map((m, i) => <Message key={i} message={m} />)}
            </div>
          </div>
        )}

        <Composer
          onSend={send}
          onStop={() => abortRef.current?.abort()}
          streaming={streaming}
          ready={ready}
          health={health}
        />
      </main>
    </div>
  )
}
