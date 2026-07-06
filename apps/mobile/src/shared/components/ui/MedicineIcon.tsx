// MedicineIcon.jsx — binding mobile do ícone canônico de medicamento (012 Fase A).
// A LÓGICA vive em @dosiq/core (getMedicineIconName); aqui só nome→componente lucide.
// Toda superfície que identifica um medicamento por ícone DEVE usar este componente
// (não importar Pill/Droplets direto) — fonte única, evita drift entre telas.
//
import {
  Pill,
  Tablets,
  Droplets,
  Syringe,
  SoapDispenserDroplet,
  SprayCan,
  PillBottle,
} from 'lucide-react-native'
import { getMedicineIconName } from '@dosiq/core'

const ICON_BY_NAME = {
  pill: Pill,
  tablets: Tablets,
  droplets: Droplets,
  syringe: Syringe,
  'soap-dispenser-droplet': SoapDispenserDroplet,
  'spray-can': SprayCan,
  'pill-bottle': PillBottle,
}

/**
 * Ícone de identificação do medicamento (forma farmacêutica/categoria).
 * @param {{medicine: Object, size?: number}} props — demais props repassadas ao glifo lucide
 */
export default function MedicineIcon({ medicine, size = 20, ...rest }) {
  const Icon = ICON_BY_NAME[getMedicineIconName(medicine)] ?? Pill
  return <Icon size={size} {...rest} />
}
