import { Expo } from 'expo-server-sdk'
import { dispatchNotification } from '../../notifications/dispatcher/dispatchNotification.js'
import { notificationPreferenceRepository } from '../../notifications/repositories/notificationPreferenceRepository.js'
import { notificationLogRepository } from '../../notifications/repositories/notificationLogRepository.js'
import { notificationDeviceRepository } from '../../notifications/repositories/notificationDeviceRepository.js'

let dispatcherInstance = null
let expoClient = null

/**
 * Factory para obter a instância configurada do NotificationDispatcher.
 * Injeta automaticamente dependências (bot, expoClient, repositories).
 * 
 * @param {object} bot - Instância do bot Telegram
 * @returns {object} Objeto com método dispatch()
 */
export function getNotificationDispatcher(bot) {
  if (!dispatcherInstance) {
    // Inicializa Expo client apenas se necessário
    if (!expoClient) {
      expoClient = new Expo()
    }

    const repositories = {
      preferences: notificationPreferenceRepository,
      log: notificationLogRepository,
      devices: notificationDeviceRepository
    }

    dispatcherInstance = {
      /**
       * Dispara uma notificação centralizada
       * @param {object} params - Parâmetros da notificação (userId, kind, payload, context)
       */
      dispatch: async (params) => {
        return dispatchNotification({
          ...params,
          bot,
          expoClient,
          repositories,
          // Canais padrão se não especificado
          channels: params.channels || ['telegram', 'mobile_push']
        })
      }
    }
  }
  return dispatcherInstance
}
