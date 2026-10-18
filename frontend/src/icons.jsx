const svg = (size, children, props = {}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
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
export const MenuIcon = ({ size = 20 }) => svg(size, <path d="M4 6h16M4 12h16M4 18h16" />)
export const CloseIcon = ({ size = 18 }) => svg(size, <path d="M18 6 6 18M6 6l12 12" />)
export const TrashIcon = ({ size = 15 }) => svg(size, <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />)
export const ArrowUpIcon = ({ size = 18 }) => svg(size, <path d="M12 19V5M5 12l7-7 7 7" />, { strokeWidth: 2.4 })
export const StopIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" /></svg>
)
export const CopyIcon = ({ size = 15 }) => svg(size, <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>)
export const CheckIcon = ({ size = 15 }) => svg(size, <path d="M20 6 9 17l-5-5" />)
export const AlertIcon = ({ size = 18 }) => svg(size, <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>)
export const BookIcon = ({ size = 14 }) => svg(size, <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5V21h16" /></>)
export const ExternalIcon = ({ size = 13 }) => svg(size, <><path d="M15 3h6v6M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>)
export const ChevronIcon = ({ size = 14, open }) => svg(size, <path d="m9 6 6 6-6 6" />, { style: { transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' } })
