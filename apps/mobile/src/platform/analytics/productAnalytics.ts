// Wrapper seguro para analytics de produto (PostHog) — nunca quebra o fluxo do usuário
// CON-021: logEvent nunca lança exceção
// ADR-090: substitui @react-native-firebase/analytics (não compila sob Xcode 26.3 / RN 0.81 +
// useFrameworks 'static'). A API exportada é a MESMA de antes (logEvent/setUserId/
// setUserProperty/logScreenView) — os call sites não mudam.
//
// 🔴 Fronteira spec 051 (ADR-090): PostHog aqui é SÓ analytics de produto + métrica de adoção de
// frota (app_version por evento). PROIBIDO usar feature flag do PostHog como gating de conteúdo
// OTA (governance 051 §125) ou colocar PostHog no caminho do kill switch (boot-blocking,
// fail-open — AP-303).
//
// Falha silenciosa quando o client não está inicializado (ex: sem POSTHOG_API_KEY, ambiente de teste).

import PostHog from 'posthog-react-native'
import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'
import { posthogApiKey, posthogHost } from '@platform/config/nativePublicAppConfig'
import { bundleTags } from '@platform/updates/bundleInfo'
import { getRawNow, resolveTreatmentCountBucket } from '@dosiq/core'

let client = null

// ─── Spec 096 B3 — PostHog sob as autorizações A e B (CON-034, política v0.4 §4) ───────────────
// "Sem esse segundo consentimento, o app não envia esses eventos." O wrapper é o ponto ÚNICO de
// rede do PostHog (capture/screen/identify), então o gate mora aqui:
//   pending → retém em memória (onboarding antes do A, leitura ainda não feita, sem sessão);
//   allowed → A e B vigentes: opt-in no SDK, identify e flush na ordem original;
//   denied  → sem B (ou leitura de B falhou): descarta o retido e não envia mais nada.
// `resetUser` (logout, "Descartar e sair") zera a fila e volta a `pending`.
// O SDK nasce `defaultOptIn: false` como segunda trava — se algum caminho escapar do wrapper, o
// SDK também descarta. `register` (super properties) é local e não passa pelo gate.
export type AnalyticsConsent = 'pending' | 'allowed' | 'denied'
export const ANALYTICS_BUFFER_MAX = 200
let consent: AnalyticsConsent = 'pending'
// Opções de captura do SDK — só `timestamp` interessa aqui.
type CaptureOptions = { timestamp?: Date } | undefined
type AnalyticsOp = (c: any, options: CaptureOptions) => unknown
// `at` = quando o evento aconteceu. Sem ele, a fila enviada depois do A+B chega toda com a hora do
// envio e o funil do onboarding colapsa em ~0 s (smoke B3, C-B3-14).
let retained: Array<{ op: AnalyticsOp; at: Date }> = []
let identifiedUserId: string | null = null

function dispatch(op: AnalyticsOp) {
  if (consent === 'denied') return
  if (consent === 'pending') {
    retained.push({ op, at: getRawNow() })
    if (retained.length > ANALYTICS_BUFFER_MAX) retained = retained.slice(-ANALYTICS_BUFFER_MAX)
    return
  }
  const c = getClient()
  if (c) return op(c, undefined)
}

export async function setAnalyticsConsent(next: AnalyticsConsent) {
  try {
    if (next === consent) return
    consent = next
    const c = getClient()
    if (next === 'denied') {
      retained = []
      if (c) await c.optOut?.()
      return
    }
    if (next === 'allowed') {
      const ops = retained
      retained = []
      if (!c) return
      await c.optIn?.()
      if (identifiedUserId) c.identify(identifiedUserId)
      for (const { op, at } of ops) await op(c, { timestamp: at })
    }
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] setAnalyticsConsent error:', error.message)
  }
}

// Instancia sob demanda (1x). Sem chave configurada → analytics vira no-op silencioso.
function getClient() {
  if (client) return client
  if (!posthogApiKey) return null
  try {
    client = new PostHog(posthogApiKey, {
      host: posthogHost,
      // Session replay desligado por decisão de custo (ADR-090): come cota de eventos.
      enableSessionReplay: false,
      // 096 B3: nada sai antes de A+B (gate acima); flags não são usadas (ADR-090) — sem pré-carga.
      defaultOptIn: false,
      preloadFeatureFlags: false,
    })
    return client
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] init error:', error.message)
    return null
  }
}

// Exposto para o PostHogProvider do root (mesma instância do wrapper — não criar duas).
export function getPostHogClient() {
  return getClient()
}

export async function logEvent(eventName, params = {}) {
  try {
    await dispatch((c, options) => c.capture(eventName, params, options))
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] logEvent error:', error.message)
  }
}

// Liga a sessão anônima corrente do device à pessoa `userId`. O PostHog faz o merge sozinho: os
// eventos anônimos já capturados neste device (landing, login, recuperação de senha) passam a
// pertencer a essa pessoa — não existe código de consolidação do nosso lado.
//
// Chamar em TODA sessão viva (login novo E restauração de sessão), não só no login explícito:
// identificar só no login deixa o uso diário — que entra por sessão restaurada — anônimo, e cada
// device vira uma "pessoa" diferente inflando a contagem de usuários.
export async function setUserId(userId) {
  try {
    // R-042: identify apenas com UUID interno — nunca PII.
    // Sentry e PostHog têm config INDEPENDENTE (sentryDsn ≠ posthogApiKey): não acoplar. Um
    // early-return por causa do client PostHog ausente pularia o Sentry.setUser também, deixando
    // o crash sem dono num build com Sentry ligado e PostHog não (RC6 PR #773).
    identifiedUserId = userId
    if (consent === 'allowed') {
      const c = getClient()
      if (c) c.identify(userId)
    }
    // Mesmo UUID no Sentry: crash sem dono não dá para cruzar com o relato de suporte,
    // nem para responder "quantas pessoas esse crash atingiu?".
    Sentry.setUser({ id: userId })
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] setUserId error:', error.message)
  }
}

// Encerra a identificação no logout. Sem isto, num device compartilhado os eventos do PRÓXIMO
// usuário seriam atribuídos à pessoa anterior — pior que o anonimato, porque mistura dado de
// saúde entre pessoas. Anda junto com setUserId: ligar um sem o outro cria o bug inverso.
export async function resetUser() {
  try {
    retained = []
    identifiedUserId = null
    consent = 'pending'
    const c = getClient()
    if (c) {
      // O opt-in do SDK persiste no aparelho: sem isto, a próxima pessoa herdaria a 2ª trava aberta.
      await c.optOut?.()
      c.reset()
      // `reset()` apaga TODAS as super properties, inclusive as do APARELHO, que não são da
      // pessoa: sem isto, depois de sair e entrar de novo, todo evento até o próximo cold start
      // saía sem `app_env`/`is_internal`/bundle (visto no PostHog no smoke do 065 C1, 26/09) —
      // dogfooding misturado a usuário real, o que o FR-12 existe para impedir. `mode` é da
      // pessoa e volta sozinho quando o perfil carrega (useTodayData/useProfile).
      await c.register({ ...bundleTags(), ...envTags() })
    }
    Sentry.setUser(null)
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] resetUser error:', error.message)
  }
}

export async function setUserProperty(name, value) {
  try {
    const c = getClient()
    if (!c) return
    // register = super property (vai junto em todo evento seguinte), equivalente prático
    // ao setUserProperty do Firebase para segmentação.
    await c.register({ [name]: String(value) })
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] setUserProperty error:', error.message)
  }
}

export async function logScreenView(screenName, screenClass = screenName) {
  try {
    await dispatch((c, options) => c.screen(screenName, { screen_class: screenClass }, options))
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] logScreenView error:', error.message)
  }
}

/**
 * Ambiente do build como super properties (065 FR-12): `app_env` cru + `is_internal` derivado.
 *
 * 🔴 A fonte é `Constants.expoConfig.extra.appEnv` (`app.config.js:289`), NÃO
 * `nativePublicAppConfig.appEnv`: os dois têm fallback em direções OPOSTAS quando
 * `EXPO_PUBLIC_APP_ENV` não está no ambiente do build (e `eas.json` não a define em perfil nenhum).
 * O `extra` cai para `EAS_BUILD_PROFILE || 'production'` — desconhecido vira EXTERNO, que é o lado
 * seguro; o `nativePublicAppConfig` cai para `'development'` — desconhecido viraria INTERNO e um
 * build de loja marcaria TODO usuário real como interno, tirando-o das métricas filtradas:
 * subcontagem silenciosa com cara de dado limpo (plan.md TC-8).
 *
 * `app_env` viaja cru de propósito: se o valor vier errado, ele é VISÍVEL e a métrica é
 * recomponível no PostHog — `is_internal` sozinho esconderia o erro.
 */
export function envTags() {
  const appEnv = Constants.expoConfig?.extra?.appEnv || 'production'
  return { app_env: String(appEnv), is_internal: String(appEnv !== 'production') }
}

/**
 * Modo da interface como super property (065 FR-12/US4), registrado depois que o perfil carrega.
 *
 * 🔴 Registra o valor DECLARADO (`'simple' | 'complex' | 'auto'`), não o resolvido. `null` (auto)
 * é resolvido por heurística de contagem e cada tela usa uma base DIFERENTE — `TodayScreen:619`
 * conta medicamentos (`> 3`), `TreatmentsScreen:49` conta protocolos (`> 3`). Escolher uma delas
 * aqui inventaria um terceiro número, que não é o de nenhuma tela. `auto` é o fato: "a pessoa não
 * escolheu". Quem quiser o efeito visual cruza com a contagem, que já viaja em outros eventos.
 */
export async function setMode(complexityOverride) {
  await setUserProperty('mode', complexityOverride || 'auto')
}

/**
 * Persona por volume de tratamentos como super property (092 FR-002 / D-2): `'0' | '1-3' | '4+'`.
 *
 * Complementa o `mode` (que segue `auto` para quem não escolheu — decisão da 065) com um número que
 * não depende da escolha de densidade. Base e regra moram no core (`resolveTreatmentCountBucket`):
 * prescrição vigente no dia local, pausados inclusive. Sem linhas (falha de carga) NÃO registra —
 * a propriedade fica ausente, nunca `'0'` inventado (AC-2.2). `resetUser` apaga junto das demais.
 */
export async function setTreatmentCountBucket(protocols, localDay) {
  if (!Array.isArray(protocols)) return
  await setUserProperty('treatment_count_bucket', resolveTreatmentCountBucket(protocols, localDay))
}
