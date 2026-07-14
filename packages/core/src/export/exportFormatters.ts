// exportFormatters.ts — Formatadores puros do export LGPD (spec 008, padrão 037).
//
// Hoisted do exportService web: JSON, CSV, sanitização anti formula-injection e o
// INVENTÁRIO das seções. Puro por construção — não busca dado, não escreve arquivo.
// Cada plataforma injeta o bundle já buscado e cuida da entrega:
//   - web:    Blob + <a download>
//   - mobile: FileSystem.cacheDirectory + Sharing.shareAsync
//
// LGPD: o inventário é fiel ao schema (FR-006/FR-010). Coluna nova em tabela exportada
// entra aqui — ver plans/specs/008-complete-data-export-lgpd/AUDIT_FR-010.md (local-only).

import { formatLocalDate, parseISO, parseLocalDate } from '../utils/dateUtils'

/** Versão do formato de exportação. */
export const EXPORT_VERSION = '1.0.0'

/** Texto único da seção de estoque quando o usuário é dose-only (044 / US3). */
export const STOCK_NOT_TRACKED_LABEL = 'Estoque: não controlado'

/** BOM UTF-8 para compatibilidade com Excel. */
export const UTF8_BOM = '\uFEFF'

/**
 * Período de filtro — afeta SOMENTE os registros de dose (paridade web↔mobile).
 * Cada borda é independente: "de 01/07 em diante" e "até 31/07" são filtros válidos.
 */
export interface ExportDateRange {
  start: Date | null
  end: Date | null
}

/** Escopo selecionado pelo usuário (checkboxes). Vai no metadata como prova (FR-012). */
export interface ExportScope {
  includeProfile: boolean
  includeProtocols: boolean
  includeLogs: boolean
  includeStock: boolean
  includeMedicines: boolean
  includeBiomarkers: boolean
}

/** Identificação do titular no bundle (FR-012 — prova de atendimento ao art. 18). */
export interface ExportSubject {
  userId: string | null
  email: string | null
}

/** Linha genérica vinda do Supabase. */
type Row = Record<string, unknown>

/**
 * Dados já buscados pela plataforma. Cada campo é `null` quando o checkbox
 * correspondente está desmarcado — a seção então não aparece no bundle.
 */
export interface ExportBundle {
  subject: ExportSubject
  exportedAt: string
  dateRange: ExportDateRange | null
  /** `false` = usuário dose-only (044): estoque vira 1 linha, não lista vazia de lotes. */
  stockTracked: boolean
  profile: Row | null
  medicines: Row[] | null
  protocols: Row[] | null
  logs: Row[] | null
  /** Medicamentos com `stock`/`purchases` aninhados (mesma lista de `medicines`). */
  stock: Row[] | null
  biomarkers: Row[] | null
}

// ─────────────────────────────── primitivas CSV ───────────────────────────────

/**
 * Sanitiza valor para prevenir injeção de fórmulas em CSV: prefixa `=`, `+`, `-`, `@`
 * com tabulação (o Excel deixa de avaliar a célula como fórmula).
 */
export function sanitizeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return ''

  const strValue = String(value)

  if (
    strValue.startsWith('=') ||
    strValue.startsWith('+') ||
    strValue.startsWith('-') ||
    strValue.startsWith('@')
  ) {
    return '\t' + strValue
  }

  return strValue
}

/** Escapa valor para CSV (separador `;`, aspas e quebras de linha). */
export function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return ''

  const strValue = sanitizeCSVValue(value)

  if (
    strValue.includes(';') ||
    strValue.includes('"') ||
    strValue.includes('\n') ||
    strValue.includes('\r')
  ) {
    return '"' + strValue.replace(/"/g, '""') + '"'
  }

  return strValue
}

/** Formata timestamp ISO para DD/MM/YYYY HH:MM (fuso LOCAL do usuário — Princípio IV). */
export function formatDateTime(dateStr: unknown): string {
  if (!dateStr || typeof dateStr !== 'string') return ''

  const date = parseISO(dateStr)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${day}/${month}/${year} ${hours}:${minutes}`
}

/** Formata data (YYYY-MM-DD ou ISO) para DD/MM/YYYY, sem escorregar de dia (R-020). */
export function formatDateOnly(dateStr: unknown): string {
  if (!dateStr || typeof dateStr !== 'string') return ''

  const date = parseLocalDate(dateStr.slice(0, 10))
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}

/** Configuração de coluna do CSV. */
export interface CSVHeader {
  key: string
  label: string
  transform?: (value: unknown, item: Row) => unknown
}

/** Converte array de objetos em CSV (cabeçalho sempre presente, mesmo sem linhas). */
export function arrayToCSV(data: Row[] | null | undefined, headers: CSVHeader[]): string {
  const headerLine = headers.map((h) => escapeCSVField(h.label)).join(';')

  if (!data || data.length === 0) return headerLine

  const dataLines = data.map((item) =>
    headers
      .map((h) => {
        const value = h.transform ? h.transform(item[h.key], item) : item[h.key]
        return escapeCSVField(value)
      })
      .join(';'),
  )

  return [headerLine, ...dataLines].join('\n')
}

/** Nome de arquivo com timestamp local: `dosiq_export_YYYYMMDD_HHMM.json`. */
export function generateExportFilename(prefix: string, extension: string, now: Date): string {
  const timestamp = formatLocalDate(now).replace(/-/g, '')
  const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
  return `${prefix}_${timestamp}_${time}.${extension}`
}

// ───────────────────────────────── inventário ─────────────────────────────────

const boolLabel = (val: unknown) => (val ? 'Sim' : 'Não')
const listLabel = (val: unknown) => (Array.isArray(val) ? val.join(', ') : '')
const priceLabel = (val: unknown) => (typeof val === 'number' ? val.toFixed(2) : '0,00')

/**
 * Perfil e configurações do titular (user_settings). Allowlist explícita: `verification_token`
 * fica FORA (segredo de vínculo, não é dado do titular) — ver AUDIT_FR-010.
 */
function mapProfile(profile: Row): Row {
  return {
    display_name: profile.display_name ?? null,
    birth_date: profile.birth_date ?? null,
    city: profile.city ?? null,
    state: profile.state ?? null,
    phone: profile.phone ?? null,
    timezone: profile.timezone ?? null,
    complexity_override: profile.complexity_override ?? null,
    onboarding_completed: profile.onboarding_completed ?? null,
    emergency_card: profile.emergency_card ?? null,
    telegram_chat_id: profile.telegram_chat_id ?? null,
    notification_preference: profile.notification_preference ?? null,
    notification_mode: profile.notification_mode ?? null,
    digest_time: profile.digest_time ?? null,
    quiet_hours_enabled: profile.quiet_hours_enabled ?? null,
    quiet_hours_start: profile.quiet_hours_start ?? null,
    quiet_hours_end: profile.quiet_hours_end ?? null,
    channel_mobile_push_enabled: profile.channel_mobile_push_enabled ?? null,
    channel_web_push_enabled: profile.channel_web_push_enabled ?? null,
    channel_telegram_enabled: profile.channel_telegram_enabled ?? null,
    stock_tracking_enabled: profile.stock_tracking_enabled ?? null,
    stock_paused_at: profile.stock_paused_at ?? null,
    created_at: profile.created_at ?? null,
    updated_at: profile.updated_at ?? null,
  }
}

function mapMedicine(m: Row): Row {
  return {
    id: m.id,
    name: m.name,
    laboratory: m.laboratory ?? null,
    active_ingredient: m.active_ingredient ?? null,
    type: m.type ?? null,
    dosage_per_pill: m.dosage_per_pill ?? null,
    dosage_unit: m.dosage_unit ?? null,
    therapeutic_class: m.therapeutic_class ?? null,
    regulatory_category: m.regulatory_category ?? null,
    // Colunas do 012 (líquidos/injetáveis) — FR-006.
    presentation: m.presentation ?? null,
    units_per_ml: m.units_per_ml ?? null,
    concentration_volume_ml: m.concentration_volume_ml ?? null,
    shelf_life_days: m.shelf_life_days ?? null,
    price_paid: m.price_paid ?? null,
    created_at: m.created_at ?? null,
  }
}

function mapProtocol(p: Row): Row {
  const medicine = p.medicine as Row | null | undefined
  const plan = p.treatment_plan as Row | null | undefined
  return {
    id: p.id,
    medicine_id: p.medicine_id,
    medicine_name: medicine?.name ?? null,
    treatment_plan_id: p.treatment_plan_id ?? null,
    treatment_plan_name: plan?.name ?? null,
    name: p.name ?? null,
    dosage_per_intake: p.dosage_per_intake ?? null,
    // Colunas do 012/029 — FR-006.
    intake_unit: p.intake_unit ?? null,
    target_dosage: p.target_dosage ?? null,
    titration_status: p.titration_status ?? null,
    titration_schedule: p.titration_schedule ?? null,
    current_stage_index: p.current_stage_index ?? null,
    stage_started_at: p.stage_started_at ?? null,
    frequency: p.frequency ?? null,
    time_schedule: p.time_schedule ?? null,
    weekdays: p.weekdays ?? null,
    start_date: p.start_date ?? null,
    end_date: p.end_date ?? null,
    active: p.active ?? null,
    paused_at: p.paused_at ?? null,
    critical_alarm: p.critical_alarm ?? null,
    notes: p.notes ?? null,
    created_at: p.created_at ?? null,
  }
}

function mapLog(l: Row): Row {
  const medicine = l.medicine as Row | null | undefined
  return {
    id: l.id,
    medicine_id: l.medicine_id,
    medicine_name: medicine?.name ?? null,
    protocol_id: l.protocol_id ?? null,
    quantity_taken: l.quantity_taken,
    injection_site: l.injection_site ?? null,
    taken_at: l.taken_at,
    notes: l.notes ?? null,
    dose_instance_id: l.dose_instance_id ?? null,
  }
}

function mapBiomarker(b: Row): Row {
  return {
    id: b.id,
    type: b.type,
    value: b.value,
    // PA sistólica/diastólica: sem value_secondary a medida fica pela metade (FR-006).
    value_secondary: b.value_secondary ?? null,
    unit: b.unit ?? null,
    measured_at: b.measured_at,
    context: b.context ?? null,
    source: b.source ?? null,
    notes: b.notes ?? null,
    created_at: b.created_at ?? null,
  }
}

function mapStockByMedicine(medicines: Row[]): Row[] {
  return medicines.map((m) => ({
    medicine_id: m.id,
    medicine_name: m.name,
    stock_entries: ((m.stock as Row[] | null) ?? []).map((s) => ({
      id: s.id,
      quantity: s.quantity,
      original_quantity: s.original_quantity ?? null,
      entry_type: s.entry_type ?? null,
      purchase_date: s.purchase_date ?? null,
      expiration_date: s.expiration_date ?? null,
      opened_at: s.opened_at ?? null,
      injection_container: s.injection_container ?? null,
      unit_price: s.unit_price ?? null,
      notes: s.notes ?? null,
      created_at: s.created_at ?? null,
    })),
    purchases: ((m.purchases as Row[] | null) ?? []).map((p) => ({
      id: p.id,
      quantity_bought: p.quantity_bought,
      unit_price: p.unit_price ?? null,
      purchase_date: p.purchase_date ?? null,
      expiration_date: p.expiration_date ?? null,
      injection_container: p.injection_container ?? null,
      pharmacy: p.pharmacy ?? null,
      laboratory: p.laboratory ?? null,
      notes: p.notes ?? null,
      created_at: p.created_at ?? null,
    })),
  }))
}

/** Achata lotes de estoque de todos os medicamentos numa tabela só (CSV). */
function flattenStock(medicines: Row[]): Row[] {
  return medicines.flatMap((m) =>
    ((m.stock as Row[] | null) ?? []).map((s) => ({ ...s, medicine_name: m.name })),
  )
}

/** Achata compras de todos os medicamentos numa tabela só (CSV). */
function flattenPurchases(medicines: Row[]): Row[] {
  return medicines.flatMap((m) =>
    ((m.purchases as Row[] | null) ?? []).map((p) => ({ ...p, medicine_name: m.name })),
  )
}

// ─────────────────────────────────── JSON ────────────────────────────────────

/**
 * Monta o bundle JSON (pretty-print 2 espaços). Seção ausente = checkbox desmarcado.
 */
export function buildExportJSON(bundle: ExportBundle, scope: ExportScope): string {
  const data: Record<string, unknown> = {}

  if (scope.includeProfile && bundle.profile) {
    data.profile = mapProfile(bundle.profile)
  }

  if (scope.includeMedicines && bundle.medicines) {
    data.medicines = bundle.medicines.map(mapMedicine)
  }

  if (scope.includeProtocols && bundle.protocols) {
    data.protocols = bundle.protocols.map(mapProtocol)
  }

  if (scope.includeLogs && bundle.logs) {
    data.logs = bundle.logs.map(mapLog)
  }

  if (scope.includeStock) {
    // 044/US3: dose-only exporta UMA linha, não uma lista vazia de lotes (lista vazia
    // sugeriria "acabou o estoque"; o correto é "não controlado").
    data.stock = bundle.stockTracked
      ? mapStockByMedicine(bundle.stock ?? [])
      : { tracked: false, note: STOCK_NOT_TRACKED_LABEL }
  }

  if (scope.includeBiomarkers && bundle.biomarkers) {
    data.biomarkers = bundle.biomarkers.map(mapBiomarker)
  }

  const exportData = {
    metadata: {
      exportDate: bundle.exportedAt,
      version: EXPORT_VERSION,
      // FR-012: identificação do titular + escopo pedido = prova de atendimento (art. 18).
      userId: bundle.subject.userId,
      email: bundle.subject.email,
      scope,
      dateRange: bundle.dateRange
        ? {
            start: bundle.dateRange.start ? formatLocalDate(bundle.dateRange.start) : null,
            end: bundle.dateRange.end ? formatLocalDate(bundle.dateRange.end) : null,
          }
        : null,
    },
    data,
  }

  return JSON.stringify(exportData, null, 2)
}

// ──────────────────────────────────── CSV ────────────────────────────────────

const PROFILE_HEADERS: CSVHeader[] = [
  { key: 'label', label: 'Campo' },
  { key: 'value', label: 'Valor' },
]

const MEDICINE_HEADERS: CSVHeader[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Nome do Medicamento' },
  { key: 'laboratory', label: 'Laboratório' },
  { key: 'active_ingredient', label: 'Princípio Ativo' },
  { key: 'type', label: 'Tipo' },
  { key: 'dosage_per_pill', label: 'Dosagem por Unidade' },
  { key: 'dosage_unit', label: 'Unidade' },
  { key: 'presentation', label: 'Apresentação' },
  { key: 'units_per_ml', label: 'Unidades por ml' },
  { key: 'concentration_volume_ml', label: 'Volume do Frasco (ml)' },
  { key: 'shelf_life_days', label: 'Validade após Abertura (dias)' },
  { key: 'therapeutic_class', label: 'Classe Terapêutica' },
  { key: 'regulatory_category', label: 'Categoria Regulatória' },
  { key: 'created_at', label: 'Data de Cadastro', transform: formatDateTime },
]

const PROTOCOL_HEADERS: CSVHeader[] = [
  { key: 'id', label: 'ID' },
  { key: 'medicine_name', label: 'Medicamento', transform: (_v, item) => (item.medicine as Row)?.name ?? '' },
  { key: 'name', label: 'Nome do Tratamento' },
  { key: 'dosage_per_intake', label: 'Dosagem por Tomada' },
  { key: 'intake_unit', label: 'Unidade da Tomada' },
  { key: 'target_dosage', label: 'Dose Alvo' },
  { key: 'titration_status', label: 'Titulação' },
  { key: 'frequency', label: 'Frequência' },
  { key: 'time_schedule', label: 'Horários', transform: listLabel },
  { key: 'weekdays', label: 'Dias da Semana', transform: listLabel },
  { key: 'start_date', label: 'Data de Início', transform: formatDateOnly },
  { key: 'end_date', label: 'Data de Término', transform: formatDateOnly },
  { key: 'active', label: 'Ativo', transform: boolLabel },
  { key: 'notes', label: 'Observações' },
  { key: 'created_at', label: 'Data de Criação', transform: formatDateTime },
]

const LOG_HEADERS: CSVHeader[] = [
  { key: 'id', label: 'ID' },
  { key: 'medicine_name', label: 'Medicamento', transform: (_v, item) => (item.medicine as Row)?.name ?? '' },
  { key: 'quantity_taken', label: 'Quantidade Tomada' },
  { key: 'injection_site', label: 'Local de Aplicação' },
  { key: 'taken_at', label: 'Data/Hora', transform: formatDateTime },
  { key: 'notes', label: 'Observações' },
]

const STOCK_HEADERS: CSVHeader[] = [
  { key: 'id', label: 'ID' },
  { key: 'medicine_name', label: 'Medicamento' },
  { key: 'quantity', label: 'Quantidade' },
  { key: 'entry_type', label: 'Tipo de Entrada' },
  { key: 'purchase_date', label: 'Data de Compra', transform: formatDateOnly },
  { key: 'expiration_date', label: 'Validade', transform: formatDateOnly },
  { key: 'opened_at', label: 'Aberto em', transform: formatDateOnly },
  { key: 'injection_container', label: 'Recipiente' },
  { key: 'unit_price', label: 'Preço Unitário (R$)', transform: priceLabel },
  { key: 'notes', label: 'Observações' },
  { key: 'created_at', label: 'Data de Registro', transform: formatDateTime },
]

const PURCHASE_HEADERS: CSVHeader[] = [
  { key: 'id', label: 'ID' },
  { key: 'medicine_name', label: 'Medicamento' },
  { key: 'quantity_bought', label: 'Quantidade Comprada' },
  { key: 'unit_price', label: 'Preço Unitário (R$)', transform: priceLabel },
  { key: 'purchase_date', label: 'Data de Compra', transform: formatDateOnly },
  { key: 'expiration_date', label: 'Validade', transform: formatDateOnly },
  { key: 'injection_container', label: 'Recipiente' },
  { key: 'pharmacy', label: 'Farmácia' },
  { key: 'laboratory', label: 'Laboratório' },
  { key: 'notes', label: 'Observações' },
]

const BIOMARKER_HEADERS: CSVHeader[] = [
  { key: 'id', label: 'ID' },
  { key: 'type', label: 'Tipo' },
  { key: 'value', label: 'Valor' },
  { key: 'value_secondary', label: 'Valor Secundário' },
  { key: 'unit', label: 'Unidade' },
  { key: 'measured_at', label: 'Data/Hora da Medida', transform: formatDateTime },
  { key: 'context', label: 'Contexto' },
  { key: 'source', label: 'Origem' },
  { key: 'notes', label: 'Observações' },
]

/**
 * Rótulo do período no cabeçalho do CSV. Cada borda é opcional: sem nenhuma, o export é
 * completo; com uma só, o filtro é aberto de um lado ("a partir de", "até").
 */
function describeDateRange(range: ExportDateRange | null): string {
  const start = range?.start ? formatDateOnly(formatLocalDate(range.start)) : null
  const end = range?.end ? formatDateOnly(formatLocalDate(range.end)) : null

  if (start && end) return `${start} a ${end}`
  if (start) return `A partir de ${start}`
  if (end) return `Até ${end}`
  return 'Todos os dados'
}

/** Perfil vira tabela campo/valor (uma linha só de dados seria ilegível em CSV). */
function profileToCSV(profile: Row): string {
  const mapped = mapProfile(profile)
  const rows: Row[] = Object.entries(mapped).map(([label, value]) => ({
    label,
    value: value !== null && typeof value === 'object' ? JSON.stringify(value) : value,
  }))
  return arrayToCSV(rows, PROFILE_HEADERS)
}

/**
 * Monta o bundle CSV (seções concatenadas, BOM UTF-8 para o Excel).
 */
export function buildExportCSV(bundle: ExportBundle, scope: ExportScope): string {
  const sections: string[] = []

  if (scope.includeProfile && bundle.profile) {
    sections.push('=== PERFIL E CONFIGURAÇÕES ===')
    sections.push(profileToCSV(bundle.profile))
    sections.push('')
  }

  if (scope.includeMedicines && bundle.medicines) {
    sections.push('=== MEDICAMENTOS ===')
    sections.push(arrayToCSV(bundle.medicines, MEDICINE_HEADERS))
    sections.push('')
  }

  if (scope.includeProtocols && bundle.protocols) {
    sections.push('=== TRATAMENTOS ===')
    sections.push(arrayToCSV(bundle.protocols, PROTOCOL_HEADERS))
    sections.push('')
  }

  if (scope.includeLogs && bundle.logs) {
    sections.push('=== REGISTROS DE DOSE ===')
    sections.push(arrayToCSV(bundle.logs, LOG_HEADERS))
    sections.push('')
  }

  if (scope.includeStock) {
    sections.push('=== ESTOQUE ===')
    if (bundle.stockTracked) {
      const medicines = bundle.stock ?? []
      sections.push(arrayToCSV(flattenStock(medicines), STOCK_HEADERS))
      sections.push('')
      sections.push('=== COMPRAS ===')
      sections.push(arrayToCSV(flattenPurchases(medicines), PURCHASE_HEADERS))
    } else {
      sections.push(STOCK_NOT_TRACKED_LABEL)
    }
    sections.push('')
  }

  if (scope.includeBiomarkers && bundle.biomarkers) {
    sections.push('=== MEDIDAS ===')
    sections.push(arrayToCSV(bundle.biomarkers, BIOMARKER_HEADERS))
    sections.push('')
  }

  const scopeLabel = Object.entries(scope)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ')

  const metadataSection = [
    '=== METADADOS ===',
    `Data de Exportação;${formatDateTime(bundle.exportedAt)}`,
    `Versão do Formato;${EXPORT_VERSION}`,
    // FR-012: titular + escopo no cabeçalho (prova de atendimento, art. 18).
    `ID do Usuário;${escapeCSVField(bundle.subject.userId)}`,
    `E-mail;${escapeCSVField(bundle.subject.email)}`,
    `Escopo Selecionado;${escapeCSVField(scopeLabel)}`,
    `Período;${describeDateRange(bundle.dateRange)}`,
    '',
  ]

  return UTF8_BOM + [...metadataSection, ...sections].join('\n')
}
