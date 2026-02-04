/**
 * Titration Service
 * 
 * Serviço responsável por cálculos de etapas de titulação,
 * incluindo determinação de status, datas e dias restantes.
 * 
 * @module titrationService
 */

/**
 * Estrutura de uma etapa de titulação
 * @typedef {Object} TitrationStage
 * @property {number} duration_days - Duração da etapa em dias
 * @property {number} dosage - Dose por horário (suporta decimais)
 * @property {string} description - Descrição/objetivo da etapa
 */

/**
 * Estrutura de etapa calculada com status
 * @typedef {Object} CalculatedStep
 * @property {number} stepNumber - Número da etapa (1-indexed)
 * @property {number} dose - Dose da etapa
 * @property {string} unit - Unidade da dose (mg, ml, etc)
 * @property {number} durationDays - Duração em dias
 * @property {'completed'|'current'|'future'} status - Status da etapa
 * @property {Date|null} startDate - Data de início da etapa
 * @property {Date|null} endDate - Data de fim da etapa
 * @property {string} description - Descrição da etapa
 */

/**
 * Calcula todas as etapas de titulação com seus status e datas
 * 
 * @param {Object} protocol - Protocolo com dados de titulação
 * @param {Array<TitrationStage>} protocol.titration_schedule - Cronograma de titulação
 * @param {number} [protocol.current_stage_index] - Índice da etapa atual
 * @param {string} [protocol.stage_started_at] - Data de início da etapa atual (ISO)
 * @param {string} [protocol.start_date] - Data de início do protocolo (ISO)
 * @param {Object} [protocol.medicine] - Dados do medicamento
 * @param {string} [protocol.medicine.dosage_unit] - Unidade de dosagem (mg, ml)
 * @returns {Object} Objeto com etapas calculadas e informações adicionais
 */
export function calculateTitrationSteps(protocol) {
  if (!protocol?.titration_schedule?.length) {
    return {
      steps: [],
      currentStep: 0,
      totalSteps: 0,
      daysUntilNext: 0,
      progressPercent: 0
    }
  }

  const schedule = protocol.titration_schedule
  const currentStageIndex = protocol.current_stage_index ?? 0
  const stageStartedAt = protocol.stage_started_at 
    ? new Date(protocol.stage_started_at) 
    : new Date()
  const protocolStartDate = protocol.start_date 
    ? new Date(protocol.start_date) 
    : stageStartedAt
  
  const unit = protocol.medicine?.dosage_unit || 'mg'
  
  // Calcular datas de cada etapa
  let currentDate = new Date(protocolStartDate)
  const steps = schedule.map((stage, index) => {
    const stepNumber = index + 1
    const durationDays = parseInt(stage.duration_days) || 7
    const startDate = new Date(currentDate)
    const endDate = new Date(currentDate)
    endDate.setDate(endDate.getDate() + durationDays - 1)
    
    // Determinar status
    let status
    if (index < currentStageIndex) {
      status = 'completed'
    } else if (index === currentStageIndex) {
      status = 'current'
    } else {
      status = 'future'
    }
    
    // Avançar data para próxima etapa
    currentDate = new Date(endDate)
    currentDate.setDate(currentDate.getDate() + 1)
    
    return {
      stepNumber,
      dose: parseFloat(stage.dosage) || 0,
      unit,
      durationDays,
      status,
      startDate,
      endDate,
      description: stage.description || `Etapa ${stepNumber}`
    }
  })
  
  // Calcular dias restantes para próxima etapa
  const daysUntilNext = getDaysUntilNextStep(currentStageIndex, steps, stageStartedAt)
  
  // Calcular progresso geral
  const progressPercent = calculateOverallProgress(currentStageIndex, schedule, stageStartedAt)
  
  return {
    steps,
    currentStep: currentStageIndex + 1,
    totalSteps: schedule.length,
    daysUntilNext,
    progressPercent,
    currentStageStartDate: stageStartedAt,
    estimatedEndDate: steps[steps.length - 1]?.endDate || null
  }
}

/**
 * Calcula dias restantes até a próxima etapa
 * 
 * @param {number} currentStageIndex - Índice da etapa atual
 * @param {Array<CalculatedStep>} steps - Etapas calculadas
 * @param {Date} stageStartedAt - Data de início da etapa atual
 * @returns {number} Dias restantes (0 se for última etapa)
 */
export function getDaysUntilNextStep(currentStageIndex, steps, stageStartedAt) {
  // Se for a última etapa, retorna 0
  if (currentStageIndex >= steps.length - 1) {
    return 0
  }
  
  const currentStep = steps[currentStageIndex]
  if (!currentStep) return 0
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const endDate = new Date(currentStep.endDate)
  endDate.setHours(0, 0, 0, 0)
  
  // Calcular diferença em dias
  const diffTime = endDate - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return Math.max(0, diffDays)
}

/**
 * Calcula progresso percentual da etapa atual
 * 
 * @param {number} currentStageIndex - Índice da etapa atual
 * @param {Array<CalculatedStep>} steps - Etapas calculadas
 * @param {Date} stageStartedAt - Data de início da etapa atual
 * @returns {number} Percentual de progresso (0-100)
 */
export function getStepProgress(currentStageIndex, steps, stageStartedAt) {
  const currentStep = steps[currentStageIndex]
  if (!currentStep) return 0
  
  const today = new Date()
  const startDate = new Date(currentStep.startDate)
  const endDate = new Date(currentStep.endDate)
  
  // Se ainda não começou
  if (today < startDate) return 0
  
  // Se já terminou
  if (today > endDate) return 100
  
  // Calcular progresso atual
  const totalDuration = currentStep.durationDays
  const elapsedDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1
  
  return Math.min(100, Math.round((elapsedDays / totalDuration) * 100))
}

/**
 * Calcula progresso geral do protocolo de titulação
 * 
 * @param {number} currentStageIndex - Índice da etapa atual
 * @param {Array<TitrationStage>} schedule - Cronograma de titulação
 * @param {Date} stageStartedAt - Data de início da etapa atual
 * @returns {number} Percentual de progresso geral (0-100)
 */
function calculateOverallProgress(currentStageIndex, schedule, stageStartedAt) {
  if (!schedule?.length) return 0
  
  const totalDays = schedule.reduce((sum, stage) => sum + (parseInt(stage.duration_days) || 0), 0)
  
  // Dias completados em etapas anteriores
  let completedDays = 0
  for (let i = 0; i < currentStageIndex && i < schedule.length; i++) {
    completedDays += parseInt(schedule[i].duration_days) || 0
  }
  
  // Dias na etapa atual
  if (currentStageIndex < schedule.length) {
    const currentStageDuration = parseInt(schedule[currentStageIndex].duration_days) || 1
    const today = new Date()
    const startDate = new Date(stageStartedAt)
    const elapsedDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1
    completedDays += Math.max(0, Math.min(elapsedDays, currentStageDuration))
  }
  
  return Math.min(100, Math.round((completedDays / totalDays) * 100))
}

/**
 * Formata uma dose para exibição
 * 
 * @param {number} dose - Valor da dose
 * @param {string} unit - Unidade (mg, ml, etc)
 * @param {number} [dosagePerPill] - Dosagem por comprimido (para cálculo de mg)
 * @returns {string} String formatada da dose
 */
export function formatDose(dose, unit, dosagePerPill) {
  // Se temos dosagePerPill, calcular mg totais
  if (dosagePerPill && unit === 'mg') {
    const totalMg = dose * dosagePerPill
    return `${totalMg}${unit} (${dose} comp.)`
  }
  
  const unitLabel = dose === 1 ? unit : `${unit}`
  return `${dose} ${unitLabel}`
}

/**
 * Formata dias restantes para exibição amigável
 * 
 * @param {number} days - Dias restantes
 * @returns {string} String formatada
 */
export function formatDaysRemaining(days) {
  if (days === 0) return 'Última etapa'
  if (days === 1) return '1 dia restante'
  return `${days} dias restantes`
}

/**
 * Verifica se o protocolo está em titulação ativa
 * 
 * @param {Object} protocol - Protocolo a verificar
 * @returns {boolean} true se está titulando
 */
export function isTitrationActive(protocol) {
  return protocol?.titration_status === 'titulando' && 
         protocol?.titration_schedule?.length > 0
}

/**
 * Verifica se o protocolo atingiu o alvo
 * 
 * @param {Object} protocol - Protocolo a verificar
 * @returns {boolean} true se atingiu o alvo
 */
export function hasReachedTarget(protocol) {
  return protocol?.titration_status === 'alvo_atingido'
}

/**
 * Obtém informações resumidas da titulação para exibição
 * 
 * @param {Object} protocol - Protocolo com dados de titulação
 * @returns {Object|null} Informações resumidas ou null se não houver titulação
 */
export function getTitrationSummary(protocol) {
  if (!isTitrationActive(protocol) && !hasReachedTarget(protocol)) {
    return null
  }
  
  const calculation = calculateTitrationSteps(protocol)
  
  const currentStepData = calculation.steps.find(s => s.status === 'current')
  
  return {
    currentStep: calculation.currentStep,
    totalSteps: calculation.totalSteps,
    daysUntilNext: calculation.daysUntilNext,
    progressPercent: calculation.progressPercent,
    currentDose: currentStepData?.dose || protocol.dosage_per_intake,
    currentDescription: currentStepData?.description || '',
    isComplete: hasReachedTarget(protocol),
    estimatedEndDate: calculation.estimatedEndDate
  }
}