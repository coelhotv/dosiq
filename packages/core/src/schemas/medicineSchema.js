import { z } from 'zod'

/**
 * Schema de validação para Medicamentos
 * Baseado na tabela 'medicines' do Supabase
 */

// Unidades de CONCENTRAÇÃO válidas (alinhadas com MedicineForm.jsx dropdown).
// 'ml'/'gotas' saíram da lista (viram unidade de TOMADA em protocols.intake_unit — 022 Fase A).
// 'mg/ml'/'ui/ml' são razões massa/volume: líquido := dosage_unit LIKE '%/ml' (decisão-mãe).
// Ordem do dropdown: sólidos base → concentrações-ratio (/ml) → ui/un.
export const DOSAGE_UNITS = ['mg', 'mcg', 'g', 'mg/ml', 'ui/ml', 'ui', 'un']

// Labels de unidade para exibição (ordem espelha DOSAGE_UNITS)
export const DOSAGE_UNIT_LABELS = {
  mg: 'mg',
  mcg: 'mcg',
  g: 'g',
  'mg/ml': 'mg/ml',
  'ui/ml': 'UI/ml',
  ui: 'UI',
  un: 'un.',
}

// Tipos de medicamento
export const MEDICINE_TYPES = ['medicamento', 'suplemento']

// Labels de tipo para exibição
export const MEDICINE_TYPE_LABELS = {
  medicamento: 'Medicamento',
  suplemento: 'Suplemento',
}

// Forma farmacêutica (additiva — ADR-058; alinha MEDICINE_TYPES do produto).
// Sincronizada com CHECK medicines_presentation_check (R-082/R-271). Valores PT (R-021).
export const PRESENTATIONS = [
  'comprimido',
  'capsula',
  'liquido',
  'injetavel',
  'pomada',
  'spray',
  'outro',
]

export const PRESENTATION_LABELS = {
  comprimido: 'Comprimido',
  capsula: 'Cápsula',
  liquido: 'Líquido',
  injetavel: 'Injetável',
  pomada: 'Pomada',
  spray: 'Spray',
  outro: 'Outro',
}

// Apresentações compatíveis com unidade líquida (/ml). Injetável É líquido (GLP-1/
// insulina) e dirige TTL biológico + container — NÃO pode ser engolido por 'liquido'
// só porque a unidade é /ml. Usado pelos forms (web+mobile+wizard) p/ NÃO travar a
// seleção em 'liquido' quando o usuário escolheu 'injetavel'. (smoke PO 2026-06-12)
export const LIQUID_PRESENTATIONS = ['liquido', 'injetavel']

// 012 Fase B2 (FR-019): apresentação física do injetável comprado. Capturado na
// 1ª compra. Sincronizado com CHECK medicines_injection_container_check (R-271).
// NULL = não informado → rótulo "unidade". Só rótulo de UI; não afeta estoque.
// 'refil' = cartucho de caneta recarregável (comum em insulina), distinto da
// caneta pré-preenchida descartável ('caneta', comum em GLP-1).
export const INJECTION_CONTAINERS = ['caneta', 'refil', 'ampola', 'frasco_ampola', 'seringa_preenchida']

export const INJECTION_CONTAINER_LABELS = {
  caneta: 'Caneta (pré-preenchida)',
  refil: 'Refil (cartucho)',
  ampola: 'Ampola',
  frasco_ampola: 'Frasco-ampola',
  seringa_preenchida: 'Seringa preenchida',
}

// Rótulo singular p/ contagem de aplicações no estoque (FR-020). Fallback "unidade".
export const INJECTION_CONTAINER_SINGULAR = {
  caneta: 'caneta',
  refil: 'refil',
  ampola: 'ampola',
  frasco_ampola: 'frasco',
  seringa_preenchida: 'seringa',
}

export const REGULATORY_CATEGORIES = [
  'Genérico',
  'Similar',
  'Novo',
  'Biológico',
  'Específico',
  'Fitoterápico',
  'Dinamizado',
  'Outros',
]

export const REGULATORY_CATEGORY_LABELS = {
  Genérico: 'Genérico',
  Similar: 'Similar',
  Novo: 'Novo',
  Biológico: 'Biológico',
  Específico: 'Específico',
  Fitoterápico: 'Fitoterápico',
  Dinamizado: 'Dinamizado',
  Outros: 'Outros',
}

const _COMBINING_MARKS = /[\u0300-\u036f]/g
const _stripAccents = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(_COMBINING_MARKS, '')
    .trim()

/**
 * Normaliza a categoria regulatória vinda da base ANVISA (sem acento, dados sujos)
 * para o enum canônico acentuado de `REGULATORY_CATEGORIES`.
 *
 * Compara ignorando acentos/caixa. Valores fora do enum (ex.: "Gases Medicinais",
 * "Radiofarmaco") caem em 'Outros'. Vazio → null.
 *
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizeRegulatoryCategory(raw) {
  if (!raw) return null
  const normalized = _stripAccents(raw)
  const match = REGULATORY_CATEGORIES.find((c) => _stripAccents(c) === normalized)
  return match || 'Outros'
}

/**
 * Schema base para medicamento
 */
// Mensagens de erro friendly via z.config global (ver packages/core/src/zodSetup.js).
// Aqui mantemos apenas overrides específicos quando regra de negócio exige texto
// diferente do padrão (ex: "máx 200 caracteres" — informação útil, não jargão).

// Objeto base (ZodObject) — preserva .partial()/.extend(). O refine de líquido
// é aplicado SEPARADAMENTE em medicineSchema/medicineFullSchema (ZodEffects não
// expõe .partial()/.extend()).
const medicineObject = z.object({
  name: z
    .string()
    .min(2, 'O nome precisa de pelo menos 2 caracteres')
    .max(200, 'O nome pode ter no máximo 200 caracteres')
    .trim(),

  laboratory: z
    .string()
    .max(200, 'O laboratório pode ter no máximo 200 caracteres')
    .optional()
    .nullable()
    .transform((val) => val || null),

  active_ingredient: z
    .string()
    .max(300, 'O princípio ativo pode ter no máximo 300 caracteres')
    .optional()
    .nullable()
    .transform((val) => val || null),

  // Concentração (mg/cp p/ sólidos; mg ou UI por ml p/ líquidos). NULLABLE: líquidos
  // legados migrados (022 Fase A) têm dosage_per_pill NULL — massa ativa só exibida
  // quando o usuário preenche; decremento/adesão não dependem dela.
  // z.preprocess('' → null): forms web enviam '' ao limpar o campo; sem isso z.coerce
  // converteria '' → 0 e .positive() bloquearia a limpeza (review #651).
  dosage_per_pill: z.preprocess(
    (val) => (val === '' ? null : val),
    z.coerce
      .number()
      .positive('A dose deve ser maior que zero')
      .max(10000, 'A dose parece muito alta. Verifique o valor')
      .nullable()
      .optional()
  ),

  dosage_unit: z.enum(DOSAGE_UNITS),

  // Razão→ml genérica (ADR-058): gotas/ml=20, UI/ml=100. Obrigatória p/ líquidos
  // (validada no superRefine). NUMERIC (aceita fração). preprocess '' → null (idem dosage_per_pill).
  units_per_ml: z.preprocess(
    (val) => (val === '' ? null : val),
    z.coerce
      .number()
      .positive('Densidade (unidades por ml) deve ser maior que zero')
      .nullable()
      .optional()
  ),

  // 012 Fase B3 (FR-031, ADR-066): volume (mL) que o rótulo da concentração referencia.
  // NULL = "por 1 mL" (caso comum). Mounjaro = 0,5 (rótulo "2,5 mg/0,5 mL"). É o `volume`
  // do par (amount, volume) — seed do modelo de concentração futuro. dosage_per_pill segue
  // a razão normalizada mg/mL; o rótulo reexibe amount = dosage_per_pill × COALESCE(vol,1).
  // preprocess '' → null (idem units_per_ml/dosage_per_pill).
  concentration_volume_ml: z.preprocess(
    (val) => (val === '' ? null : val),
    z.coerce
      .number()
      .positive('Volume da concentração (mL) deve ser maior que zero')
      .nullable()
      .optional()
  ),

  // Forma farmacêutica (additiva — ADR-058). Default 'comprimido' espelha o DEFAULT do DB.
  presentation: z.enum(PRESENTATIONS).default('comprimido'),

  // 012 Fase A (ADR-059): TTL pós-abertura em dias (propriedade do produto;
  // distinto de expiration_date da caixa). NULL = eixo de validade biológica
  // inativo. Form prefill 28 quando presentation='injetavel' (vive na UI, não aqui).
  // Sincronizado com CHECK medicines_shelf_life_days_check (> 0) — R-082.
  // preprocess '' => null: campo numérico opcional limpo não pode virar 0 (R-270).
  shelf_life_days: z.preprocess(
    (val) => (val === '' || val === undefined ? null : val),
    z.coerce
      .number()
      .int('Validade após aberto deve ser um número inteiro de dias')
      .positive('Validade após aberto deve ser maior que zero')
      .nullable()
      .optional()
  ),

  // 012 Fase B4 (FR-030/ADR-068): injection_container saiu de `medicines` → mora no
  // LOTE (stock/purchases). A apresentação é atributo da compra, não do medicamento
  // (paciente pode trocar caneta↔refil entre lotes). Ver stockCreateSchema.

  type: z.enum(MEDICINE_TYPES).default('medicamento'),

  therapeutic_class: z
    .string()
    .max(100, 'A classe terapêutica pode ter no máximo 100 caracteres')
    .optional()
    .nullable()
    .transform((val) => val || null),

  regulatory_category: z
    .enum(REGULATORY_CATEGORIES)
    .optional()
    .nullable()
    .transform((val) => val || null),
})

// Densidade (units_per_ml) é OPCIONAL no medicamento (022 Fase C — revisão UX):
// não pertence ao cadastro do medicamento (impenetrável p/ leigo + prematuro). É
// capturada no tratamento quando intake_unit=gotas/UI e persistida aqui (física do
// produto). RPC consume_stock_fifo e doseToMl já fazem fallback p/ 20 quando null.
export const medicineSchema = medicineObject

/**
 * Schema para criação de medicamento (sem id)
 */
export const medicineCreateSchema = medicineSchema

/**
 * Schema para atualização de medicamento (campos opcionais).
 * Base no objeto (não no refined) — updates parciais não reavaliam o refine de líquido.
 *
 * ⚠️ CRÍTICO: `.partial()` NÃO remove os `.default()` no Zod v4 — um campo omitido com
 * default materializa o valor padrão no parse, e o `update()` o grava no DB. Sem o override
 * abaixo, um `update()` parcial qualquer (ex.: só `therapeutic_class`) reescreveria
 * `presentation='comprimido'` e `type='medicamento'`, FLIPANDO injetável→comprimido
 * (líquido→sólido) — corrupção clínica. Por isso `presentation`/`type` (os únicos campos com
 * `.default()`) viram optional sem default no path de atualização. Defaults só no create.
 */
export const medicineUpdateSchema = medicineObject.partial().extend({
  presentation: z.enum(PRESENTATIONS).optional(),
  type: z.enum(MEDICINE_TYPES).optional(),
})

/**
 * Schema completo com ID (para validação de dados do backend)
 */
export const medicineFullSchema = medicineObject.extend({
  id: z.string().uuid('ID do medicamento deve ser um UUID válido'),
  user_id: z.string().uuid('ID do usuário deve ser um UUID válido'),
  created_at: z.string().datetime({ offset: true }).optional(),
  updated_at: z.string().datetime({ offset: true }).optional(),
})

/**
 * Valida um objeto de medicamento
 * @param {Object} data - Dados do medicamento
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateMedicine(data) {
  const result = medicineSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors = result.error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }))

  return { success: false, errors }
}

/**
 * Valida dados para criação de medicamento
 * @param {Object} data - Dados do medicamento
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateMedicineCreate(data) {
  const result = medicineCreateSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors = result.error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }))

  return { success: false, errors }
}

/**
 * Valida dados para atualização de medicamento
 * @param {Object} data - Dados do medicamento
 * @returns {{ success: boolean, data?: Object, errors?: Array<{field: string, message: string}> }}
 */
export function validateMedicineUpdate(data) {
  const result = medicineUpdateSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors = result.error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }))

  return { success: false, errors }
}

/**
 * Converte erros do Zod para formato amigável para formulários
 * @param {Array} zodErrors - Array de erros do Zod
 * @returns {Object} Objeto com campo como chave e mensagem como valor
 */
export function mapMedicineErrorsToForm(zodErrors) {
  const formErrors = {}

  zodErrors.forEach((error) => {
    const field = error.path[0]
    if (!formErrors[field]) {
      formErrors[field] = error.message
    }
  })

  return formErrors
}

/**
 * Obtém mensagem de erro geral para exibição
 * @param {Array} errors - Array de erros
 * @returns {string} Mensagem formatada
 */
export function getMedicineErrorMessage(errors) {
  if (!errors || errors.length === 0) return ''

  if (errors.length === 1) {
    return errors[0].message
  }

  return `Existem ${errors.length} erros no formulário. Verifique os campos destacados.`
}

export default medicineSchema
