// Leitor de `dose_critical_events` para o gate de evidência do push crítico (spec 082, Slice C).
//
// A tabela nasceu append-only, com um único produtor (o app) e nenhum leitor: o
// `criticalAuditService` só escreve. A partir daqui ela vira FONTE DE DECISÃO em caminho crítico
// de entrega (CON-031), e isso traz uma obrigação junto: **fail-open**. Toda falha de leitura
// devolve o resultado que faz o lembrete SAIR — na dúvida, avisa (FR-013). Uma indisponibilidade
// do Postgres não pode virar dose crítica não avisada.
//
// Três eixos que NÃO coincidem e que este arquivo mantém separados de propósito (spec §6):
//   evidência  → por OCORRÊNCIA (`dose_instance_id`)
//   capacidade → por USUÁRIO (emitiu `alarm_scheduled` na janela)
//   envio      → por APARELHO (decidido no canal, não aqui)

import { createLogger } from '../../bot/logger.js'
import { addDays, getNow } from '../../utils/dateUtils.js'

const logger = createLogger('CriticalEventsRepository')

/** Evento que prova que o alarme daquela ocorrência foi armado no aparelho (ADR-056). */
const EVENT_ALARM_SCHEDULED = 'alarm_scheduled'

/**
 * Janela da capacidade do USUÁRIO (decisão do P1.5 — sinal comportamental, não versão do app: um
 * mesmo usuário tem aparelhos 0.19.1 e 0.32.0, e a versão não prediz a evidência).
 * Números medidos em prod 2026-09-11: 3 de 8 pacientes críticos são capazes em 7 d · 5 de 8 em 30 d.
 * É parâmetro — mudar a janela muda quem cai em `suprimida_sem_prova`.
 */
export const ALARM_CAPABILITY_WINDOW_DAYS = 7

/**
 * Teto explícito por leitura. O PostgREST trunca em 1000 sem avisar (AP-186), e aqui o truncamento
 * seria pior que um número errado: uma dose cuja prova ficou de fora do pedaço lido é uma dose que
 * o gate manda push à toa — ou, no bloco, que deixa de suprimir. Lemos em lotes menores que o teto.
 */
const ID_CHUNK_SIZE = 200

interface SupabaseLike {
  from(table: string): any
}

/**
 * Quais destas ocorrências têm prova de alarme agendado.
 *
 * @returns `Set` com os `dose_instance_id` COM prova. Em erro de leitura devolve `Set` vazio —
 *          "sem prova" é o lado que envia o push (fail-open, FR-013).
 */
export async function findInstancesWithAlarmEvidence(
  client: SupabaseLike,
  instanceIds: string[]
): Promise<Set<string>> {
  const withEvidence = new Set<string>()
  const ids = (instanceIds || []).filter(Boolean)
  // `.in('x', [])` é ida ao banco para nada — e devolveria vazio de qualquer jeito.
  if (ids.length === 0) return withEvidence

  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + ID_CHUNK_SIZE)
    const { data, error } = await client
      .from('dose_critical_events')
      .select('dose_instance_id')
      .eq('event', EVENT_ALARM_SCHEDULED)
      .in('dose_instance_id', chunk)
      .limit(ID_CHUNK_SIZE)

    if (error) {
      // Fail-open: devolve VAZIO (ninguém tem prova ⇒ todo mundo recebe push), e não o que já
      // havia sido lido — um resultado parcial faria a metade não lida ser suprimida em silêncio.
      logger.error('Leitura de evidência de alarme indisponível — fail-open (envia)', error, {
        chunkSize: chunk.length,
      })
      return new Set<string>()
    }

    for (const row of (data ?? []) as Array<{ dose_instance_id: string | null }>) {
      if (row.dose_instance_id) withEvidence.add(row.dose_instance_id)
    }
  }

  return withEvidence
}

/**
 * O USUÁRIO é capaz de produzir evidência de alarme? (FR-012)
 *
 * Capaz + sem prova ⇒ o push SAI: a ausência é informativa, o aparelho sabe registrar e não
 * registrou. Incapaz + sem prova ⇒ a ausência é ambígua e o push é suprimido (política
 * conservadora do D1), gravando `suprimida_sem_prova` para que o silêncio seja CONTADO.
 *
 * @returns `true` também em erro de leitura — fail-open aqui significa "trate como capaz", que é
 *          o ramo que envia.
 */
export async function isUserAlarmCapable(
  client: SupabaseLike,
  userId: string,
  now: Date = getNow()
): Promise<boolean> {
  const since = addDays(now, -ALARM_CAPABILITY_WINDOW_DAYS)

  const { data, error } = await client
    .from('dose_critical_events')
    .select('id')
    .eq('user_id', userId)
    .eq('event', EVENT_ALARM_SCHEDULED)
    .gte('created_at', since.toISOString())
    .limit(1)

  if (error) {
    logger.error('Leitura de capacidade de alarme indisponível — fail-open (capaz)', error, { userId })
    return true
  }

  return (data ?? []).length > 0
}
