import { supabase, getUserId } from '@shared/utils/supabase'
import { validateEmergencyCard } from '@schemas/emergencyCardSchema'

/**
 * Emergency Card Service - Gerenciamento do cartão de emergência
 *
 * ESTRATÉGIA OFFLINE-FIRST:
 * - Primário: localStorage (chave: mr_emergency_card)
 * - Secundário: Supabase user_settings.emergency_card (JSONB)
 *
 * WRITE-THROUGH:
 * 1. Validar com schema Zod
 * 2. Salvar no localStorage
 * 3. Salvar no Supabase (se online)
 *
 * READ:
 * 1. Tentar localStorage primeiro
 * 2. Fallback para Supabase se localStorage vazio
 */

const STORAGE_KEY = 'mr_emergency_card'

/**
 * Log estruturado para o serviço de cartão de emergência
 * @param {string} level - Nível do log ('info', 'warn', 'error', 'debug')
 * @param {string} message - Mensagem do log
 * @param {Object} data - Dados adicionais para contexto
 */
function log(level, message, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    service: 'emergencyCardService',
    level,
    message,
    ...data,
  }

  // Em produção, isso seria enviado para um serviço de logging
  if (process.env.NODE_ENV === 'development' || level === 'error') {
    console.log(JSON.stringify(logEntry))
  }
}

/**
 * Verifica se o localStorage deve ser ignorado (ambiente de teste)
 * @returns {boolean} True se deve ignorar localStorage
 */
function shouldSkipLocalStorage() {
  return process.env.NODE_ENV === 'test'
}

/**
 * Salva dados no localStorage
 * @param {Object} data - Dados do cartão de emergência
 */
function saveToLocalStorage(data) {
  if (shouldSkipLocalStorage()) {
    log('debug', 'localStorage ignorado em ambiente de teste')
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    log('info', 'Dados salvos no localStorage')
  } catch (error) {
    log('error', 'Erro ao salvar no localStorage', { error: error.message })
  }
}

/**
 * Recupera dados do localStorage
 * @returns {Object|null} Dados do cartão ou null se vazio/erro
 */
function getFromLocalStorage() {
  if (shouldSkipLocalStorage()) {
    log('debug', 'localStorage ignorado em ambiente de teste')
    return null
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      log('info', 'Dados recuperados do localStorage')
      return JSON.parse(stored)
    }
  } catch (error) {
    log('error', 'Erro ao ler localStorage', { error: error.message })
  }

  return null
}

/**
 * Mapeia dados do schema para formato do Supabase
 * @param {Object} data - Dados validados do cartão
 * @returns {Object} Dados formatados para Supabase
 */
function _mapToSupabase(data) {
  return {
    emergency_contacts: data.emergency_contacts,
    allergies: data.allergies,
    blood_type: data.blood_type,
    notes: data.notes || null,
    last_updated: data.last_updated || new Date().toISOString(),
  }
}

/**
 * Mapeia dados do Supabase para formato do schema
 * @param {Object} row - Registro do Supabase
 * @returns {Object|null} Dados formatados ou null se vazio
 */
function _mapFromSupabase(row) {
  if (!row || !row.emergency_card) {
    return null
  }

  const card = row.emergency_card

  return {
    emergency_contacts: card.emergency_contacts || [],
    allergies: card.allergies || [],
    blood_type: card.blood_type || 'desconhecido',
    notes: card.notes || null,
    last_updated: card.last_updated || new Date().toISOString(),
  }
}

/**
 * Salva o cartão de emergência no Supabase
 * @param {Object} data - Dados validados do cartão
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function saveToSupabase(data) {
  try {
    const userId = await getUserId()
    const emergencyCard = _mapToSupabase(data)

    // Usa upsert para criar ou atualizar
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          emergency_card: emergencyCard,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )

    if (error) {
      // Se a coluna não existir, loga aviso mas não falha
      if (error.message?.includes('column') || error.code === 'PGRST204') {
        log('warn', 'Coluna emergency_card não existe na tabela user_settings', {
          error: error.message,
        })
        return { success: true, warning: 'Dados salvos apenas localmente' }
      }

      log('error', 'Erro ao salvar no Supabase', { error: error.message })
      return { success: false, error: error.message }
    }

    log('info', 'Dados salvos no Supabase')
    return { success: true }
  } catch (error) {
    log('error', 'Exceção ao salvar no Supabase', { error: error.message })
    return { success: false, error: error.message }
  }
}

/**
 * Recupera o cartão de emergência do Supabase
 * @returns {Promise<Object|null>} Dados do cartão ou null
 */
async function getFromSupabase() {
  try {
    const userId = await getUserId()

    const { data, error } = await supabase
      .from('user_settings')
      .select('emergency_card')
      .eq('user_id', userId)
      .single()

    if (error) {
      // Se não encontrou registro, retorna null
      if (error.code === 'PGRST116') {
        log('info', 'Nenhum registro encontrado no Supabase')
        return null
      }

      log('error', 'Erro ao buscar no Supabase', { error: error.message })
      return null
    }

    log('info', 'Dados recuperados do Supabase')
    return _mapFromSupabase(data)
  } catch (error) {
    log('error', 'Exceção ao buscar no Supabase', { error: error.message })
    return null
  }
}

export const emergencyCardService = {
  /**
   * Salva o cartão de emergência com estratégia write-through
   *
   * Fluxo:
   * 1. Valida dados com schema Zod
   * 2. Salva no localStorage (síncrono)
   * 3. Salva no Supabase (assíncrono, se online)
   *
   * @param {Object} data - Dados do cartão de emergência
   * @returns {Promise<{success: boolean, data?: Object, errors?: Array<{field: string, message: string}>, warning?: string}>}
   */
  async save(data) {
    log('info', 'Iniciando salvamento do cartão de emergência')

    // 1. Validar com schema Zod
    const validation = validateEmergencyCard(data)

    if (!validation.success) {
      log('warn', 'Validação falhou', { errors: validation.errors })
      return { success: false, errors: validation.errors }
    }

    // Adiciona timestamp de atualização
    const dataToSave = {
      ...validation.data,
      last_updated: new Date().toISOString(),
    }

    // 2. Salvar no localStorage (síncrono)
    saveToLocalStorage(dataToSave)

    // 3. Salvar no Supabase (assíncrono)
    const supabaseResult = await saveToSupabase(dataToSave)

    if (!supabaseResult.success) {
      // Dados estão salvos localmente, mas falhou no Supabase
      log('warn', 'Salvo localmente, mas falhou no Supabase', {
        error: supabaseResult.error,
      })
      return {
        success: true,
        data: dataToSave,
        warning: 'Dados salvos localmente. Sincronização com nuvem falhou.',
      }
    }

    log('info', 'Cartão de emergência salvo com sucesso')
    return {
      success: true,
      data: dataToSave,
      warning: supabaseResult.warning,
    }
  },

  /**
   * Carrega o cartão de emergência com estratégia offline-first
   *
   * Fluxo:
   * 1. Tenta localStorage primeiro
   * 2. Fallback para Supabase se localStorage vazio
   *
   * @returns {Promise<{success: boolean, data?: Object, source?: 'local' | 'supabase'}>}
   */
  async load() {
    log('info', 'Carregando cartão de emergência')

    // 1. Tentar localStorage primeiro
    const localData = getFromLocalStorage()

    if (localData) {
      log('info', 'Dados carregados do localStorage')
      return { success: true, data: localData, source: 'local' }
    }

    // 2. Fallback para Supabase
    const supabaseData = await getFromSupabase()

    if (supabaseData) {
      // Salva no localStorage para próximas consultas
      saveToLocalStorage(supabaseData)
      log('info', 'Dados carregados do Supabase e salvos localmente')
      return { success: true, data: supabaseData, source: 'supabase' }
    }

    // Nenhum dado encontrado
    log('info', 'Nenhum cartão de emergência encontrado')
    return { success: true, data: null }
  },

  /**
   * Recupera o cartão de emergência APENAS do localStorage (síncrono)
   *
   * Use esta função quando precisar dos dados offline sem chamadas assíncronas.
   * Ideal para exibição em telas de emergência onde a velocidade é crítica.
   *
   * @returns {Object|null} Dados do cartão ou null se vazio
   */
  getOfflineCard() {
    log('info', 'Recuperando cartão offline (síncrono)')
    return getFromLocalStorage()
  },

  /**
   * Limpa o cartão de emergência do localStorage
   * (Não remove do Supabase - apenas limpa cache local)
   */
  clearLocalCache() {
    if (shouldSkipLocalStorage()) {
      return
    }

    try {
      localStorage.removeItem(STORAGE_KEY)
      log('info', 'Cache local limpo')
    } catch (error) {
      log('error', 'Erro ao limpar cache local', { error: error.message })
    }
  },
}

export default emergencyCardService
