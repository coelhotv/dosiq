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

let client = null

// Instancia sob demanda (1x). Sem chave configurada → analytics vira no-op silencioso.
function getClient() {
  if (client) return client
  if (!posthogApiKey) return null
  try {
    client = new PostHog(posthogApiKey, {
      host: posthogHost,
      // Session replay desligado por decisão de custo (ADR-090): come cota de eventos.
      enableSessionReplay: false,
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
    const c = getClient()
    if (!c) return
    await c.capture(eventName, params)
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
    const c = getClient()
    if (c) c.identify(userId)
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
    const c = getClient()
    if (c) c.reset()
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
    const c = getClient()
    if (!c) return
    await c.screen(screenName, { screen_class: screenClass })
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
