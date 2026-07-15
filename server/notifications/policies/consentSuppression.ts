// consentSuppression.ts — Suspensão de notificações para quem REVOGOU o consentimento (spec 046, T014).
//
// Revogar o consentimento de dado de saúde é dizer "pare de tratar meus dados". Um lembrete de dose
// é tratamento de dado de saúde — e é tratamento que APARECE na tela de bloqueio do celular de
// alguém que pediu para parar. Continuar enviando seria a violação mais visível possível.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUE ISTO LÊ `user_settings` E NÃO A TRILHA (R-292)
// ─────────────────────────────────────────────────────────────────────────────
// A 1ª versão deste módulo lia `consent_log` UMA vez por run do cron e montava um Set de revogados.
// Parecia o padrão do 044 — e era, no formato. Mas introduzia uma DEPENDÊNCIA GLOBAL NOVA para
// resolver um estado que é POR USUÁRIO: se aquele único SELECT falhasse, o run inteiro abortava e
// NINGUÉM recebia lembrete de dose naquele minuto. A situação de UM titular (que revogou) passava a
// poder suprimir a necessidade clínica de TODOS os outros pacientes. Num app de medicação, isso é
// inaceitável — e era evitável.
//
// Agora o estado revogado é um FLAG em `user_settings` (`consent_revoked_at`), escrito pela mesma
// transação da RPC que grava a trilha. O dispatcher já lê `user_settings` de cada usuário
// (`getSettingsByUserId`) antes de despachar: o flag entra nesse fetch. **Zero query nova, zero
// ponto de falha novo, zero leitura global.** Falha de leitura vira problema DO usuário afetado —
// que já não seria despachado de qualquer forma, porque sem `user_settings` não se sabe nem o fuso
// dele. O raio de dano de um erro passou a ser um usuário, não a base inteira.
//
// `consent_log` continua sendo a PROVA (append-only, auditável, sobrevive ao titular). Este flag é
// um índice operacional derivado dela, com um único escritor. Não são duas fontes de verdade.
//
// ⚠️ DIREÇÃO DO DEFAULT (decisão do PO, espelho invertido do AP-277): flag ausente/NULL ⇒ "nunca
// revogou" ⇒ ENVIA. É seguro porque a revogação SEMPRE passa pela RPC, que grava o evento e o flag
// atomicamente. E a direção importa: se a ausência de dado suprimisse por omissão, uma coluna nova
// mal migrada silenciaria o lembrete de dose de toda a base. Ausência de dado nunca cala um alerta
// clínico. O que protege o titular revogado não é o default — é o fato de o flag dele SEMPRE existir.

/** Fatia de `user_settings` que interessa a esta política (o dispatcher já a tem em mãos). */
export interface ConsentSuppressionSettings {
  consent_revoked_at?: string | null
  /**
   * `true` quando a leitura de `user_settings` DESTE usuário falhou e os defaults entraram no lugar.
   * Sem esta marca, o fallback de defaults (que traz `consent_revoked_at` indefinido) seria lido
   * como "não revogou" — um erro de leitura virando permissão de envio (família AP-290).
   */
  _read_failed?: boolean
}

/**
 * O titular revogou o consentimento de dado de saúde? Se sim, NADA é despachado para ele.
 *
 * Fail-closed POR USUÁRIO: se as settings dele não puderam ser lidas, não sabemos se ele revogou —
 * e não sabendo, não enviamos. O custo cai inteiro sobre ele (perde os lembretes daquele tick, e o
 * cron reroda em um minuto), nunca sobre os outros pacientes. É a diferença entre um erro isolado e
 * um apagão de lembretes.
 */
export function isConsentSuppressed(settings: ConsentSuppressionSettings | null | undefined): boolean {
  if (!settings) return true
  if (settings._read_failed === true) return true
  return settings.consent_revoked_at != null
}
