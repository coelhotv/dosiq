// packages/core/src/schemas/versionGateSchema.ts
// Schema de ESCRITA do kill switch de versão mínima (spec 051 / ADR-091 / CON-033 §2 e §4).
//
// Mora no core porque a allowlist de `store_url` é CONTROLE DE SEGURANÇA (RC-SEC-2 S-8) e precisa ser
// definida UMA vez, consumida pelo handler admin (validação da escrita) e pelo cliente mobile
// (validação da leitura, PR 1.5b). Três cópias divergem em silêncio e o controle passa a valer só onde
// alguém lembrou de atualizar.
//
// 🔴 ESTE ARQUIVO VALIDA A ESCRITA, NÃO A LEITURA. A leitura do gate é TOLERANTE de propósito: valor
// inválido no banco ⇒ `compareSemver` devolve null ⇒ o gate ABRE (AP-303 — indeterminado não é
// negação). Endurecer a leitura aqui inverteria a semântica e transformaria config corrompida em
// bloqueio universal.

import { z } from 'zod'
import { APP_VERSION_REGEX } from './nudgeSchema'

/**
 * Domínio FECHADO — as duas linhas são semeadas pela migração e nunca crescem.
 * Sincronizado com o CHECK de `app_version_gate.platform` (R-271, caixa exata).
 * Sem 'web': a web serve sempre o build atual, e por ADR-091 D9 a superfície que DESATIVA o gate
 * nunca pode estar dentro do escopo dele.
 */
export const VERSION_GATE_PLATFORMS = ['ios', 'android'] as const

export type VersionGatePlatform = (typeof VERSION_GATE_PLATFORMS)[number]

/**
 * Allowlist de `store_url` — o controle do S-8, em prefixo exato.
 *
 * Por que existe: `store_url` é config REMOTA que vira `Linking.openURL` numa tela full-screen onde o
 * botão é a ÚNICA ação e o usuário está condicionado a clicar para recuperar acesso ao próprio
 * remédio. É o contexto ideal de phishing — e o fato de o valor vir do nosso banco não o torna
 * confiável (quem escreve no banco é o vetor).
 *
 * Prefixo, não regex de domínio: `https://apps.apple.com.evil.com/` passaria num `includes`, e
 * `startsWith` sobre o prefixo COM barra final não passa.
 */
export const STORE_URL_ALLOWLIST = [
  'https://apps.apple.com/',
  'https://play.google.com/',
] as const

/** Cap de tamanho da copy remota (S-9). Texto puro, sem markdown/HTML/link tocável. */
export const GATE_MESSAGE_MAX_LENGTH = 280

/**
 * 🔴 As EXATAS 5 colunas que o cliente pode ler. Use esta constante no `.select()` — não escreva a
 * lista à mão, e **não troque por `*`**.
 *
 * `select=*` devolve **42501 (permission denied)** por DESENHO: o grant de `anon`/`authenticated` é
 * column-scoped e `updated_by`/`updated_at` estão fora dele (S-10 — o uuid interno do admin não vai
 * para o cliente). Comprovado por curl em 2026-07-25.
 *
 * Sem este aviso, a próxima pessoa que vir o gate "quebrado" troca por `*` para "consertar" e o kill
 * switch para de ser lido — falhando exatamente como uma falha de rede, ou seja, abrindo em silêncio.
 */
export const VERSION_GATE_CLIENT_COLUMNS = 'platform, min_supported_version, is_active, message, store_url'

/**
 * Único juiz de `store_url` no projeto — handler (escrita) e cliente (leitura) chamam ESTA função.
 *
 * Fora da allowlist ⇒ `false`, e o consumidor cai para a constante compilada. Nunca lança: entrada
 * suja é resposta `false`, não exceção (o chamador do lado do cliente roda em caminho de boot).
 */
export function isAllowedStoreUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  return STORE_URL_ALLOWLIST.some((prefix) => trimmed.startsWith(prefix))
}

/**
 * Payload de escrita do gate. `platform` identifica a linha (as 2 existem, semeadas);
 * os demais campos são o que muda.
 *
 * `acknowledge_affected_devices` NÃO é campo da tabela — é a cerimônia de raio de impacto (S-7),
 * conferida pelo handler contra a SUA PRÓPRIA contagem. Fica no schema para ser validada em tipo e
 * formato antes de qualquer comparação.
 */
export const versionGateUpdateSchema = z.object({
  platform: z.enum(VERSION_GATE_PLATFORMS, {
    error: 'Plataforma deve ser ios ou android',
  }),

  is_active: z.boolean({ error: 'is_active é obrigatório e deve ser booleano' }),

  min_supported_version: z
    .string()
    .regex(APP_VERSION_REGEX, 'Versão mínima deve ser X.Y.Z')
    .nullable()
    .optional(),

  message: z
    .string()
    .max(GATE_MESSAGE_MAX_LENGTH, `Mensagem não pode ter mais de ${GATE_MESSAGE_MAX_LENGTH} caracteres`)
    .nullable()
    .optional(),

  store_url: z
    .string()
    .refine(isAllowedStoreUrl, {
      message: 'store_url deve começar com https://apps.apple.com/ ou https://play.google.com/',
    })
    .nullable()
    .optional(),

  // Sem coerção de propósito: `'21'` (string do corpo JSON de um cliente descuidado) tem de ser
  // recusado, não convertido. Um acknowledge que o servidor "consertou" não é confirmação de nada.
  // `0` é valor legítimo (frota afetada zero) — nunca tratar como ausente (R-104).
  acknowledge_affected_devices: z
    .number({ error: 'acknowledge_affected_devices deve ser um número inteiro' })
    .int('acknowledge_affected_devices deve ser um número inteiro')
    .min(0, 'acknowledge_affected_devices não pode ser negativo')
    .optional(),
})
  .superRefine((data, ctx) => {
    // Ativar sem piso válido é bloqueio INDETERMINADO: o cliente leria `min` nulo/inválido,
    // `compareSemver` devolveria null e o gate abriria — ficaria "ligado" no painel e inerte em campo.
    // Pior que não funcionar: mente sobre o estado do controle.
    if (data.is_active === true && !data.min_supported_version) {
      ctx.addIssue({
        code: 'custom',
        message: 'Ativar o gate exige min_supported_version no formato X.Y.Z',
        path: ['min_supported_version'],
      })
    }
  })

export type VersionGateUpdateInput = z.infer<typeof versionGateUpdateSchema>

/**
 * Valida o payload de escrita. Mesma forma de retorno dos outros validadores do core
 * (`{ success, data } | { success, errors }`).
 *
 * ⚠️ Estreitar o retorno com `=== false`, nunca com `!result.success` (R-286): sob consumidor
 * `strict: false` — o caso de `api/` e do mobile — o `!` não discrimina a união.
 */
export function validateVersionGateUpdate(data: unknown) {
  const result = versionGateUpdateSchema.safeParse(data)

  if (result.success === false) {
    return {
      success: false as const,
      errors: result.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      })),
    }
  }

  return {
    success: true as const,
    data: result.data,
  }
}

export default versionGateUpdateSchema
