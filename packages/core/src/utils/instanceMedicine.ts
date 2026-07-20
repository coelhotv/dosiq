/**
 * instanceMedicine — resolução CANÔNICA da identidade do medicamento de uma dose_instance.
 *
 * Fonte única de verdade da leitura (spec 052, Slice B). Antes desta função, cada consumidor
 * resolvia o medicamento por `protocol_id → protocols.medicine_id` — no SQL (embed
 * `protocol:protocols(medicine:medicines(...))`) ou em memória (lookup do protocolo). Como
 * `protocols.medicine_id` EVOLUI (medicine_switch da 029, ou edição normal do tratamento),
 * esse join reescreve o passado a cada leitura: uma dose de junho renderiza com o medicamento
 * de hoje. Falsificação clínica no dado que vai ao relatório do médico.
 *
 * `dose_instances.medicine_id` (Slice A) congela a identidade na materialização, como
 * `expected_dose` já congelava a dose. Esta função consome esse congelamento e é o ÚNICO
 * lugar autorizado a olhar para o protocolo — o que torna o SC-004 (zero leitura crua do
 * join fora do helper) verificável por grep.
 *
 * O fallback ao protocolo existiu durante o Slice B e MORREU com a migração `SET NOT NULL`
 * (spec 052, T017/PO-3): `dose_instances.medicine_id` é obrigatório no banco, então não há
 * mais estado em que perguntar ao protocolo seja correto — perguntar seria justamente
 * reintroduzir o bug. O protocolo continua fora desta função de propósito.
 *
 * @module instanceMedicine
 */

/**
 * Forma mínima do medicamento. O helper NÃO interpreta os campos — só escolhe a FONTE —, então
 * é genérico sobre o shape: cada consumidor (doseZones, timeline, crons) tem o seu, e forçar um
 * shape único aqui só produziria cast na fronteira, que é onde o campo fantasma entra (AP-300).
 */
export interface InstanceMedicineLike {
  id?: unknown
  name?: unknown
}

/** Instância materializada. `medicine` só existe quando o chamador pediu o embed direto. */
export interface MedicineBearingInstance<M = InstanceMedicineLike> {
  medicine_id?: string | null
  medicine?: M | null
}

/** Protocolo — fonte do REGISTRO do medicamento, nunca da identidade (ver `resolveInstanceMedicine`). */
export interface MedicineBearingProtocol<M = InstanceMedicineLike> {
  medicine_id?: string | null
  medicine?: M | null
}

export interface ResolveInstanceMedicineOptions<M = InstanceMedicineLike> {
  /**
   * Protocolo dono da ocorrência. Usado SÓ para localizar o registro do medicamento, e apenas
   * quando ele descreve a MESMA identidade congelada. Nunca decide QUAL é o medicamento.
   */
  protocol?: MedicineBearingProtocol<M> | null
  /** Índice `medicine_id → medicine` (ver `buildMedicineIndex`), p/ resolver o congelado. */
  medicinesById?: ReadonlyMap<string, M> | null
}

export interface ResolvedInstanceMedicine<M = InstanceMedicineLike> {
  /** Identidade congelada da ocorrência. */
  medicineId: string | null
  /** Registro do medicamento correspondente a `medicineId`, quando disponível. */
  medicine: M | null
  /**
   * Como `medicine` foi obtido — `'instance'`/`'index'` = congelado (correto);
   * `'protocol'` = fallback legado (some no PO-3); `'none'` = sem registro disponível.
   */
  source: 'instance' | 'index' | 'protocol' | 'none'
}

/**
 * ID do medicamento CONGELADO na ocorrência.
 *
 * Leitura direta da coluna, sem fallback: desde o gate `SET NOT NULL` (PO-3) ela é obrigatória
 * no banco. `null` aqui significa "o chamador não trouxe a coluna no select" — um defeito de
 * leitura a corrigir no select, não um caso a contornar caindo no protocolo.
 *
 * @param instance - linha de `dose_instances`
 * @returns uuid do medicamento congelado, ou `null` se a coluna não veio no select
 */
export function resolveInstanceMedicineId(
  instance: MedicineBearingInstance<unknown> | null | undefined
): string | null {
  return instance?.medicine_id ?? null
}

/**
 * Índice `medicine_id → medicine` a partir dos protocolos já carregados pelo consumidor.
 *
 * O congelado de uma instância antiga costuma ser o medicamento de OUTRO protocolo do mesmo
 * usuário (é exatamente o que a titulação produz: N protocolos, um por medicamento da escada),
 * então os embeds já em mãos bastam — sem query nova.
 *
 * @param protocols - protocolos com embed `medicine`
 * @returns mapa imutável por id do medicamento
 */
export function buildMedicineIndex<M extends InstanceMedicineLike>(
  protocols: readonly (MedicineBearingProtocol<M> | null | undefined)[] | null | undefined
): Map<string, M> {
  const index = new Map<string, M>()
  if (!Array.isArray(protocols)) return index
  for (const protocol of protocols) {
    const medicine = protocol?.medicine
    const id = medicine?.id ?? protocol?.medicine_id
    if (!medicine || typeof id !== 'string' || !id) continue
    if (!index.has(id)) index.set(id, medicine)
  }
  return index
}

/**
 * Identidade do medicamento de uma ocorrência — ponto ÚNICO de leitura (SC-004).
 *
 * A identidade vem SEMPRE da coluna congelada. As três fontes abaixo só decidem ONDE está o
 * registro dessa identidade: embed direto da ocorrência → índice pelo id congelado → protocolo,
 * este último apenas quando descreve o MESMO medicamento. Quando o registro não está em mãos,
 * devolve `medicine: null` com o `medicineId` correto: mentir sobre QUAL medicamento é seria
 * pior do que não exibir o nome.
 *
 * @param instance - linha de `dose_instances`
 * @param options - `protocol` e/ou `medicinesById` (ver `buildMedicineIndex`)
 */
export function resolveInstanceMedicine<M>(
  instance: MedicineBearingInstance<M> | null | undefined,
  options: ResolveInstanceMedicineOptions<M> = {}
): ResolvedInstanceMedicine<M> {
  const { protocol = null, medicinesById = null } = options
  const medicineId = resolveInstanceMedicineId(instance)

  if (instance?.medicine) return { medicineId, medicine: instance.medicine, source: 'instance' }

  if (medicineId && medicinesById) {
    const indexed = medicinesById.get(medicineId)
    if (indexed) return { medicineId, medicine: indexed, source: 'index' }
  }

  // O protocolo é fonte do REGISTRO, nunca da identidade: só entra quando aponta para o MESMO
  // medicamento congelado. Se o protocolo já evoluiu, devolver `p.medicine` reescreveria o
  // passado — exatamente o bug que esta spec existe para matar.
  const protocolMedicineId = protocol?.medicine_id ?? null
  if (protocol?.medicine && medicineId && medicineId === protocolMedicineId) {
    return { medicineId, medicine: protocol.medicine, source: 'protocol' }
  }

  return { medicineId, medicine: null, source: 'none' }
}
