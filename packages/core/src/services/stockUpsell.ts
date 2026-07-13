// stockUpsell.ts — Elegibilidade do card de upsell de estoque (spec 044, FR-008 / T018).
//
// Derivado 100% CLIENT-SIDE a partir de dados que a tela já tem (R-090: nenhum cron, nenhuma
// função serverless nova). Função PURA: quem busca os dados é a plataforma; aqui só se decide.
//
// Gatilho (spec §Assumptions — parametrizável, não é regra de dado):
//   20 doses registradas  OU  14 dias consecutivos de uso.
// "OU" porque os dois medem a mesma coisa por ângulos diferentes: quem toma 4 doses/dia chega
// em 20 doses numa semana; quem toma 1 dia sim/dia não demora, mas a constância aparece no
// streak. Qualquer um dos dois já é "momento de valor" o bastante para um nudge.
//
// ⚠️ Datas: as entradas são dias LOCAIS ('YYYY-MM-DD', já convertidos pelo chamador).
// Nunca derivar dia com toISOString() (AP-270) — em GMT-3 isso joga a dose da noite pro dia
// seguinte e infla/quebra o streak.

/** Constantes do gatilho — expostas para a UI e para os testes (spec §Assumptions). */
export const UPSELL_MIN_DOSES = 20
export const UPSELL_MIN_STREAK_DAYS = 14

/**
 * Janela de observação. É REGRA, não detalhe de fetch: sem ela o gatilho depende de QUANTO
 * cada plataforma já tinha em mãos (a web carrega ~1 ano de logs para o streak; o mobile, 30
 * dias) e o mesmo usuário ficaria elegível numa e não na outra — e "20 doses" viraria "20
 * doses na vida" na web. O recorte mora aqui para que as duas plataformas façam a MESMA
 * pergunta, independentemente do que passem.
 */
export const UPSELL_LOOKBACK_DAYS = 30

export interface StockUpsellCriteria {
  minDoses?: number
  minStreakDays?: number
  lookbackDays?: number
}

export interface StockUpsellEvaluation {
  eligible: boolean
  /** Total de doses registradas consideradas. */
  doses: number
  /** Dias consecutivos com pelo menos uma dose, terminando hoje ou ontem. */
  streakDays: number
}

const MS_DAY = 24 * 60 * 60 * 1000

/** 'YYYY-MM-DD' → ms em UTC ao MEIO-DIA (imune a DST: a diferença entre dois meios-dias é sempre múltipla de 24h). */
function dayToMs(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12)
}

/** Distância em dias entre dois dias locais 'YYYY-MM-DD' (a - b). */
function dayDistance(a: string, b: string): number {
  return Math.round((dayToMs(a) - dayToMs(b)) / MS_DAY)
}

/**
 * Dia anterior a um dia local 'YYYY-MM-DD' — aritmética de CALENDÁRIO, sem instanciar `Date`
 * (R-020: `new Date()` aqui seria um instante, e instante + fuso é justamente a fonte do bug
 * de dia-anterior em GMT-3). Só contas sobre ano/mês/dia; o resultado nunca vira timestamp.
 */
function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const daysInMonth = (year: number, month: number): number =>
    [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]

  let py = y
  let pm = m
  let pd = d - 1
  if (pd === 0) {
    pm = m - 1
    if (pm === 0) {
      pm = 12
      py = y - 1
    }
    pd = daysInMonth(py, pm)
  }
  return `${py}-${String(pm).padStart(2, '0')}-${String(pd).padStart(2, '0')}`
}

/**
 * Maior sequência de dias consecutivos com dose, ANCORADA no presente: uma sequência que
 * terminou há um mês não é sinal de uso constante hoje. Aceita terminar ontem (o usuário ainda
 * não registrou a dose de hoje quando abre o app de manhã).
 *
 * @param loggedDays - dias locais com ao menos uma dose ('YYYY-MM-DD'), em qualquer ordem
 * @param todayLocal - dia local de hoje ('YYYY-MM-DD')
 */
export function computeDoseStreakDays(loggedDays: string[], todayLocal: string): number {
  const days = new Set((loggedDays ?? []).filter(Boolean))
  if (days.size === 0) return 0

  // Âncora: hoje se já registrou hoje; senão ontem. Nada nos dois → streak quebrado.
  const anchor = days.has(todayLocal)
    ? todayLocal
    : [...days].find((day) => dayDistance(todayLocal, day) === 1)
  if (!anchor) return 0

  let streak = 0
  let cursor = anchor
  while (days.has(cursor)) {
    streak += 1
    cursor = previousDay(cursor)
  }
  return streak
}

/**
 * Decide se o card de upsell pode aparecer. NÃO considera dismiss nem a preferência de estoque —
 * essas duas portas são da UI (dismiss é local e persistente; o card só existe em dose-only).
 *
 * @param loggedDays - um item POR DOSE registrada, com o dia local da dose (repetições contam
 *                     para `doses` e colapsam para o streak)
 * @param todayLocal - dia local de hoje ('YYYY-MM-DD')
 */
export function evaluateStockUpsell(
  loggedDays: string[],
  todayLocal: string,
  criteria: StockUpsellCriteria = {},
): StockUpsellEvaluation {
  const minDoses = criteria.minDoses ?? UPSELL_MIN_DOSES
  const minStreakDays = criteria.minStreakDays ?? UPSELL_MIN_STREAK_DAYS
  const lookbackDays = criteria.lookbackDays ?? UPSELL_LOOKBACK_DAYS

  // Recorte na REGRA: o chamador pode passar a janela que tiver (a web tem ~1 ano de logs
  // carregados para o streak) — o gatilho enxerga sempre os mesmos N dias.
  const days = (loggedDays ?? []).filter(Boolean).filter((day) => {
    const age = dayDistance(todayLocal, day)
    return Number.isFinite(age) && age >= 0 && age < lookbackDays
  })
  const doses = days.length
  const streakDays = computeDoseStreakDays(days, todayLocal)

  return {
    doses,
    streakDays,
    eligible: doses >= minDoses || streakDays >= minStreakDays,
  }
}
