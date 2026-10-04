// Template HTML único do relatório (spec 097 A2 — PO-13, PO-14, PO-15 vocabulário, PO-SEC-3).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildReportModel, type ReportModel } from '../reportModel'
import { chartDateTicks, reportFileBaseName, renderReportFooter, renderReportHtml } from '../reportTemplate'
import type { ReportTitrationStepRow } from '../reportTypes'
import { dd, fixture, GEN, med, proto } from './reportFixture'

const HOSTILE = ['<img src=x onerror=alert(1)>', '</style><script>alert(1)</script>', '"><svg onload=alert(1)>']

const step = (over: Partial<ReportTitrationStepRow> & { id: string; position: number }): ReportTitrationStepRow => ({
  titration_id: 't1',
  medicine_id: 'm_moun',
  protocol_id: 'p_moun',
  dose: 2.5,
  intake_unit: 'mg',
  duration_days: 28,
  status: 'planned',
  started_at: null,
  ended_at: null,
  ...over,
})

const LADDER_STEPS = [
  step({ id: 's1', position: 1, status: 'completed', started_at: '2026-08-01T09:00:00-03:00', ended_at: '2026-08-29T09:00:00-03:00' }),
  step({ id: 's2', position: 2, dose: 5, status: 'current', duration_days: 35, started_at: '2026-08-29T09:00:00-03:00' }),
  step({ id: 's3', position: 3, dose: 7.5, status: 'planned' }),
]

/** Texto visível (sem tags nem atributos), para varrer vocabulário. */
function visibleText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

function model(over = {}): ReportModel {
  return buildReportModel(fixture(over), { generatedAt: GEN })
}

describe('renderReportHtml — estrutura (PO-13)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('documento completo com título = nome do arquivo e seções na ordem do DESIGN_DECISOES §3', () => {
    const html = renderReportHtml(model({ titrationSteps: LADDER_STEPS }))
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<title>dosiq-relatorio-7d-2026-09-30</title>')
    const order = [
      'Relatório de acompanhamento',
      'Para esta consulta',
      'Medicamentos em uso',
      'Tomadas no período',
      'Mudanças no período',
      'Escadas de titulação',
      'Tratamentos encerrados no período',
      '<h2>Estoque',
    ]
    const positions = order.map((t) => html.indexOf(t))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('rodapé do Chromium: nome, período, linha SaMD e contadores de página nativos', () => {
    const footer = renderReportFooter(model())
    expect(footer).toContain('dosiq · Ana · 24/09 a 30/09')
    expect(footer).toContain('não é avaliação clínica nem recomendação')
    expect(footer).toContain('<span class="pageNumber"></span>')
    expect(footer).toContain('<span class="totalPages"></span>')
  })

  it('rodapé escapa o nome do paciente', () => {
    const footer = renderReportFooter(model({ profile: { displayName: '<img src=x onerror=alert(1)>', birthDate: null, allergies: [], bloodType: null } }))
    expect(footer).not.toMatch(/<img/)
  })

  it('documento contínuo: uma tabela de medicamentos só, com thead repetível e blocos sem corte', () => {
    const html = renderReportHtml(model())
    expect(html.match(/<th>Medicamento<\/th>/g)).toHaveLength(2) // medicamentos + estoque
    expect(html).toContain('thead{display:table-header-group}')
    expect(html).toContain('break-inside:avoid')
    expect(html).not.toContain('class="sheet"')
  })

  it('seção sem dado não aparece (sem escada, sem encerrado, sem consulta)', () => {
    const m = model()
    const html = renderReportHtml({ ...m, ladders: [], intakes: { ...m.intakes, ended: [] }, forThisVisit: [], changes: [] })
    expect(html).not.toContain('Escadas de titulação')
    expect(html).not.toContain('Tratamentos encerrados no período')
    expect(html).not.toContain('Para esta consulta')
    expect(html).not.toContain('Mudanças no período')
  })

  it('período sem registro: gera e diz "Nenhum registro no período" (FR-016)', () => {
    const html = renderReportHtml(model({ doseDays: [], protocols: [], medicines: [], stockTotals: [], biomarkers: [] }))
    expect(html).toContain('Nenhum registro no período')
  })

  it('tomadas: contagem com percentual, por horário e faixa com uma célula por dia', () => {
    const html = renderReportHtml(model())
    expect(html).toContain('12 de 14 doses (86%)')
    expect(html).toContain('20:00 5/7')
    const strip = html.match(/<div class="strip">([\s\S]*?)<\/div>/)
    expect(strip?.[1].match(/class="c /g)).toHaveLength(7)
  })

  it('90 dias: uma faixa só, de 90 células (180 saiu — smoke 097 B)', () => {
    const base = fixture()
    const m = buildReportModel({ ...base, window: { from: '2026-07-03', to: '2026-09-30', days: 90 } }, { generatedAt: GEN })
    const row = renderReportHtml(m).slice(renderReportHtml(m).indexOf('data-protocol="p_met"'))
    const strips = row.match(/<div class="strip">([\s\S]*?)<\/div>/g) ?? []
    expect(strips[0]?.match(/class="c /g)).toHaveLength(90)
    expect(row).not.toContain('d180')
  })
})

describe('renderReportHtml — término, escada e estoque (PO-14)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('(a) término vencendo na coluna e em "Para esta consulta"; sem término = contínuo', () => {
    const html = renderReportHtml(model())
    expect(html).toContain('até 05/10/26')
    expect(html).toMatch(/Receita · Mounjaro[^<]*05\/10\/26/)
    expect(html).toContain('contínuo')
  })

  it('(b) escada com concluída, atual e prevista, com datas; título diz "escada registrada"', () => {
    const html = renderReportHtml(model({ titrationSteps: LADDER_STEPS }))
    expect(html).toContain('escada registrada no app; datas futuras são previstas')
    expect(html).toContain('01/08 a 29/08')
    expect(html).toContain('desde 29/08')
    expect(html).toContain('prevista a partir de 03/10')
    expect(html).toContain('Titulação 2/3')
  })

  it('(b) tratamento sem escada fica fora da seção', () => {
    const html = renderReportHtml(model({ titrationSteps: LADDER_STEPS }))
    const ladders = html.slice(html.indexOf('Escadas de titulação'), html.indexOf('Tratamentos encerrados'))
    expect(ladders).toContain('Mounjaro')
    expect(ladders).not.toContain('Glifage')
  })

  it('(c) dose-only: sem seção de estoque nem item de estoque', () => {
    const html = renderReportHtml(model({ stockTrackingEnabled: false }))
    expect(html).not.toMatch(/<h2[^>]*>Estoque/)
    expect(html).not.toContain('Estoque ·')
  })

  it('(c) com rastreio: estoque presente e nenhuma menção a preço/custo', () => {
    const html = renderReportHtml(model())
    expect(html).toMatch(/<h2[^>]*>Estoque/)
    expect(visibleText(html)).not.toMatch(/R\$|preço|custo/i)
  })

  it('forma de todo medicamento no detalhe; sem chip de injetável nem validade após aberto (FR-006)', () => {
    const html = renderReportHtml(model())
    expect(html).toMatch(/· injetável<\/div>/)
    expect(html).not.toContain('validade após aberto')
    expect(html).not.toContain('<span class="chip">Injetável')
  })

  it('equivalente "(≈ … mL)" não quebra; "1 dose" no singular; encerrado vira sobretítulo', () => {
    const html = renderReportHtml(model())
    expect(html).toContain('<span class="nw">(≈ 0,5 mL)</span>')
    expect(html).not.toMatch(/\b1 de 1 doses/)
    expect(html).toMatch(/<div class="over num">encerrado em \d{2}\/\d{2}\/\d{2}<\/div><b>/)
  })
})

describe('renderReportHtml — ajustes do smoke (PO-13, 2026-10-03)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('escada de uma etapa não vira chip de titulação', () => {
    const one = [step({ id: 's1', position: 1, status: 'current', duration_days: null, started_at: '2026-08-01T09:00:00-03:00' })]
    expect(renderReportHtml(model({ titrationSteps: one }))).not.toContain('Titulação 1/1')
  })

  it('etapa prevista depois de etapa contínua diz "prevista, sem data" (nunca "—")', () => {
    const steps = [
      step({ id: 's1', position: 1, status: 'current', duration_days: null, started_at: '2026-08-01T09:00:00-03:00' }),
      step({ id: 's2', position: 2, dose: 5, status: 'planned' }),
    ]
    const html = renderReportHtml(model({ titrationSteps: steps }))
    expect(html).toContain('prevista, sem data')
    expect(html).not.toContain('prevista a partir de —')
  })

  it('escada com mais de um cadastro diz o medicamento de cada etapa; com um só, não', () => {
    const base = fixture()
    const twin = med({ id: 'm_moun2', name: 'Mounjaro', presentation: 'injetavel', dosage_unit: 'mg/ml', dosage_per_pill: 5, concentration_volume_ml: 0.5 })
    const other = med({ id: 'm_oze', name: 'Ozempic', presentation: 'injetavel', dosage_unit: 'mg/ml', dosage_per_pill: 1.34 })
    const steps = [
      step({ id: 's1', position: 1, medicine_id: 'm_moun2', status: 'completed', started_at: '2026-08-01T09:00:00-03:00', ended_at: '2026-08-29T09:00:00-03:00' }),
      step({ id: 's2', position: 2, dose: 5, status: 'current', started_at: '2026-08-29T09:00:00-03:00' }),
      step({ id: 's3', position: 3, medicine_id: 'm_oze', dose: 1, status: 'planned' }),
    ]
    const html = renderReportHtml(
      buildReportModel({ ...base, medicines: [...base.medicines, twin, other], titrationSteps: steps }, { generatedAt: GEN })
    )
    const meds = [...html.matchAll(/<div class="med num">([^<]*)<\/div>/g)].map((x) => x[1])
    expect(meds).toHaveLength(3)
    expect(meds[0]).toMatch(/^Mounjaro · /)
    expect(meds[2]).toMatch(/^Ozempic · /)
    expect(renderReportHtml(model({ titrationSteps: LADDER_STEPS }))).not.toContain('class="med')
  })
})

describe('renderReportHtml — gráfico de peso por etapa (DS-7, PO-15)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  const withWeight = (): ReportModel => {
    const m = model({ titrationSteps: LADDER_STEPS })
    m.ladders[0].weightSeries = {
      points: [
        { day: '2026-09-24', kg: 92.4 },
        { day: '2026-09-27', kg: 91.8 },
        { day: '2026-09-30', kg: 91.8 },
      ],
      steps: [
        { index: 2, dose: '5 mg', start: '2026-09-24', end: null, clipped: true, meanKg: 92, count: 3, taken: 1, expected: 1, current: true },
      ],
      firstDay: '2026-09-24',
      lastDay: '2026-09-30',
    }
    m.ladders[0].weightChart = true
    return m
  }

  it('desenha pontos sem linha e uma linha por etapa com média, pesagens e doses', () => {
    const html = renderReportHtml(withWeight())
    expect(html).toContain('Peso durante o tratamento')
    expect(html.match(/<circle /g)?.length).toBeGreaterThanOrEqual(3)
    expect(html).not.toMatch(/<polyline|<path d="M[^"]*L/)
    expect(html).toContain('Etapa 2 (no período) — Peso médio 92 kg · 3 pesagens · Doses tomadas: 1 de 1')
    // Dose e datas ficam só na escada (smoke 097 A2).
    expect(html).not.toMatch(/<div class="wl num">Etapa 2 · 5 mg/)
    expect(html).toContain('no período')
  })

  it('sem série (oral diário / abaixo do B-0) não há gráfico', () => {
    expect(renderReportHtml(model({ titrationSteps: LADDER_STEPS }))).not.toContain('Peso durante o tratamento')
  })

  it('vocabulário: sem perdeu/ganhou/diferença em kg', () => {
    const text = visibleText(renderReportHtml(withWeight()))
    expect(text).not.toMatch(/perdeu|ganhou|diferença|variação/i)
  })
})

describe('renderReportHtml — SaMD e segurança (SC-004, PO-SEC-3)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('nenhum termo de recomendação ou juízo no texto do documento', () => {
    // O aviso fixo do rodapé NEGA recomendação ("não é avaliação clínica nem recomendação");
    // é o único lugar onde a palavra pode existir.
    const text = visibleText(renderReportHtml(model({ titrationSteps: LADDER_STEPS }))).replaceAll(
      'não é avaliação clínica nem recomendação',
      ''
    )
    expect(text).not.toMatch(/\b(meta|alvo|ideal|ajust\w*|recomend\w*|risco|atenção|excelente|crítico|cuidado|evite|aplique)\b/i)
  })

  it('texto hostil em nome do paciente, medicamento e alergia sai escapado; zero script/on*', () => {
    for (const evil of HOSTILE) {
      const html = renderReportHtml(
        model({
          profile: { displayName: evil, birthDate: null, allergies: [evil], bloodType: evil },
          medicines: [med({ id: 'm_met', name: evil, active_ingredient: evil, dosage_per_pill: 850 })],
          protocols: [proto({ id: 'p_met', medicine_id: 'm_met', name: evil, time_schedule: ['08:00', '20:00'] })],
        })
      )
      expect(html).not.toMatch(/<script/i)
      expect(html).not.toMatch(/<(img|svg)[^>]*\son\w+=/i)
      expect(html).not.toMatch(/<[a-z][^>]*\son\w+=/i)
      expect(html).toContain('&lt;')
    }
  })

  it('nome do paciente ausente não imprime "null"/"undefined"', () => {
    const html = renderReportHtml(model({ profile: { displayName: null, birthDate: null, allergies: [], bloodType: null } }))
    expect(visibleText(html)).not.toMatch(/null|undefined|NaN/)
  })

  it('reportFileBaseName segue dosiq-relatorio-<dias>d-<data>', () => {
    expect(reportFileBaseName({ from: '2026-09-01', to: '2026-09-30', days: 30 })).toBe('dosiq-relatorio-30d-2026-09-30')
  })
})

describe('renderReportHtml — ajustes do smoke 2 (spec 097 A2, 2026-10-03)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('escada de uma etapa só não é titulação: some da seção e do chip', () => {
    const m = model({ titrationSteps: [step({ id: 's1', position: 1, status: 'current', started_at: '2026-08-01T09:00:00-03:00' })] })
    expect(m.ladders).toHaveLength(0)
    const html = renderReportHtml(m)
    expect(html).not.toContain('Escadas de titulação')
    expect(html).not.toContain('Titulação 1/1')
  })

  it('mudança de etapa diz o número e "de … para …"', () => {
    const inWindow = [
      step({ id: 's1', position: 1, status: 'completed', started_at: '2026-08-29T09:00:00-03:00', ended_at: '2026-09-26T09:00:00-03:00' }),
      step({ id: 's2', position: 2, dose: 5, status: 'current', started_at: '2026-09-26T09:00:00-03:00' }),
    ]
    const html = renderReportHtml(model({ titrationSteps: inWindow }))
    expect(visibleText(html)).toMatch(/Mounjaro: etapa 2 iniciada \(de 2,5 mg .*para 5 mg/)
  })

  it('horários fora da agenda atual somam em "outros horários", no fim', () => {
    const base = fixture()
    const extra = [dd('p_met', 'm_met', '2026-09-25', '06:15', { taken_count: 1 }), dd('p_met', 'm_met', '2026-09-26', '22:40', { missed_count: 1 })]
    const m = buildReportModel({ ...base, doseDays: [...base.doseDays, ...extra] }, { generatedAt: GEN })
    const row = m.intakes.active.find((r) => r.protocolId === 'p_met')!
    expect(row.bySlot.map((s) => s.slot)).toEqual(['08:00', '20:00', 'outros horários'])
    expect(row.bySlot[2]).toEqual({ slot: 'outros horários', taken: 1, expected: 2 })
  })

  it('legenda desenhada com as mesmas células, em tomadas e em encerrados', () => {
    const html = renderReportHtml(model())
    const legends = html.match(/<div class="legend">/g) ?? []
    expect(legends).toHaveLength(2)
    for (const state of ['full', 'partial', 'none', 'paused', 'empty']) expect(html).toContain(`<span class="c ${state}"></span>`)
  })

  it('logo embutido como data: (o Chromium não acessa a rede)', () => {
    const html = renderReportHtml(model())
    expect(html).toMatch(/<img class="logo" src="data:image\/png;base64,[A-Za-z0-9+/=]+" alt="dosiq">/)
    expect(html).not.toMatch(/src="https?:/)
  })
})

describe('renderReportHtml — pausa nas mudanças (smoke 097 A2)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('pausa não repete a data: "[Remédio]: tratamento pausado."', () => {
    const text = visibleText(renderReportHtml(model()))
    expect(text).toMatch(/27\/09 Puran: tratamento pausado\./)
    expect(text).not.toMatch(/pausado (de|em) \d/)
  })
})

describe('eixo = período inteiro; cabeçalho avisa o 1º registro (smoke 097 B, desfaz o recorte do A2)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  const peso = (day: string) => ({ id: day, type: 'peso', value: 80, value_secondary: null, unit: 'kg', measured_at: `${day}T07:00:00-03:00`, context: null })

  it('90 dias com registro só no fim: faixa e denominadores do período inteiro; cabeçalho avisa', () => {
    const base = fixture()
    const m = buildReportModel({ ...base, biomarkers: [], window: { from: '2026-07-03', to: '2026-09-30', days: 90 } }, { generatedAt: GEN })
    expect(m.header.window).toEqual({ from: '2026-07-03', to: '2026-09-30', days: 90 })
    expect(m.header.recordsFrom).toBe('2026-09-24')
    expect(m.header.daysWithDose.of).toBe(90)
    const html = renderReportHtml(m)
    expect(visibleText(html)).toContain('03/07/2026 a 30/09/2026 (90 dias) · registros a partir de 24/09/2026')
    const row = html.slice(html.indexOf('data-protocol="p_met"'))
    expect(row.match(/<div class="strip">([\s\S]*?)<\/div>/)?.[0].match(/class="c /g)).toHaveLength(90)
  })

  it('medida antes da 1ª dose também conta como 1º registro (linha de base)', () => {
    const base = fixture()
    const m = buildReportModel({ ...base, biomarkers: [peso('2026-09-10')], window: { from: '2026-07-03', to: '2026-09-30', days: 90 } }, { generatedAt: GEN })
    expect(m.header.recordsFrom).toBe('2026-09-10')
  })

  it('registro desde o início ou nenhum registro: sem aviso', () => {
    const m = model()
    expect(m.header.recordsFrom).toBeNull()
    expect(renderReportHtml(m)).not.toContain('registros a partir de')
    const empty = buildReportModel({ ...fixture(), doseDays: [], biomarkers: [] }, { generatedAt: GEN })
    expect(empty.header.recordsFrom).toBeNull()
  })
})

describe('peso por etapa sem dose prevista (smoke 097 A2)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('etapa sem dose prevista diz isso, nunca "0 de 0"', () => {
    const m = model({ titrationSteps: LADDER_STEPS })
    m.ladders[0].weightSeries = {
      points: [{ day: '2026-09-27', kg: 80 }],
      steps: [{ index: 1, dose: '2,5 mg', start: '2026-09-24', end: '2026-09-25', clipped: false, meanKg: null, count: 0, taken: 0, expected: 0, current: false }],
      firstDay: '2026-09-27',
      lastDay: '2026-09-27',
    }
    const html = renderReportHtml(m)
    expect(html).toContain('Etapa 1 — sem pesagem · sem dose prevista')
    expect(html).not.toContain('0 de 0')
  })
})

describe('doses fora das etapas registradas (smoke 097 A2)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('escada com intervalo: a soma das etapas + "fora das etapas" fecha com a seção de tomadas', () => {
    const base = fixture()
    const peso = { id: 'w', type: 'peso', value: 80, value_secondary: null, unit: 'kg', measured_at: '2026-09-29T07:00:00-03:00', context: null }
    // Etapa 1 termina em 20/09, etapa 2 só começa em 28/09: a dose de 25/09 não tem etapa.
    const gap = [
      step({ id: 'g1', position: 1, status: 'completed', started_at: '2026-09-01T09:00:00-03:00', ended_at: '2026-09-20T09:00:00-03:00' }),
      step({ id: 'g2', position: 2, dose: 5, status: 'current', started_at: '2026-09-28T09:00:00-03:00' }),
    ]
    const doseDays = [...base.doseDays, dd('p_moun', 'm_moun', '2026-09-29', '09:00', { missed_count: 1 })]
    const m = buildReportModel({ ...base, doseDays, titrationSteps: gap, biomarkers: [peso] }, { generatedAt: GEN })
    const ladder = m.ladders.find((l) => l.protocolId === 'p_moun')!
    const row = m.intakes.active.find((r) => r.protocolId === 'p_moun')!
    const inSteps = ladder.weightSeries!.steps.reduce((n, s) => n + s.expected, 0)
    expect(ladder.outsideSteps).toEqual({ taken: 1, expected: 1 })
    expect(inSteps + ladder.outsideSteps!.expected).toBe(row.expected)
    expect(renderReportHtml(m)).toContain('Fora das etapas registradas — Doses tomadas: 1 de 1')
  })
})

describe('mudanças no período pedido, não só no trecho com registro (RC6 #857)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('início de tratamento antes do 1º registro continua nas mudanças', () => {
    const base = fixture()
    const protocols = base.protocols.map((p) => (p.id === 'p_met' ? { ...p, start_date: '2026-08-10' } : p))
    const m = buildReportModel({ ...base, protocols, window: { from: '2026-07-03', to: '2026-09-30', days: 90 } }, { generatedAt: GEN })
    expect((m.header.recordsFrom ?? '') > '2026-08-10').toBe(true)
    expect(m.changes).toContainEqual(expect.objectContaining({ kind: 'started', protocolId: 'p_met', day: '2026-08-10' }))
  })
})

describe('renderReportHtml — unidade de tomada e forma (PO-5, FR-005/FR-006)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('insulina U-100 em UI e GLP-1 semanal em mg/semana; sem concentração crua nem "comprimido" em líquido', () => {
    const base = fixture()
    const insulin = med({ id: 'm_ins', name: 'Lantus', presentation: 'injetavel', dosage_unit: 'ui/ml', units_per_ml: 100 })
    const glp1 = med({ id: 'm_weg', name: 'Wegovy', presentation: 'injetavel', dosage_unit: 'mg/ml', dosage_per_pill: 3.2, concentration_volume_ml: 0.75 })
    const html = renderReportHtml(
      buildReportModel(
        {
          ...base,
          medicines: [...base.medicines, insulin, glp1],
          protocols: [
            ...base.protocols,
            proto({ id: 'p_ins', medicine_id: 'm_ins', time_schedule: ['22:00'], intake_unit: 'UI', dosage_per_intake: 10 }),
            proto({ id: 'p_weg', medicine_id: 'm_weg', frequency: 'semanal', time_schedule: ['09:00'], intake_unit: 'mg', dosage_per_intake: 2.4 }),
          ],
        },
        { generatedAt: GEN }
      )
    )
    const text = visibleText(html)
    expect(text).toContain('10 UI')
    expect(text).toContain('2,4 mg/semana')
    expect(text).not.toMatch(/\bui\/ml\b|\bmg\/ml\b/i)
    const start = text.indexOf('Lantus')
    const insulinRow = text.slice(start, text.indexOf('Glifage', start))
    expect(insulinRow).not.toMatch(/comprimido/i)
    expect(insulinRow).toMatch(/injetável/)
  })
})

describe('renderReportHtml — 7 dias com registro só no fim (smoke 097 B, 2026-10-04)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  function row(): string {
    const base = fixture()
    const html = renderReportHtml(
      buildReportModel(
        {
          ...base,
          protocols: base.protocols.filter((p) => p.id === 'p_met'),
          doseDays: base.doseDays.filter((d) => d.protocol_id === 'p_met' && d.day >= '2026-09-29'),
          biomarkers: [],
          titrationSteps: [],
        },
        { generatedAt: GEN }
      )
    )
    return html.match(/<div class="irow side"[\s\S]*?<\/div><\/div><\/div>/)?.[0] ?? ''
  }

  it('faixa com os 7 dias do período, esticando para preencher a linha (sem teto de largura)', () => {
    const r = row()
    expect(r.match(/<div class="strip">([\s\S]*?)<\/div>/)?.[1].match(/class="c /g)).toHaveLength(7)
    expect(r).toContain('<div class="sbox">')
    expect(r).not.toContain('max-width')
  })

  it('escala de datas do 1º ao último dia do período', () => {
    expect(row()).toContain('<div class="ticks num"><span>24/09</span><span>27/09</span><span>30/09</span></div>')
  })
})

// ── Slice C: §3.7 Medidas + cruzamento, §3.8 Locais (PO-7, PO-8, PO-10, PO-11) ─────────────────
describe('renderReportHtml — medidas e locais de aplicação (097 C)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  const at = (d: string, t: string) => `2026-09-${d}T${t}:00-03:00`
  const clinical = (over = {}) =>
    model({
      titrationSteps: LADDER_STEPS,
      biomarkers: [
        { id: 'g1', type: 'glicemia', value: 95, value_secondary: null, unit: 'mg/dL', measured_at: at('24', '07:00'), context: 'jejum' },
        { id: 'g2', type: 'glicemia', value: 180, value_secondary: null, unit: 'mg/dL', measured_at: at('25', '13:30'), context: 'pos_refeicao' },
        { id: 'g3', type: 'glicemia', value: 140, value_secondary: null, unit: 'mg/dL', measured_at: at('26', '22:30'), context: 'ao_deitar' },
        { id: 'pa', type: 'pressao_arterial', value: 128, value_secondary: 82, unit: 'mmHg', measured_at: at('25', '08:00'), context: 'em_repouso' },
        { id: 'w1', type: 'peso', value: 82.4, value_secondary: null, unit: 'kg', measured_at: at('27', '07:00'), context: null },
      ],
      medicineLogs: [
        { id: 'l1', protocol_id: 'p_moun', medicine_id: 'm_moun', taken_at: at('25', '09:00'), injection_site: 'abdomen_e' },
        { id: 'l2', protocol_id: null, medicine_id: 'm_moun', taken_at: at('26', '09:00'), injection_site: null },
      ],
      ...over,
    })

  it('ordem: encerrados → Medidas → Locais de aplicação → Estoque', () => {
    const html = renderReportHtml(clinical())
    const order = ['Tratamentos encerrados no período', '<h2>Medidas</h2>', '<h2>Locais de aplicação</h2>', '<h2>Estoque']
    const positions = order.map((t) => html.indexOf(t))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('glicemia com 3 medidas: gráfico + tabela por momento; cruzamento por período do dia; PA e peso em lista', () => {
    const text = visibleText(renderReportHtml(clinical()))
    expect(renderReportHtml(clinical())).toContain('aria-label="Glicemia no período"')
    expect(text).toContain('Doses e medidas por período do dia')
    expect(text).toMatch(/Manhã \d+ Glicemia: 95 mg\/dL · 1 medida/)
    expect(text).toContain('128×82 mmHg')
    expect(text).toContain('27/09 07:00 82,4 kg')
    expect(renderReportHtml(clinical())).toContain('<th>Data</th><th>Peso</th>')
    // uma medida só no recorte: valor, sem mediana/faixa (smoke C)
    expect(text).toContain('Pressão arterial: 128×82 mmHg · 1 medida')
    expect(text).not.toContain('mediana 128×82')
  })

  it('PO-8: sem medidas, nem título nem cruzamento; o resto do documento é igual', () => {
    const without = renderReportHtml(clinical({ biomarkers: [] }))
    expect(without).not.toContain('<h2>Medidas</h2>')
    expect(without).not.toContain('Doses e medidas por período do dia')
    expect(without).toContain('<h2>Locais de aplicação</h2>')
  })

  it('PO-10: mapa com ≥ 1 local e denominador junto; 0 com local não tem cartão (D-C3); sem local sem seção', () => {
    const html = renderReportHtml(clinical())
    expect(visibleText(html)).toMatch(/Mounjaro · [^<]+ local informado em 1 de 2 aplicações/)
    expect(html).toContain('class="bodymap"')
    expect(visibleText(html)).toContain('Abdômen (esquerdo): 1')

    const none = renderReportHtml(
      clinical({ medicineLogs: [{ id: 'l2', protocol_id: null, medicine_id: 'm_moun', taken_at: at('26', '09:00'), injection_site: null }] })
    )
    expect(none).not.toContain('Locais de aplicação')

    expect(renderReportHtml(clinical({ medicineLogs: [] }))).not.toContain('Locais de aplicação')
  })

  it('PO-7/PO-11: nenhum termo de recomendação, juízo ou rodízio no texto com as seções clínicas', () => {
    const text = visibleText(renderReportHtml(clinical())).replaceAll('não é avaliação clínica nem recomendação', '')
    expect(text).not.toMatch(
      /\b(meta|alvo|ideal|ajust\w*|recomend\w*|risco|atenção|excelente|crítico|cuidado|evite|aplique|próximo|sobrecarreg\w*|rodízio|normal|bom|ruim|controlad\w*)\b/i
    )
  })

  it('nome hostil do medicamento no cartão e no aria-label sai escapado', () => {
    const html = renderReportHtml(
      clinical({ medicines: [...fixture().medicines.filter((m) => m.id !== 'm_moun'), med({ id: 'm_moun', name: HOSTILE[2], presentation: 'injetavel' })] })
    )
    // Valores de atributo (já escapados) saem da varredura: só atributo REAL conta.
    const tags = html.replace(/"[^"]*"/g, '""')
    expect(tags).not.toMatch(/<svg onload/i)
    expect(tags).not.toMatch(/<[a-z][^>]*\son\w+=/i)
    expect(html).toContain('aria-label="Locais de aplicação de &quot;&gt;&lt;svg onload=alert(1)&gt;"')
  })
})

describe('chartDateTicks — eixo de datas dos gráficos (smoke 097 C)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('30 dias: início, uma marca por semana e fim', () => {
    expect(chartDateTicks('2026-09-05', '2026-10-04')).toEqual(['2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26', '2026-10-04'])
  })

  it('90 dias: marcas a cada duas semanas; a colada no fim sai', () => {
    const t = chartDateTicks('2026-07-07', '2026-10-04')
    expect(t[0]).toBe('2026-07-07')
    expect(t[1]).toBe('2026-07-21')
    expect(t[t.length - 1]).toBe('2026-10-04')
    expect(t).toHaveLength(7)
  })

  it('7 dias e dia único', () => {
    expect(chartDateTicks('2026-09-24', '2026-09-30')).toEqual(['2026-09-24', '2026-09-26', '2026-09-28', '2026-09-30'])
    expect(chartDateTicks('2026-09-30', '2026-09-30')).toEqual(['2026-09-30'])
  })
})
