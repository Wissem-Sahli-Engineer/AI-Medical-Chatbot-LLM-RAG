const svg = (size, children, props = {}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
)

export const Logo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo">
    <rect width="32" height="32" rx="9" fill="var(--accent)" />
    <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff" />
  </svg>
)

export const PlusIcon = ({ size = 18 }) => svg(size, <path d="M12 5v14M5 12h14" />)
export const NewChatIcon = ({ size = 18 }) => svg(size, <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>)
export const MenuIcon = ({ size = 20 }) => svg(size, <path d="M4 6h16M4 12h16M4 18h16" />)
export const PanelIcon = ({ size = 19 }) => svg(size, <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></>)
export const CloseIcon = ({ size = 18 }) => svg(size, <path d="M18 6 6 18M6 6l12 12" />)
export const TrashIcon = ({ size = 16 }) => svg(size, <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />)
export const PencilIcon = ({ size = 15 }) => svg(size, <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />)
export const ArrowUpIcon = ({ size = 18 }) => svg(size, <path d="M12 19V5M5 12l7-7 7 7" />, { strokeWidth: 2.4 })
export const ArrowDownIcon = ({ size = 18 }) => svg(size, <path d="M12 5v14M19 12l-7 7-7-7" />)
export const StopIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" /></svg>
)
export const CopyIcon = ({ size = 15 }) => svg(size, <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>)
export const CheckIcon = ({ size = 15 }) => svg(size, <path d="M20 6 9 17l-5-5" />)
export const RefreshIcon = ({ size = 15 }) => svg(size, <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></>)
export const DownloadIcon = ({ size = 17 }) => svg(size, <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>)
export const AlertIcon = ({ size = 18 }) => svg(size, <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>)
export const BookIcon = ({ size = 14 }) => svg(size, <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5V21h16" /></>)
export const ExternalIcon = ({ size = 13 }) => svg(size, <><path d="M15 3h6v6M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>)
export const ChevronIcon = ({ size = 14, open }) => svg(size, <path d="m9 6 6 6-6 6" />, { style: { transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' } })
export const SettingsIcon = ({ size = 18 }) => svg(size, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>)
export const SunIcon = ({ size = 18 }) => svg(size, <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>)
export const MoonIcon = ({ size = 18 }) => svg(size, <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />)
export const MonitorIcon = ({ size = 18 }) => svg(size, <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>)
export const ImageIcon = ({ size = 17 }) => svg(size, <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-4.5-4.5L6 21" /></>)
export const FileIcon = ({ size = 17 }) => svg(size, <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>)
export const PaperclipIcon = ({ size = 18 }) => svg(size, <path d="m21 11-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l8-8" />)
export const SearchIcon = ({ size = 15 }) => svg(size, <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>)
export const SparkIcon = ({ size = 15 }) => svg(size, <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />)
export const BrainIcon = ({ size = 15 }) => svg(size, <><path d="M9.5 2A2.5 2.5 0 0 0 7 4.5v.3A3 3 0 0 0 4.5 9a3 3 0 0 0 .4 5.4A3 3 0 0 0 8 19.5a2.5 2.5 0 0 0 4 .5V4.5A2.5 2.5 0 0 0 9.5 2z" /><path d="M14.5 2A2.5 2.5 0 0 1 17 4.5v.3A3 3 0 0 1 19.5 9a3 3 0 0 1-.4 5.4A3 3 0 0 1 16 19.5a2.5 2.5 0 0 1-4 .5" /></>)
export const ShieldIcon = ({ size = 14 }) => svg(size, <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />)
