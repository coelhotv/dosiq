// TODO(040-strict): monorepo hoisting faz o d.ts real de lucide-react-native
// não resolver 'react-native-svg' (pacote fica só em apps/mobile/node_modules,
// lucide-react-native fica hoisted na raiz) — TS cai num shape incompatível
// (SVGSVGElement web). Shim mínimo até resolver hoisting real.
declare module 'lucide-react-native' {
  import type { ComponentType } from 'react'
  import type { SvgProps } from 'react-native-svg'

  export interface LucideProps extends SvgProps {
    size?: string | number
    strokeWidth?: string | number
    absoluteStrokeWidth?: boolean
  }

  export type LucideIcon = ComponentType<LucideProps>

  export const AlertTriangle: LucideIcon
  export const AlertCircle: LucideIcon
  export const CheckCircle: LucideIcon
  export const Info: LucideIcon
  export const X: LucideIcon
  export const Search: LucideIcon
  export const Calendar: LucideIcon
  export const ChevronDown: LucideIcon
  export const Check: LucideIcon
  export const Clock: LucideIcon
  export const Pill: LucideIcon
  export const Tablets: LucideIcon
  export const Droplets: LucideIcon
  export const Syringe: LucideIcon
  export const SoapDispenserDroplet: LucideIcon
  export const SprayCan: LucideIcon
  export const PillBottle: LucideIcon
  export const Sun: LucideIcon
  export const UserPlus: LucideIcon
  export const LogIn: LucideIcon
  export const Bell: LucideIcon
  export const Package: LucideIcon
  export const ArrowLeft: LucideIcon
  export const Eye: LucideIcon
  export const EyeOff: LucideIcon
  export const Mail: LucideIcon
  export const ShieldCheck: LucideIcon
}
