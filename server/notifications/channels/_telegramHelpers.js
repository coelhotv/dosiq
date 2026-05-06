import { supabase } from '../../services/supabase.js'
import { escapeMarkdownV2 } from '../../utils/formatters.js'
import {
  formatDoseGroupedByPlanMessage,
  formatDoseGroupedMiscMessage,
} from '../../bot/utils/doseFormatters.js'

export async function getTelegramChatId(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('telegram_chat_id')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('[telegramChannel.getTelegramChatId]', { userId, error: error.message })
    return null
  }

  return data?.telegram_chat_id || null
}

export function formatMessage(payload) {
  const { metadata } = payload

  if (payload.kind === 'dose_reminder_by_plan' && metadata?.doses) {
    return formatDoseGroupedByPlanMessage(
      metadata.planName,
      metadata.doses,
      metadata.scheduledTime,
      metadata.hour,
    )
  }

  if (payload.kind === 'dose_reminder_misc' && metadata?.doses) {
    return formatDoseGroupedMiscMessage(
      metadata.doses,
      metadata.scheduledTime,
      metadata.hour,
    )
  }

  const title = escapeMarkdownV2(payload.title)
  const body = payload.body
  return `*${title}*\n${body}`
}

export function inferTelegramKind(payload) {
  if (payload.metadata?.kind) return payload.metadata.kind
  if (payload.deeplink?.includes('plan=')) return 'dose_reminder_by_plan'
  if (payload.deeplink?.includes('misc=1')) return 'dose_reminder_misc'
  return 'dose_reminder'
}

export function buildTelegramReplyMarkup(kind, payload) {
  if (kind === 'dose_reminder_by_plan' && payload.metadata?.planId) {
    const planIdShort = String(payload.metadata.planId).slice(0, 8)
    const hhmm = payload.metadata.scheduledTime ?? '00:00'
    return {
      inline_keyboard: [[
        { text: '✅ Registrar este plano', callback_data: `takeplan:${planIdShort}:${hhmm}` },
        { text: '📋 Detalhes', callback_data: `details:plan:${planIdShort}` },
      ]]
    }
  } else if (kind === 'dose_reminder_misc' && payload.metadata?.protocolIds?.length) {
    const hhmm = payload.metadata.scheduledTime ?? '00:00'
    return {
      inline_keyboard: [[
        { text: '✅ Registrar todos', callback_data: `takelist:misc:${hhmm}` },
        { text: '📋 Detalhes', callback_data: `details:misc:${hhmm}` },
      ]]
    }
  } else if (payload.metadata?.protocolId) {
    const { protocolId, dosage } = payload.metadata
    return {
      inline_keyboard: [[
        { text: '✅ Tomar', callback_data: `take_:${protocolId}:${dosage ?? 1}` },
        { text: '⏰ Adiar', callback_data: `snooze_:${protocolId}` },
        { text: '⏭️ Pular', callback_data: `skip_:${protocolId}` }
      ]]
    }
  }

  return undefined
}
