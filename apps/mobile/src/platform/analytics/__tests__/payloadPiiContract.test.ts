// payloadPiiContract.test.ts — T053 / PO-6 (065 PR D): payload de analytics NUNCA carrega valor de
// biomarcador, texto de chatbot nem PII de perfil (FR-8, R-042).
//
// Duas camadas: (1) comportamento — a casca measuresRepo.create com payload clínico só emite o tipo;
// (2) varredura estática — todo `logEvent(...)` do app é lido e reprovado se citar chave proibida.
// A (2) pega o emissor novo que nasce sem teste próprio.
import fs from 'fs'
import path from 'path'
const mockLogEvent = jest.fn()
jest.mock('@platform/analytics/productAnalytics', () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}))

const mockCreate = jest.fn()
jest.mock('@dosiq/core', () => ({
  createBiomarkerRepository: () => ({ create: (...a: unknown[]) => mockCreate(...a), list: jest.fn() }),
}))

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({ supabase: { auth: {} } }))

import { measuresRepo } from '../../../features/measures/services/measuresRepo'
import { EVENTS } from '../analyticsEvents'

const FORBIDDEN = [
  'value', 'value_secondary', 'notes',            // biomarcador (dado clínico)
  'message', 'response', 'history', 'content',    // chatbot (texto livre)
  'display_name', 'birth_date', 'city', 'phone', 'email', // perfil (PII)
]

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

// Casca do measuresRepo: TodayScreen, HistoryScreen e useMeasures criam por aqui (C1.5 G-1).
describe('PO-6 / 069 PO-19 — biomarker_logged só com tipo + origem', () => {
  it('create com valor/secundário/notas emite só { biomarker_type, surface } da linha gravada', async () => {
    mockCreate.mockResolvedValue({ id: 'b1', type: 'pressao_arterial', value: 132, value_secondary: 85, notes: 'tontura' })

    await measuresRepo.create({ type: 'pressao_arterial', value: 132, value_secondary: 85, notes: 'tontura' })

    expect(mockLogEvent.mock.calls).toEqual([[EVENTS.BIOMARKER_LOGGED, { biomarker_type: 'pressao_arterial', surface: 'mobile' }]])
    expect(JSON.stringify(mockLogEvent.mock.calls)).not.toMatch(/132|85|tontura/)
  })

  it('create pelo pedido da dose carrega entry_point dose_prompt e nada do valor', async () => {
    mockCreate.mockResolvedValue({ id: 'b2', type: 'peso', value: 82.5, unit: 'kg' })

    await measuresRepo.create({ type: 'peso', value: 82.5 }, { entry_point: 'dose_prompt' })

    expect(mockLogEvent.mock.calls).toEqual([
      [EVENTS.BIOMARKER_LOGGED, { biomarker_type: 'peso', surface: 'mobile', entry_point: 'dose_prompt' }],
    ])
    expect(JSON.stringify(mockLogEvent.mock.calls)).not.toMatch(/82/)
  })

  it('create que falha NÃO emite e propaga o erro', async () => {
    mockCreate.mockRejectedValue(new Error('boom'))
    await expect(measuresRepo.create({ type: 'peso', value: 70 })).rejects.toThrow('boom')
    expect(mockLogEvent).not.toHaveBeenCalled()
  })
})

// Extrai os argumentos de cada `logEvent(` por contagem de parênteses (payload pode ter várias linhas).
function logEventCalls(src: string): string[] {
  const out: string[] = []
  let i = src.indexOf('logEvent(')
  while (i !== -1) {
    let depth = 0
    let j = i + 'logEvent'.length
    for (; j < src.length; j++) {
      if (src[j] === '(') depth++
      else if (src[j] === ')' && --depth === 0) break
    }
    out.push(src.slice(i, j + 1))
    i = src.indexOf('logEvent(', j)
  }
  return out
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(p)
    return /\.(ts|tsx|js)$/.test(e.name) ? [p] : []
  })
}

describe('PO-6 — nenhum logEvent do app cita chave proibida', () => {
  it('varredura estática de apps/mobile/src', () => {
    const root = path.join(__dirname, '../../..')
    const offenders: string[] = []
    let scanned = 0
    for (const file of sourceFiles(root)) {
      const src = fs.readFileSync(file, 'utf8')
      if (!src.includes('logEvent(')) continue
      for (const call of logEventCalls(src)) {
        scanned++
        // Chave de objeto (`value:`) ou shorthand (`{ value }` / `, value,`) — não propriedade lida.
        const hit = FORBIDDEN.find((k) => new RegExp(`[{,]\\s*${k}\\s*[:,}]`).test(call))
        if (hit) offenders.push(`${path.relative(root, file)} → ${hit}: ${call.replace(/\s+/g, ' ')}`)
      }
    }
    expect(scanned).toBeGreaterThan(30) // varredura vazia = guard morto
    expect(offenders).toEqual([])
  })
})

// Super properties (register em productAnalytics) — chave igual no payload SOBRESCREVE o valor global
// no evento (visto no smoke do PR D: consent_blocked_attempt{mode} apagou a densidade).
// `treatment_count_bucket` (092 FR-002): persona por volume de tratamentos — nunca em payload (INV-5).
const SUPER_PROPS = ['app_env', 'channel', 'is_internal', 'mode', 'runtime_version', 'treatment_count_bucket', 'update_id']
// Exceções declaradas: mode_changed carrega a MESMA semântica (densidade nova); stock_onboarding_choice
// é legado da 044 (série SC-004 — renomear quebra o histórico; ver analysis-prD G-10).
// ⏳ Janela (092 D-4): stock_onboarding_choice emite `mode` E `stock_mode` com o mesmo valor. Sai
// da lista quando a série SC-004 da 044 for lida por `stock_mode` — aí `mode` deixa o payload.
const SUPER_PROP_EXEMPT = ['MODE_CHANGED', 'STOCK_ONBOARDING_CHOICE']

describe('nenhum logEvent reusa chave de super property', () => {
  it('varredura estática de apps/mobile/src', () => {
    const root = path.join(__dirname, '../../..')
    const offenders: string[] = []
    for (const file of sourceFiles(root)) {
      const src = fs.readFileSync(file, 'utf8')
      if (!src.includes('logEvent(')) continue
      for (const call of logEventCalls(src)) {
        if (SUPER_PROP_EXEMPT.some((e) => call.includes(`EVENTS.${e}`))) continue
        const hit = SUPER_PROPS.find((k) => new RegExp(`[{,]\\s*${k}\\s*[:,}]`).test(call))
        if (hit) offenders.push(`${path.relative(root, file)} → ${hit}: ${call.replace(/\s+/g, ' ')}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

// 092 FR-003 / PO-3 — `surface` é obrigatória em todo evento (TRACKING_PLAN §3). SEM default no
// wrapper (plan.md, SD-3 revertida: emissor headless esquecido sairia `mobile` em silêncio) e SEM
// lista de eventos isentos. A chamada passa se o texto cita `surface` OU se um identificador do
// payload (nu ou espalhado) recebe `surface` no mesmo arquivo — cobre os emissores headless que
// montam o payload numa variável e omitem a chave quando a origem é desconhecida (CON-034 inv. 4).
function payloadIdentifiers(call: string): string[] {
  const args = call.slice(call.indexOf('(') + 1, -1)
  const payload = args.slice(args.indexOf(',') + 1)
  return [...payload.matchAll(/(?:\.\.\.|^\s*|[?:]\s*)([A-Za-z_$][\w$]*)\b(?!\s*[:(])/g)].map((m) => m[1])
}

function identifierCarriesSurface(src: string, id: string): boolean {
  return new RegExp(`\\b${id}\\.surface\\s*=|\\b${id}\\s*=[^;\\n]*\\bsurface\\b`).test(src)
}

describe('092 PO-3 — todo logEvent do app declara surface', () => {
  it('varredura estática de apps/mobile/src', () => {
    const root = path.join(__dirname, '../../..')
    const offenders: string[] = []
    let scanned = 0
    for (const file of sourceFiles(root)) {
      const src = fs.readFileSync(file, 'utf8')
      if (!src.includes('logEvent(')) continue
      for (const call of logEventCalls(src)) {
        if (/^logEvent\(eventName/.test(call)) continue // definição do wrapper
        scanned++
        if (/\bsurface\b/.test(call)) continue
        if (payloadIdentifiers(call).some((id) => identifierCarriesSurface(src, id))) continue
        offenders.push(`${path.relative(root, file)}: ${call.replace(/\s+/g, ' ').slice(0, 120)}`)
      }
    }
    expect(scanned).toBeGreaterThan(30)
    expect(offenders).toEqual([])
  })
})
