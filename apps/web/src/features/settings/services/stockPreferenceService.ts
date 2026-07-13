// stockPreferenceService (web) — espelho do serviço mobile: ORIGEM COMUM de toda escrita da
// preferência de estoque (spec 044, F4b / T019 / FR-010).
//
// Mesma razão de existir do mobile: a preferência tem quatro escritores (onboarding, toggle de
// Settings, saldo inicial, upsell) e instrumentar tela a tela deixa um caminho sem evento. Aqui
// gravar e instrumentar é a MESMA chamada.
//
// ⚠️ `refresh()` do provider (AP-281) fica nos hooks — este módulo só escreve e instrumenta.
// A preferência é GLOBAL: web e mobile leem/escrevem a mesma linha (divergir = uma plataforma
// consome FIFO e a outra não — corrupção, classe AP-231).

import {
  createProfileRepository,
  createStockRepository,
  createStockActivationService,
  createStockResumeService,
  type InitialBalanceEntry,
  type StockActivationResult,
  type StockResumeAssessment,
} from '@dosiq/core'
import { supabase, getUserId } from '@shared/utils/supabase'
import { analyticsService } from '@dashboard/services/analyticsService'

const profileRepo = createProfileRepository({ client: supabase, getUserId })
const stockRepo = createStockRepository({ client: supabase, getUserId })
const activationService = createStockActivationService({ profileRepo, stockRepo })
const resumeService = createStockResumeService({ profileRepo, stockRepo })

/** De onde veio a ativação/desativação — separa conversão de upsell de opt-in manual. */
export type StockPreferenceSource = 'onboarding' | 'settings' | 'upsell'

/** Catálogo dos eventos do 044 — nunca usar string literal fora daqui. */
export const STOCK_EVENTS = {
  ONBOARDING_CHOICE: 'stock_onboarding_choice',
  OPT_IN: 'stock_opt_in',
  OPT_OUT: 'stock_opt_out',
  UPSELL_SHOWN: 'stock_upsell_shown',
  UPSELL_CONVERSION: 'stock_upsell_conversion',
  UPSELL_DISMISSED: 'stock_upsell_dismissed',
} as const

/** Escolha do modo no onboarding (FR-001) — dose-only também emite: é o numerador da métrica. */
export async function chooseStockModeInOnboarding(enabled: boolean): Promise<void> {
  // `freeze: false` — escolher dose-only no onboarding NÃO é congelar (não há saldo). Carimbar
  // faria o usuário nascer "congelado" e o toggle de Settings retomaria em silêncio em vez de
  // perguntar o saldo inicial (PO-3). Ver createProfileRepository.setStockTracking.
  await profileRepo.setStockTracking(enabled, { freeze: false })
  analyticsService.track(STOCK_EVENTS.ONBOARDING_CHOICE, { mode: enabled ? 'stock' : 'dose_only' })
  if (enabled) analyticsService.track(STOCK_EVENTS.OPT_IN, { source: 'onboarding' })
}

/** Ativa o estoque a partir do saldo inicial (PO-3 — sem retro-consumo). */
export async function activateStockWithInitialBalance(
  entries: InitialBalanceEntry[],
  source: StockPreferenceSource,
): Promise<StockActivationResult> {
  const result = await activationService.activateWithInitialBalance(entries)
  // Depois da escrita: ativação que falhou não vira opt-in na métrica.
  analyticsService.track(STOCK_EVENTS.OPT_IN, {
    source,
    counted: result.countedMedicineIds.length,
    skipped: result.skipped,
  })
  if (source === 'upsell') analyticsService.track(STOCK_EVENTS.UPSELL_CONVERSION, {})
  return result
}

/** Opt-out: CONGELA (zero mutação de saldo). */
export async function disableStockTracking(source: StockPreferenceSource = 'settings'): Promise<void> {
  await profileRepo.setStockTracking(false)
  analyticsService.track(STOCK_EVENTS.OPT_OUT, { source })
}

/** Reativação de quem já teve estoque: retoma o saldo congelado como estava. */
export async function resumeStockAsIs(
  source: StockPreferenceSource = 'settings',
): Promise<StockResumeAssessment> {
  const assessment = await resumeService.resumeAsIs()
  analyticsService.track(STOCK_EVENTS.OPT_IN, { source, resume: 'as_is' })
  return assessment
}

/** Reativação com descarte do saldo congelado (append-only — R-226). */
export async function resumeStockAndZero(
  source: StockPreferenceSource = 'settings',
): Promise<{ zeroedMedicineIds: string[] }> {
  const result = await resumeService.resumeAndZero()
  analyticsService.track(STOCK_EVENTS.OPT_IN, { source, resume: 'zeroed' })
  return result
}

/** Só leitura — decide entre retomada silenciosa e sheet de reconciliação. */
export function assessStockResume(): Promise<StockResumeAssessment> {
  return resumeService.assessResume()
}

/** O card de upsell apareceu (denominador da taxa de conversão — SC-004). */
export function trackStockUpsellShown(): void {
  analyticsService.track(STOCK_EVENTS.UPSELL_SHOWN, {})
}

/** "Agora não": dismiss persistente, sem re-nag. */
export function trackStockUpsellDismissed(): void {
  analyticsService.track(STOCK_EVENTS.UPSELL_DISMISSED, {})
}
