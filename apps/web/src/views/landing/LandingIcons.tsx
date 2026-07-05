/**
 * LandingIcons — Ícones SVG inline usados na Landing page.
 */
import React from 'react'

function PrototypeIcon({ children, className = '', size = 20, viewBox = '0 0 24 24' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function LogoMark({ className = '', size = 24 }) {
  return (
    <img
      src="/dosiq-logo-verde.png"
      width={size}
      height={size}
      className={className}
      alt="dosiq"
      aria-hidden="true"
      style={{ display: 'block' }}
    />
  )
}

export function ZapIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </PrototypeIcon>
  )
}

export function ArrowRightIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </PrototypeIcon>
  )
}

export function DatabaseIcon({ className = '', size = 18 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </PrototypeIcon>
  )
}

export function LockIcon({ className = '', size = 18 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </PrototypeIcon>
  )
}

export function BellIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </PrototypeIcon>
  )
}

export function PackageIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <path d="m7.5 4.27 9 5.15" />
    </PrototypeIcon>
  )
}

export function CalendarIcon({ className = '', size = 14 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </PrototypeIcon>
  )
}

export function ShieldCheckIcon({ className = '', size = 16 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </PrototypeIcon>
  )
}

export function MessageCircleIcon({ className = '', size = 24 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
    </PrototypeIcon>
  )
}

export function FileTextIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </PrototypeIcon>
  )
}

export function ActivityIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </PrototypeIcon>
  )
}

export function SmartphoneIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </PrototypeIcon>
  )
}

export function ClockIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M12 6v6l4 2" />
      <circle cx="12" cy="12" r="10" />
    </PrototypeIcon>
  )
}

export function DownloadIcon({ className = '', size = 20 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <path d="M12 15V3" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
    </PrototypeIcon>
  )
}

export function CircleCheckIcon({ className = '', size = 18 }) {
  return (
    <PrototypeIcon className={className} size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </PrototypeIcon>
  )
}
