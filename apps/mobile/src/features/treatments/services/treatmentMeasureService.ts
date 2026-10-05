// treatmentMeasureService.ts — leitor da série de peso do tratamento (spec 069 Bb · T049 · PO-8).
//
// Lê o que a ponte do core (`buildProtocolMeasureSeries`, a MESMA do PDF da 097) precisa e devolve a
// série pronta. Nada de regra aqui: janela, etapas, filtro de dose e estado vêm do core.
//
// - Escada + fuso do DONO em paralelo (padrão useTitrationTimeline; fuso indisponível ⇒ SP, R-254).
// - Janela [início da série, hoje do dono] — o início vem de `protocolMeasureWindowStart` (L-3).
// - Pesos e contagens de dose paginados até a página incompleta (AP-186); a RPC tem teto de 186
//   dias (22023) ⇒ uma chamada por fatia de `splitDayWindow`. Qualquer falha LANÇA: série parcial
//   mostraria adesão e peso errados como se fossem certos.
// - R-299: doses contam pelo `protocol_id` da linha de `dose_instances` (fato, via RPC), nunca pelo
//   medicamento vivo do protocolo.
// ⚠️ R-295: selects executados contra o PostgREST em 2026-10-05 (analysis-Bb, 200).

import {
  buildProtocolMeasureSeries,
  getEndOfDayISO,
  getStartOfDayISO,
  getTodayLocal,
  protocolMeasureWindowStart,
  splitDayWindow,
  type MeasureBridgeDoseDay,
  type MeasureBridgeMedicine,
  type MeasureBridgeProtocol,
  type MeasureInput,
  type ProtocolMeasureSeries,
} from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { getLadderForProtocol, getUserTimezone } from './titrationService'

// TODO(040-strict): mesma duplicata de @supabase/supabase-js do titrationService — cast de fronteira.
const typedClient = supabase as any

export const MEASURE_PAGE_SIZE = 1000
const BIOMARKER_SELECT = 'id, type, value, measured_at'
const DEFAULT_TZ = 'America/Sao_Paulo'

export interface TreatmentMeasureProtocol extends MeasureBridgeProtocol {
  medicine?: MeasureBridgeMedicine | null
}

export interface TreatmentMeasureResult extends ProtocolMeasureSeries {
  /** Escada com 2+ etapas (faixas no gráfico); senão o card mostra "Dose atual". */
  hasLadder: boolean
  /** Hoje no fuso do dono (E-B3). */
  today: string
  timezone: string
}

type PageQuery = (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>

async function readAllPages<T>(query: PageQuery): Promise<T[]> {
  const out: T[] = []
  let offset = 0
  for (;;) {
    const { data, error } = await query(offset, offset + MEASURE_PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as T[]
    out.push(...page)
    if (page.length < MEASURE_PAGE_SIZE) break
    offset += MEASURE_PAGE_SIZE
  }
  return out
}

async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

/**
 * Série de peso do tratamento, ou `null` se o tratamento não é elegível (R-11).
 * @throws em qualquer leitura que falhar (o hook decide rede × outro).
 */
export async function loadTreatmentMeasureSeries(
  protocol: TreatmentMeasureProtocol
): Promise<TreatmentMeasureResult | null> {
  const [ladder, timezone, userId] = await Promise.all([
    getLadderForProtocol(protocol.id),
    getUserTimezone().catch(() => DEFAULT_TZ),
    getUserId(),
  ])

  const medicines: MeasureBridgeMedicine[] = []
  const seen = new Set<string>()
  for (const m of [protocol.medicine, ...ladder.map((s) => s.medicine)]) {
    if (m?.id && !seen.has(m.id)) {
      seen.add(m.id)
      medicines.push(m)
    }
  }

  const today = getTodayLocal(timezone)
  const start = protocolMeasureWindowStart({ protocol, medicines, steps: ladder, timezone })
  const from = start ?? today
  const slices = splitDayWindow(from, today)

  let measures: MeasureInput[] = []
  let doseDays: MeasureBridgeDoseDay[] = []
  if (slices.length > 0) {
    const fromIso = getStartOfDayISO(from, timezone)
    const toIso = getEndOfDayISO(today, timezone)
    const [weights, ...sliceDays] = await Promise.all([
      readAllPages<MeasureInput>((a, b) =>
        typedClient
          .from('biomarkers_log')
          .select(BIOMARKER_SELECT)
          .eq('user_id', userId)
          .eq('type', 'peso')
          .gte('measured_at', fromIso)
          .lte('measured_at', toIso)
          .order('measured_at')
          .order('id')
          .range(a, b)
      ),
      ...slices.map((s) =>
        readAllPages<MeasureBridgeDoseDay>((a, b) =>
          // ORDER BY da RPC (day, slot, protocol_id) não é único — a linha também agrupa medicine_id;
          // empate entre páginas duplicaria/pularia linha. Chave completa no cliente (RC6 #866;
          // validado no PostgREST 2026-10-05: 200, coluna inválida ⇒ 42703).
          typedClient
            .rpc('report_dose_days', { p_from: s.from, p_to: s.to })
            .order('day')
            .order('slot')
            .order('protocol_id')
            .order('medicine_id')
            .range(a, b)
        )
      ),
    ])
    measures = weights
    doseDays = sliceDays.flat()
  }

  const result = buildProtocolMeasureSeries({
    biomarkerType: 'peso',
    protocol,
    medicines,
    steps: ladder,
    measures,
    doseDays,
    timezone,
    to: today,
  })
  if (!result) return null
  return { ...result, hasLadder: ladder.length >= 2, today, timezone }
}
