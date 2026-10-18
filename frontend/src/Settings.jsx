import { useEffect, useState } from 'react'
import { CloseIcon, MonitorIcon, MoonIcon, SunIcon } from './icons.jsx'

const THEMES = [
  { id: 'system', label: 'System', Icon: MonitorIcon },
  { id: 'light', label: 'Light', Icon: SunIcon },
  { id: 'dark', label: 'Dark', Icon: MoonIcon },
]

function Toggle({ checked, onChange, label }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

export default function Settings({ settings, setSettings, health, count, onClearAll, onClose }) {
  const [confirm, setConfirm] = useState(false)
  const set = (patch) => setSettings((s) => ({ ...s, ...patch }))

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings"><CloseIcon /></button>
        </div>

        <section>
          <h3>Appearance</h3>
          <div className="row">
            <div><strong>Theme</strong><span>Follow the system, or force light or dark.</span></div>
            <div className="segmented">
              {THEMES.map(({ id, label, Icon }) => (
                <button key={id} className={settings.theme === id ? 'active' : ''} onClick={() => set({ theme: id })}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h3>Answers</h3>
          <div className="row">
            <div>
              <strong>Show the model's reasoning</strong>
              <span>MedGemma thinks step by step before answering a health question. Slower (about 2× longer).</span>
            </div>
            <Toggle checked={settings.showReasoning} onChange={(v) => set({ showReasoning: v })} label="Show the model's reasoning" />
          </div>
          <div className="row">
            <div>
              <strong>Sources per answer</strong>
              <span>Passages retrieved from PubMed and NIH. More sources give more context but slower answers.</span>
            </div>
            <div className="range">
              <input type="range" min="1" max="5" value={settings.topK} onChange={(e) => set({ topK: Number(e.target.value) })} />
              <output>{settings.topK}</output>
            </div>
          </div>
        </section>

        <section>
          <h3>Data</h3>
          <div className="row">
            <div><strong>Delete all conversations</strong><span>{count} saved in this browser only. Nothing is sent to a server.</span></div>
            {confirm ? (
              <span className="confirm">
                <button className="btn danger" onClick={() => { onClearAll(); setConfirm(false) }}>Delete all</button>
                <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
              </span>
            ) : (
              <button className="btn" onClick={() => setConfirm(true)} disabled={!count}>Delete all</button>
            )}
          </div>
        </section>

        <section>
          <h3>About</h3>
          <dl className="about">
            <dt>Model</dt><dd>MedGemma 1.5 4B-it, 4-bit (Q4_K_M), via Ollama on this computer</dd>
            <dt>Knowledge base</dt><dd>{health?.chunks ? `${health.chunks.toLocaleString()} passages` : '…'} from PubMedQA and MedQuAD (NIH)</dd>
            <dt>Shortcuts</dt><dd><kbd>Enter</kbd> send · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line · <kbd>Ctrl/⌘</kbd>+<kbd>B</kbd> panel · <kbd>Ctrl/⌘</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> new chat · <kbd>Esc</kbd> stop</dd>
          </dl>
        </section>
      </div>
    </div>
  )
}
