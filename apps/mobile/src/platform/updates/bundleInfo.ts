// bundleInfo.ts — identidade do bundle JS em execução (spec 051-A · FR-011/FR-016)
//
// Por que existe: sob EAS Update, `APP_VERSION` deixa de identificar o código. Dois aparelhos na
// mesma "versão 0.30.0" podem rodar bundles JS diferentes (um pegou o OTA, o outro não). O par
// versão + updateId é o que identifica de fato — no suporte (FR-016) e na observabilidade
// (FR-011: "esse crash veio de qual update?", a pergunta que decide rollback).
//
// FONTE ÚNICA de propósito: a tela de perfil, o Sentry e o PostHog leem TODOS daqui. Duas leituras
// independentes de `Updates.*` divergiriam com o tempo e o suporte passaria a comparar um
// identificador da tela com outro do dashboard.
//
// Todos os campos são `null` quando o app roda sem OTA ativo (dev client, Expo Go, build sem
// canal). Isso NÃO é erro — é o estado "bundle embutido", e a UI/telemetria dizem isso.
import * as Updates from 'expo-updates'

export interface BundleInfo {
  /** updateId completo do EAS, ou null quando rodando o bundle embutido no binário. */
  updateId: string | null
  /** Canal do build (`production` | `preview` | `development`), ou null se OTA desabilitado. */
  channel: string | null
  /** Igual ao APP_VERSION do build (ADR-082 — declarado literal no `app.config.js`). */
  runtimeVersion: string | null
  /** true = rodando o bundle que veio dentro do binário (nenhum OTA aplicado). */
  isEmbedded: boolean
}

/**
 * Prefixo curto do updateId, para exibição em tela e busca no dashboard EAS.
 * 8 caracteres é o bastante para localizar o update sem virar uma parede de UUID.
 */
export function shortUpdateId(updateId: string | null): string | null {
  if (!updateId) return null
  return updateId.slice(0, 8)
}

/**
 * Lê a identidade do bundle corrente. Fail-silent por contrato: acessar `Updates.*` num ambiente
 * onde o módulo nativo não subiu não pode derrubar a tela de perfil nem o init de telemetria —
 * o custo de não saber o updateId é perder um dado de suporte, não o app.
 */
export function getBundleInfo(): BundleInfo {
  try {
    return {
      updateId: Updates.updateId,
      channel: Updates.channel,
      runtimeVersion: Updates.runtimeVersion,
      isEmbedded: Updates.isEmbeddedLaunch,
    }
  } catch {
    return { updateId: null, channel: null, runtimeVersion: null, isEmbedded: true }
  }
}

/**
 * Trio de identificação do bundle para telemetria (FR-011) — Sentry (tags) e PostHog
 * (super properties) consomem o MESMO objeto, para que um crash e um evento de produto do
 * mesmo aparelho sejam correlacionáveis pelo mesmo valor.
 *
 * Nunca omite chave: ausência de OTA vira o valor literal `embedded`, não `undefined`. Tag que
 * some quando o valor é nulo cria o pior caso de investigação — "os crashes sem update_id" vira
 * um balde onde não dá pra distinguir "rodava o embutido" de "a instrumentação falhou".
 */
export function bundleTags(): Record<string, string> {
  const info = getBundleInfo()
  return {
    update_id: info.updateId ?? 'embedded',
    channel: info.channel ?? 'none',
    runtime_version: info.runtimeVersion ?? 'unknown',
  }
}

/**
 * Linha em PT para a tela de configurações/sobre (FR-016 / PO-6).
 * Sempre devolve string — "bundle embutido" é informação, não ausência dela.
 *
 * 🔴 A distinção embutido × OTA sai de `isEmbeddedLaunch`, NUNCA de `updateId == null`.
 * O expo-updates atribui updateId também ao bundle embutido: num build real ele praticamente
 * nunca é nulo, então ramificar por ele faria todo app dizer "Atualização <id>" mesmo sem OTA
 * algum aplicado — e o suporte procuraria esse id no dashboard do EAS sem nunca achar, porque
 * bundle embutido não é publicado lá. Achado no smoke em device real do PR 1.6.
 */
export function formatBundleLabel(info: BundleInfo): string {
  // "Versão original" e não "bundle embutido": a tela é lida por usuário, não por engenheiro.
  if (info.isEmbedded) return 'Versão original'

  const short = shortUpdateId(info.updateId)
  // Não-embutido sem id é estado que não deveria existir; se acontecer, dizer o que se sabe
  // (não é o bundle da loja) em vez de inventar um identificador.
  return short ? `Atualização ${short}` : 'Atualização aplicada'
}

/**
 * Rótulo do canal, em linha PRÓPRIA — ou `null` quando não há canal a mostrar.
 *
 * 🔴 Por que não concatenar com `formatBundleLabel` via ` · `: o nativo devolve **string vazia**
 * (não `null`) quando o canal falta (`requestHeaders["expo-channel-name"] ?: ""`), e no smoke do
 * PR 1.6 a tela exibiu um `·` solto, sem nada depois — separador órfão anunciando um dado que não
 * existe. Separador só existe entre DUAS coisas; se uma pode faltar, elas não compartilham string.
 * `trim()` porque canal só-de-espaços é ausência disfarçada.
 */
export function formatChannelLabel(info: BundleInfo): string | null {
  const canal = info.channel?.trim()
  return canal ? `Canal ${canal}` : null
}
