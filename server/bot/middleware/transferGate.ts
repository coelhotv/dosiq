// transferGate.ts — Modo "sem B" no bot do Telegram (spec 096 B2, C-1 decidido pelo PO em 2026-10-21).
//
// O Telegram é operador fora do Brasil. O lembrete já sai genérico pelo dispatcher (transferRedaction),
// mas os COMANDOS (/hoje, /estoque, /historico…) e os CALLBACKS dos botões ("Dose de *X* registrada")
// respondem com o nome do remédio por `bot.sendMessage`/`editMessageText`, fora do dispatcher. Sem a
// caixa B, essas respostas não podem sair — o bot responde um aviso neutro no lugar.
//
// Ponto único: o roteador do webhook (`api/telegram.ts`) consulta isto ANTES de qualquer handler.
// Fail-closed POR CHAT: erro de leitura ⇒ bloqueia (custa uma resposta, nunca um vazamento).
// Chat não vinculado ⇒ não bloqueia aqui: os handlers já respondem "conta não vinculada", sem dado.

import { supabase as defaultClient } from '../../services/supabase.js'
import { escapeMarkdownV2 } from '../../utils/formatters.js'

/** Comandos que não carregam dado de saúde e seguem livres: vincular a conta e ver a ajuda. */
export const TRANSFER_FREE_COMMANDS = Object.freeze(['/start', '/ajuda'])

export const TRANSFER_BLOCKED_TEXT = escapeMarkdownV2(
  '🔒 Os detalhes dos remédios só aparecem aqui com a autorização de envio para fora do Brasil. ' +
    'Para ligar: no app, Perfil › Privacidade e dados. Os lembretes continuam chegando, sem o nome do remédio.',
)

/** Alerta curto do callback (limite de 200 caracteres do `answerCallbackQuery`). */
export const TRANSFER_BLOCKED_ALERT =
  'Para usar os botões aqui, ligue a autorização de envio para fora do Brasil no app (Perfil › Privacidade e dados).'

/** O chat pertence a um titular SEM `international_transfer` vigente (ou não dá para saber)? */
export async function isChatTransferBlocked(chatId: string | number, client = defaultClient): Promise<boolean> {
  try {
    const { data, error } = await client
      .from('user_settings')
      .select('international_transfer_granted_at')
      .eq('telegram_chat_id', String(chatId))
      .maybeSingle()
    if (error) return true
    if (!data) return false // não vinculado: o handler responde "conta não vinculada"
    return !data.international_transfer_granted_at
  } catch {
    return true
  }
}

/** O texto é um comando livre (`/start CODIGO`, `/ajuda`)? */
export function isTransferFreeCommand(text: string): boolean {
  return TRANSFER_FREE_COMMANDS.some((cmd) => text === cmd || text.startsWith(`${cmd} `) || text.startsWith(`${cmd}@`))
}
