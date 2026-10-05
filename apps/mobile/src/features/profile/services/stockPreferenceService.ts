// stockPreferenceService — ORIGEM COMUM de toda escrita da preferência de estoque
// (spec 044, F4b / T019 / FR-010).
//
// POR QUE ESTE ARQUIVO EXISTE: a preferência tem QUATRO escritores (onboarding, toggle de
// Settings, tela de saldo inicial, card de upsell). Instrumentar o analytics em cada tela
// garante que um caminho fique sem evento — e a métrica dos 90 dias (SC-004) nasce torta sem
// ninguém perceber. Aqui a escrita e o evento são a MESMA chamada: não há como gravar a
// preferência sem emitir o evento.
//
// ⚠️ O `refresh()` do provider (AP-281) NÃO mora aqui — ele depende do contexto React e fica
// nos hooks/telas que chamam este serviço. Este módulo só escreve e instrumenta.

import {
  createProfileRepository,
  createStockRepository,
  createStockActivationService,
  createStockResumeService,
  type InitialBalanceEntry,
  type StockActivationResult,
  type StockResumeAssessment,
} from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'

async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

const profileRepo = createProfileRepository({ client: supabase as never, getUserId })
const stockRepo = createStockRepository({ client: supabase as never, getUserId })
const activationService = createStockActivationService({ profileRepo, stockRepo })
const resumeService = createStockResumeService({ profileRepo, stockRepo })

/** De onde veio a ativação/desativação — é o que separa conversão de upsell de opt-in manual. */
export type StockPreferenceSource = 'onboarding' | 'settings' | 'upsell'

/**
 * Escolha do modo no onboarding (FR-001). Emite o evento SEMPRE — inclusive para dose-only,
 * que é justamente o numerador da métrica "% de novos usuários escolhendo dose-only".
 */
export async function chooseStockModeInOnboarding(enabled: boolean): Promise<void> {
  // `freeze: false` — escolher dose-only no onboarding NÃO é congelar: não existe saldo para
  // congelar. Carimbar `stock_paused_at` aqui faria o usuário nascer parecendo "congelado", e o
  // toggle de Settings tomaria o caminho de RETOMADA (gap de minutos → silencioso) em vez de
  // perguntar o saldo inicial — a tela do PO-3 nunca apareceria.
  await profileRepo.setStockTracking(enabled, { freeze: false })
  // 092 D-4: `mode` é a série legada da 044 (SC-004) e colide com a super property de densidade;
  // `stock_mode` carrega o MESMO valor até a série migrar — só então `mode` sai daqui.
  const stockMode = enabled ? 'stock' : 'dose_only'
  void logEvent(EVENTS.STOCK_ONBOARDING_CHOICE, { mode: stockMode, stock_mode: stockMode, surface: SURFACES.MOBILE })
  // 065 PR D / US9 (dedupe): NÃO emitir stock_opt_in aqui. Escolher o modo é intenção (já medida
  // por stock_onboarding_choice{mode}); o opt-in mensurável é activateStockWithInitialBalance, na
  // tela de saldo OPCIONAL seguinte. Emitir nos dois pontos contava a pessoa 2× (SC-004 da 044).
  // Consequência aceita pelo PO: quem escolhe estoque e toca "Cancelar" no saldo fica com o modo
  // ligado SEM stock_opt_in — contar esse grupo por stock_onboarding_choice{mode:'stock'}.
}

/**
 * Ativa o controle de estoque a partir do saldo inicial informado (PO-3 — sem retro-consumo).
 * O evento só sai DEPOIS da escrita: ativação que falhou não vira opt-in na métrica.
 */
export async function activateStockWithInitialBalance(
  entries: InitialBalanceEntry[],
  source: StockPreferenceSource,
): Promise<StockActivationResult> {
  const result = await activationService.activateWithInitialBalance(entries)
  void logEvent(EVENTS.STOCK_OPT_IN, {
    source,
    counted: result.countedMedicineIds.length,
    skipped: result.skipped,
    surface: SURFACES.MOBILE,
  })
  if (source === 'upsell') void logEvent(EVENTS.STOCK_UPSELL_CONVERSION, { surface: SURFACES.MOBILE })
  return result
}

/** Opt-out: CONGELA (zero mutação de saldo). */
export async function disableStockTracking(source: StockPreferenceSource = 'settings'): Promise<void> {
  await profileRepo.setStockTracking(false)
  void logEvent(EVENTS.STOCK_OPT_OUT, { source, surface: SURFACES.MOBILE })
}

/** Reativação de quem já teve estoque: retoma o saldo congelado como estava. */
export async function resumeStockAsIs(source: StockPreferenceSource = 'settings'): Promise<StockResumeAssessment> {
  const assessment = await resumeService.resumeAsIs()
  void logEvent(EVENTS.STOCK_OPT_IN, { source, resume: 'as_is', surface: SURFACES.MOBILE })
  return assessment
}

/** Reativação com descarte do saldo congelado (append-only — R-226). */
export async function resumeStockAndZero(
  source: StockPreferenceSource = 'settings',
): Promise<{ zeroedMedicineIds: string[] }> {
  const result = await resumeService.resumeAndZero()
  void logEvent(EVENTS.STOCK_OPT_IN, { source, resume: 'zeroed', surface: SURFACES.MOBILE })
  return result
}

/** Só leitura — decide entre retomada silenciosa e sheet de reconciliação. */
export function assessStockResume(): Promise<StockResumeAssessment> {
  return resumeService.assessResume()
}

/** O card de upsell apareceu (denominador da taxa de conversão — SC-004). */
export function trackStockUpsellShown(): void {
  void logEvent(EVENTS.STOCK_UPSELL_SHOWN, { surface: SURFACES.MOBILE })
}

/** "Agora não": dismiss persistente, sem re-nag. */
export function trackStockUpsellDismissed(): void {
  void logEvent(EVENTS.STOCK_UPSELL_DISMISSED, { surface: SURFACES.MOBILE })
}
