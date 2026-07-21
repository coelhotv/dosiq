// Testes dos formatadores do export LGPD (spec 008 — PO-1/PO-2/PO-4).
//
// A fixture é a MESMA para web e mobile: quem consome o core consome estas seções.
// Paridade de inventário é verificada aqui, não prometida nas duas telas.

import { describe, it, expect } from 'vitest'
import {
  buildExportCSV,
  buildExportJSON,
  escapeCSVField,
  generateExportFilename,
  sanitizeCSVValue,
  STOCK_NOT_TRACKED_LABEL,
  STOCK_NO_DATA_LABEL,
  type ExportBundle,
  type ExportScope,
} from '../exportFormatters'

const FULL_SCOPE: ExportScope = {
  includeProfile: true,
  includeProtocols: true,
  includeLogs: true,
  includeStock: true,
  includeMedicines: true,
  includeBiomarkers: true,
}

const MEDICINE = {
  id: 'med-1',
  name: 'Mounjaro',
  laboratory: 'Lilly',
  active_ingredient: 'tirzepatida',
  type: 'injetavel',
  dosage_per_pill: 5,
  dosage_unit: 'mg',
  therapeutic_class: 'GLP-1',
  regulatory_category: 'Tarja Vermelha',
  presentation: 'liquido',
  units_per_ml: 4,
  concentration_volume_ml: 2.4,
  shelf_life_days: 30,
  price_paid: 1200,
  created_at: '2026-07-01T10:00:00-03:00',
  stock: [
    {
      id: 'stk-1',
      quantity: 3,
      original_quantity: 4,
      entry_type: 'purchase',
      purchase_date: '2026-07-01',
      expiration_date: '2027-01-31',
      opened_at: '2026-07-02',
      injection_container: 'caneta',
      unit_price: 300,
      notes: null,
      created_at: '2026-07-01T10:00:00-03:00',
    },
  ],
  purchases: [
    {
      id: 'pur-1',
      quantity_bought: 4,
      unit_price: 300,
      purchase_date: '2026-07-01',
      expiration_date: '2027-01-31',
      injection_container: 'caneta',
      pharmacy: 'Droga Raia',
      laboratory: 'Lilly',
      notes: null,
      created_at: '2026-07-01T10:00:00-03:00',
    },
  ],
}

const BUNDLE: ExportBundle = {
  subject: { userId: 'user-1', email: 'maria@example.com' },
  exportedAt: '2026-07-13T09:30:00-03:00',
  dateRange: null,
  stockTracked: true,
  profile: {
    display_name: 'Maria',
    birth_date: '1970-05-02',
    city: 'São Paulo',
    state: 'SP',
    phone: '11999999999',
    timezone: 'America/Sao_Paulo',
    telegram_chat_id: '12345',
    emergency_card: { blood_type: 'O+' },
    stock_tracking_enabled: true,
    // Segredo: NUNCA pode sair no bundle (allowlist do repositório).
    verification_token: 'segredo-nao-deve-vazar',
  },
  medicines: [MEDICINE],
  protocols: [
    {
      id: 'prot-1',
      medicine_id: 'med-1',
      medicine: { name: 'Mounjaro' },
      treatment_plan: { name: 'Emagrecimento' },
      treatment_plan_id: 'plan-1',
      name: 'Titulação Mounjaro',
      dosage_per_intake: 1,
      intake_unit: 'ml',
      target_dosage: 10,
      frequency: 'semanal',
      time_schedule: ['08:00'],
      weekdays: ['seg'],
      start_date: '2026-07-01',
      end_date: null,
      active: true,
      paused_at: null,
      critical_alarm: false,
      notes: null,
      created_at: '2026-07-01T10:00:00-03:00',
    },
  ],
  // 029 F6 — escada N2. Deliberadamente CROSS-MEDICAMENTO (as etapas 0 e 1 têm `medicine_id`
  // diferente, como a escada real de GLP-1 em prod): é o caso em que derivar o medicamento do
  // tratamento entregaria o remédio de hoje para a etapa de ontem (R-299). E fora de ordem,
  // para provar que o mapper ordena por `position` em vez de confiar na ordem do banco.
  titrations: [
    {
      id: 'tit-1',
      treatment_plan_id: 'plan-1',
      created_at: '2026-07-01T10:00:00-03:00',
      steps: [
        {
          id: 'step-2',
          position: 1,
          medicine_id: 'med-2',
          medicine: { name: 'Mounjaro 5mg' },
          dose: 5,
          intake_unit: 'mg',
          // Etapa CONTÍNUA (manutenção): duração NULL é válida e não é dado faltando.
          duration_days: null,
          status: 'current',
          protocol_id: 'prot-1',
          started_at: '2026-07-15T10:00:00-03:00',
          ended_at: null,
        },
        {
          id: 'step-1',
          position: 0,
          medicine_id: 'med-1',
          medicine: { name: 'Mounjaro 2,5mg' },
          dose: 2.5,
          intake_unit: 'mg',
          duration_days: 14,
          status: 'completed',
          // NULL é normal: `protocol_id` só marca o executor vigente (AP-311).
          protocol_id: null,
          started_at: '2026-07-01T10:00:00-03:00',
          ended_at: '2026-07-15T10:00:00-03:00',
        },
      ],
    },
  ],
  logs: [
    {
      id: 'log-1',
      medicine_id: 'med-1',
      medicine: { name: 'Mounjaro' },
      protocol_id: 'prot-1',
      quantity_taken: 1,
      injection_site: 'abdomen_esquerdo',
      taken_at: '2026-07-08T08:05:00-03:00',
      notes: null,
      dose_instance_id: 'di-1',
    },
  ],
  stock: [MEDICINE],
  biomarkers: [
    {
      id: 'bio-1',
      type: 'pressao_arterial',
      value: 120,
      value_secondary: 80,
      unit: 'mmHg',
      measured_at: '2026-07-10T07:00:00-03:00',
      context: 'jejum',
      source: 'manual',
      notes: null,
      created_at: '2026-07-10T07:01:00-03:00',
    },
  ],
}

const parseJSON = (bundle: ExportBundle, scope: ExportScope = FULL_SCOPE) =>
  JSON.parse(buildExportJSON(bundle, scope))

describe('sanitização CSV (anti formula-injection)', () => {
  it.each(['=SUM(A1)', '+1', '-1', '@cmd'])('prefixa tab em %s', (value) => {
    expect(sanitizeCSVValue(value)).toBe('\t' + value)
  })

  it('escapa separador, aspas e quebra de linha', () => {
    expect(escapeCSVField('a;b')).toBe('"a;b"')
    expect(escapeCSVField('diz "oi"')).toBe('"diz ""oi"""')
    expect(escapeCSVField('linha1\nlinha2')).toBe('"linha1\nlinha2"')
  })

  it('nulo vira string vazia', () => {
    expect(escapeCSVField(null)).toBe('')
    expect(escapeCSVField(undefined)).toBe('')
  })
})

describe('buildExportJSON — inventário (FR-006/FR-010)', () => {
  it('traz todas as seções do escopo completo', () => {
    const out = parseJSON(BUNDLE)
    expect(Object.keys(out.data).sort()).toEqual([
      'biomarkers',
      'logs',
      'medicines',
      'profile',
      'protocols',
      'stock',
      // 029 F6: seção nova — a escada saiu das colunas do tratamento e virou entidade.
      'titrations',
    ])
  })

  it('biomarcadores incluem value_secondary (PA) — FR-006', () => {
    const [bio] = parseJSON(BUNDLE).data.biomarkers
    expect(bio).toMatchObject({ type: 'pressao_arterial', value: 120, value_secondary: 80, unit: 'mmHg' })
  })

  it('medicamentos trazem as colunas do 012 e as colunas reais do schema', () => {
    const [med] = parseJSON(BUNDLE).data.medicines
    expect(med).toMatchObject({
      dosage_per_pill: 5,
      dosage_unit: 'mg',
      presentation: 'liquido',
      units_per_ml: 4,
      concentration_volume_ml: 2.4,
      shelf_life_days: 30,
    })
  })

  it('tratamentos trazem time_schedule e a dose alvo', () => {
    const [prot] = parseJSON(BUNDLE).data.protocols
    expect(prot).toMatchObject({
      time_schedule: ['08:00'],
      intake_unit: 'ml',
      target_dosage: 10,
    })
  })

  // 029 F6 — as 4 colunas N1 saíram do tratamento e a titulação virou seção própria. Sem estes
  // dois testes, o DROP tiraria a escada do export de portabilidade em silêncio: `select('*')`
  // não quebra, os campos só viram `null` (LGPD art. 18 — dado de saúde do titular).
  it('tratamento NÃO carrega mais as colunas de titulação N1 (dropadas)', () => {
    const [prot] = parseJSON(BUNDLE).data.protocols
    expect(prot).not.toHaveProperty('titration_status')
    expect(prot).not.toHaveProperty('titration_schedule')
    expect(prot).not.toHaveProperty('current_stage_index')
    expect(prot).not.toHaveProperty('stage_started_at')
  })

  it('escada sai em seção própria, ordenada por position e com o medicamento DE CADA etapa', () => {
    const [tit] = parseJSON(BUNDLE).data.titrations
    expect(tit).toMatchObject({ id: 'tit-1', treatment_plan_id: 'plan-1' })
    // Ordenado por `position`, não pela ordem em que o banco devolveu (fixture está invertida).
    expect(tit.steps.map((s: { position: number }) => s.position)).toEqual([0, 1])
    // 🔴 R-299: cada etapa carrega o SEU medicamento. Derivar do tratamento faria a etapa
    // concluída em julho exibir o medicamento vigente hoje — o passado mudando sozinho.
    expect(tit.steps[0]).toMatchObject({ medicine_id: 'med-1', medicine_name: 'Mounjaro 2,5mg', dose: 2.5 })
    expect(tit.steps[1]).toMatchObject({ medicine_id: 'med-2', medicine_name: 'Mounjaro 5mg', dose: 5 })
    // Etapa contínua: `duration_days` NULL preservado como null (não vira 0 nem some).
    expect(tit.steps[1].duration_days).toBeNull()
  })

  it('CSV ganha a seção de escadas, uma linha por etapa', () => {
    const csv = buildExportCSV(BUNDLE, FULL_SCOPE)
    expect(csv).toContain('=== ESCADAS DE TITULAÇÃO ===')
    expect(csv).toContain('ID da Escada')
    expect(csv).toContain('Mounjaro 2,5mg')
    expect(csv).toContain('Mounjaro 5mg')
  })

  it('perfil sai sem segredos (verification_token nunca no bundle)', () => {
    const raw = buildExportJSON(BUNDLE, FULL_SCOPE)
    expect(raw).not.toContain('verification_token')
    expect(raw).not.toContain('segredo-nao-deve-vazar')
    expect(parseJSON(BUNDLE).data.profile).toMatchObject({ display_name: 'Maria', timezone: 'America/Sao_Paulo' })
  })

  it('metadata identifica o titular e o escopo pedido (FR-012)', () => {
    const { metadata } = parseJSON(BUNDLE)
    expect(metadata).toMatchObject({
      userId: 'user-1',
      email: 'maria@example.com',
      version: '1.0.0',
      scope: FULL_SCOPE,
    })
  })

  it('período entra no metadata em data local (nunca UTC)', () => {
    const out = parseJSON({
      ...BUNDLE,
      dateRange: { start: new Date(2026, 6, 1), end: new Date(2026, 6, 31) },
    })
    expect(out.metadata.dateRange).toEqual({ start: '2026-07-01', end: '2026-07-31' })
  })

  it('período aceita uma borda só (De sem Até, e vice-versa)', () => {
    const soDe = parseJSON({ ...BUNDLE, dateRange: { start: new Date(2026, 6, 1), end: null } })
    expect(soDe.metadata.dateRange).toEqual({ start: '2026-07-01', end: null })

    const soAte = parseJSON({ ...BUNDLE, dateRange: { start: null, end: new Date(2026, 6, 31) } })
    expect(soAte.metadata.dateRange).toEqual({ start: null, end: '2026-07-31' })
  })

  it('seção desmarcada não aparece (seletividade — US2)', () => {
    const out = parseJSON(BUNDLE, { ...FULL_SCOPE, includeLogs: false, includeBiomarkers: false })
    expect(out.data.logs).toBeUndefined()
    expect(out.data.biomarkers).toBeUndefined()
    expect(out.data.medicines).toBeDefined()
  })

  it('046 Slice D: controle desligado NÃO esconde os lotes congelados — dado do titular sai', () => {
    // stockTracked=false (controle off) mas HÁ lotes/compras congelados (044 congela, não apaga).
    // O export tem que trazer os dados; `control_enabled: false` é só metadado.
    const out = parseJSON({ ...BUNDLE, stockTracked: false })
    const stock = out.data.stock as { control_enabled: boolean; medicines: unknown[]; note?: string }
    expect(stock.control_enabled).toBe(false)
    expect(stock.medicines.length).toBeGreaterThan(0)
    expect(stock.note).toBeUndefined()
  })

  it('046 Slice D: sem NENHUM lote/compra → seção honesta "sem dados", nunca omitida', () => {
    const out = parseJSON({ ...BUNDLE, stockTracked: false, stock: [] })
    const stock = out.data.stock as { control_enabled: boolean; medicines: unknown[]; note?: string }
    expect(stock.medicines).toEqual([])
    expect(stock.note).toBe(STOCK_NO_DATA_LABEL)
  })
})

describe('buildExportCSV — seções e sanitização', () => {
  it('abre com BOM UTF-8 e cabeçalho de metadados com titular e escopo', () => {
    const csv = buildExportCSV(BUNDLE, FULL_SCOPE)
    expect(csv.startsWith('﻿=== METADADOS ===')).toBe(true)
    expect(csv).toContain('ID do Usuário;user-1')
    expect(csv).toContain('E-mail;maria@example.com')
    expect(csv).toContain('Período;Todos os dados')
  })

  it('cabeçalho descreve período aberto de um lado', () => {
    const soDe = buildExportCSV({ ...BUNDLE, dateRange: { start: new Date(2026, 6, 1), end: null } }, FULL_SCOPE)
    expect(soDe).toContain('Período;A partir de 01/07/2026')

    const soAte = buildExportCSV({ ...BUNDLE, dateRange: { start: null, end: new Date(2026, 6, 31) } }, FULL_SCOPE)
    expect(soAte).toContain('Período;Até 31/07/2026')

    const ambos = buildExportCSV(
      { ...BUNDLE, dateRange: { start: new Date(2026, 6, 1), end: new Date(2026, 6, 31) } },
      FULL_SCOPE,
    )
    expect(ambos).toContain('Período;01/07/2026 a 31/07/2026')
  })

  it('traz todas as seções do inventário', () => {
    const csv = buildExportCSV(BUNDLE, FULL_SCOPE)
    for (const section of [
      '=== PERFIL E CONFIGURAÇÕES ===',
      '=== MEDICAMENTOS ===',
      '=== TRATAMENTOS ===',
      '=== REGISTROS DE DOSE ===',
      '=== ESTOQUE ===',
      '=== COMPRAS ===',
      '=== MEDIDAS ===',
    ]) {
      expect(csv).toContain(section)
    }
  })

  it('escopo sai em português no cabeçalho (não a chave de código)', () => {
    const csv = buildExportCSV(BUNDLE, { ...FULL_SCOPE, includeStock: false })
    expect(csv).toContain(
      'Escopo Selecionado;Perfil e configurações, Medicamentos, Tratamentos, Registros de dose, Medidas e biomarcadores',
    )
    expect(csv).not.toContain('includeProfile')
  })

  it('preço usa vírgula decimal (pt-BR), coerente com o vazio "0,00"', () => {
    const csv = buildExportCSV(BUNDLE, FULL_SCOPE)
    expect(csv).toContain('300,00')
    expect(csv).not.toContain('300.00')
  })

  it('medidas trazem valor secundário da PA', () => {
    const csv = buildExportCSV(BUNDLE, FULL_SCOPE)
    expect(csv).toContain('Valor Secundário')
    expect(csv).toContain('bio-1;pressao_arterial;120;80;mmHg')
  })

  it('perfil sai como campo/valor, sem segredo', () => {
    const csv = buildExportCSV(BUNDLE, FULL_SCOPE)
    expect(csv).toContain('display_name;Maria')
    expect(csv).not.toContain('segredo-nao-deve-vazar')
  })

  it('046 Slice D: controle off marca o metadado, mas as COMPRAS/lotes congelados saem', () => {
    const csv = buildExportCSV({ ...BUNDLE, stockTracked: false }, FULL_SCOPE)
    // A linha de metadado aparece, mas os dados reais NÃO são suprimidos.
    expect(csv).toContain(STOCK_NOT_TRACKED_LABEL)
    expect(csv).toContain('=== COMPRAS ===')
  })

  it('046 Slice D: sem nenhum lote/compra → nota honesta, seção nunca omitida', () => {
    const csv = buildExportCSV({ ...BUNDLE, stockTracked: false, stock: [] }, FULL_SCOPE)
    expect(csv).toContain('=== ESTOQUE ===')
    expect(csv).toContain(STOCK_NO_DATA_LABEL)
  })

  it('seção sem linhas mantém o cabeçalho (tabela vazia, não seção ausente)', () => {
    const csv = buildExportCSV({ ...BUNDLE, biomarkers: [] }, FULL_SCOPE)
    expect(csv).toContain('=== MEDIDAS ===\nID;Tipo;Valor;Valor Secundário')
  })

  it('valor com fórmula é neutralizado dentro da tabela', () => {
    const csv = buildExportCSV(
      { ...BUNDLE, logs: [{ ...(BUNDLE.logs as Record<string, unknown>[])[0], notes: '=cmd|calc' }] },
      FULL_SCOPE,
    )
    expect(csv).toContain('\t=cmd|calc')
  })
})

describe('generateExportFilename', () => {
  it('usa data e hora locais', () => {
    expect(generateExportFilename('dosiq_export', 'json', new Date(2026, 6, 13, 9, 5))).toBe(
      'dosiq_export_20260713_0905.json',
    )
  })
})
