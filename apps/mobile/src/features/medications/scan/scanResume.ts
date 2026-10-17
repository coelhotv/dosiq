// Retomar o scan depois dos Ajustes do iPhone (spec 066 D1 · smoke C-D1-6, PO 2026-10-17).
//
// O iOS ENCERRA o app quando a pessoa muda uma permissão de privacidade nos Ajustes: quem foi
// liberar a câmera pela tela "bloqueada" voltava para o app aberto do zero, na aba Hoje, e tinha de
// refazer o caminho. No Android o processo sobrevive e a tela relê a permissão ao voltar (C-D1-5),
// então a marca só existe no iPhone.
//
// A marca vale uma vez e por pouco tempo. Abertura por alarme de dose ou por notificação vem antes e
// a descarta (R-309: obrigação clínica não é atropelada pela conveniência do cadastro).

import AsyncStorage from '@react-native-async-storage/async-storage'

export const SCAN_RESUME_KEY = '@dosiq/scan-resume'
export const SCAN_RESUME_TTL_MS = 5 * 60 * 1000

export interface ScanResumeMarker {
  at: number
  entryPoint: string
}

interface ResumeDecisionInput {
  marker: ScanResumeMarker | null
  now: number
  launchedByNotification: boolean
  currentRoute: string | null | undefined
  alarmRoute: string
}

/** Retoma só com marca recente, sem abertura por alarme/notificação e fora da tela do alarme. */
export function shouldResumeScan({ marker, now, launchedByNotification, currentRoute, alarmRoute }: ResumeDecisionInput): boolean {
  if (!marker || !Number.isFinite(marker.at)) return false
  const age = now - marker.at
  if (age < 0 || age > SCAN_RESUME_TTL_MS) return false
  if (launchedByNotification) return false
  return currentRoute !== alarmRoute
}

function parseMarker(raw: string | null): ScanResumeMarker | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (typeof value?.at !== 'number' || typeof value?.entryPoint !== 'string') return null
    return { at: value.at, entryPoint: value.entryPoint }
  } catch {
    return null
  }
}

export async function markScanResume(entryPoint: string, now = Date.now()): Promise<void> {
  try {
    await AsyncStorage.setItem(SCAN_RESUME_KEY, JSON.stringify({ at: now, entryPoint }))
  } catch {
    // Fail-open: sem a marca a pessoa só refaz o caminho, como antes.
  }
}

export async function clearScanResume(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SCAN_RESUME_KEY)
  } catch {
    // idem
  }
}

/** Lê e APAGA a marca: vale uma vez, retomando ou não. */
export async function takeScanResume(): Promise<ScanResumeMarker | null> {
  try {
    const raw = await AsyncStorage.getItem(SCAN_RESUME_KEY)
    await AsyncStorage.removeItem(SCAN_RESUME_KEY)
    return parseMarker(raw)
  } catch {
    return null
  }
}
