/**
 * Reconstrução da escada COMPLETA de titulação por tratamento (spec 029 F4/F6, AP-311).
 *
 * 🔴 POR QUE ISTO EXISTE: o embed `titration_steps(...)` pendurado num select de `protocols`
 * resolve pela FK `titration_steps.protocol_id → protocols.id`, e **a maioria das etapas não
 * tem `protocol_id`** — ele só é preenchido na etapa que vira executora (medido em prod
 * 2026-07-20: 6 de 15 etapas sem, e 1 das 4 vigentes sem). Quem lê o embed vê o pedaço da
 * escada que por acaso aponta para aquele protocolo, quase nunca incluindo a etapa `current`
 * — e o badge anuncia "Estável" sobre um tratamento em plena evolução.
 *
 * A identidade de uma escada é a `titration_id`; `protocol_id` é o executor VIGENTE e, por
 * construção do modelo (ADR-085), transitório.
 *
 * Esta função é PURA (recebe as linhas já buscadas) porque o cliente Supabase difere entre
 * web e mobile — o que NÃO pode diferir é a regra. Ela nasceu duplicada no mobile e foi
 * extraída no F6, quando a web passou a precisar da mesma escada: manter duas cópias da
 * mesma derivação é como o projeto acumulou três grafias de mililitro (AP-306).
 */

export interface LadderStepRow {
  titration_id: string
  protocol_id?: string | null
  [key: string]: unknown
}

export interface ProtocolWithLadder {
  id: string
  titration_steps?: unknown
  [key: string]: unknown
}

export interface AttachFullLaddersResult<T> {
  protocols: T[]
  /**
   * Titulações cujas etapas NÃO carregam `protocol_id` em nenhuma linha — inatribuíveis.
   *
   * AP-311 regra 3: não achar o vínculo ≠ não existir vínculo. O tratamento dessa titulação
   * cai de volta no embed incompleto e o badge volta a subestimar a evolução — o mesmo furo
   * que esta função corrige, de novo em silêncio. Não dá para consertar aqui (o vínculo não
   * existe no dado), mas o chamador TEM de poder logar. Ignorar este retorno reintroduz o
   * silêncio.
   */
  orphanTitrationIds: string[]
}

/**
 * Troca o embed recortado por `protocol_id` pela escada completa de cada tratamento.
 *
 * @param protocols - tratamentos já buscados (com ou sem o embed `titration_steps`)
 * @param steps - TODAS as etapas do usuário (uma query só, sem N+1)
 * @returns tratamentos com `titration_steps` = escada completa + as titulações órfãs
 */
export function attachFullLadders<T extends ProtocolWithLadder>(
  protocols: T[] | null | undefined,
  steps: LadderStepRow[] | null | undefined
): AttachFullLaddersResult<T> {
  const list = Array.isArray(protocols) ? protocols : []
  if (list.length === 0 || !Array.isArray(steps) || steps.length === 0) {
    return { protocols: list, orphanTitrationIds: [] }
  }

  const titrationByProtocol = new Map<string, string>()
  const stepsByTitration = new Map<string, LadderStepRow[]>()

  for (const s of steps) {
    if (!s?.titration_id) continue
    // Primeira etapa que declara o vínculo ganha: um protocolo executa UMA titulação.
    if (s.protocol_id && !titrationByProtocol.has(s.protocol_id)) {
      titrationByProtocol.set(s.protocol_id, s.titration_id)
    }
    if (!stepsByTitration.has(s.titration_id)) stepsByTitration.set(s.titration_id, [])
    stepsByTitration.get(s.titration_id)!.push(s)
  }

  const linked = new Set(titrationByProtocol.values())
  const orphanTitrationIds = [...stepsByTitration.keys()].filter((id) => !linked.has(id))

  const withLadders = list.map((p) => {
    const titrationId = titrationByProtocol.get(p.id)
    const ladder = titrationId ? stepsByTitration.get(titrationId) : null
    // Sem escada ligada, PRESERVA o embed: um tratamento sem titulação tem array vazio e
    // badge "Estável" — sobrescrever com null aqui apagaria o caso legítimo.
    return ladder ? ({ ...p, titration_steps: ladder } as T) : p
  })

  return { protocols: withLadders, orphanTitrationIds }
}
