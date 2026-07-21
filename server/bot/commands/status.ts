import { attachFullLadders } from '@dosiq/core';
import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { formatProtocol } from '../../utils/formatters.js';

export async function handleStatus(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    const userId = await getUserIdByChatId(chatId);

    // 029 F6 (R-267 read-path): o `formatProtocol` passou a derivar a linha de titulação de
    // `titration_steps`; sem a escada ela seria `undefined` e sumiria em silêncio — trocar a
    // coluna N1 pela N2 sem tocar na busca "consertaria" o 42703 e manteria exatamente a perda
    // de informação que o repontamento existe para evitar.
    // R-295: colunas conferidas no banco 2026-07-21; selects executados contra o PostgREST.
    const { data: protocols, error } = await supabase
      .from('protocols')
      .select('*, medicine:medicines(*)')
      .eq('user_id', userId)
      .eq('active', true);

    if (error) throw error;

    if (!protocols || protocols.length === 0) {
      return await bot.sendMessage(chatId, 'Você não possui protocolos ativos no momento\\.');
    }

    // 🔴 A escada vem por QUERY SEPARADA, nunca por embed `titration_steps(...)` pendurado no
    // select acima (RC6 #765). O embed resolve pela FK `titration_steps.protocol_id`, que só
    // marca o executor VIGENTE: a maioria das etapas não o carrega, então o recorte quase nunca
    // inclui a etapa `current` — o bot omitiria a linha de titulação, ou pior, numeraria
    // "Etapa 1/1" sobre uma escada de 4. É o AP-311, que web e mobile corrigem neste mesmo PR;
    // o bot não pode ser a superfície que o reintroduz. `attachFullLadders` (core) é a mesma
    // derivação usada pelas outras duas.
    const { data: steps, error: stepsError } = await supabase
      .from('titration_steps')
      .select('id, titration_id, protocol_id, position, dose, duration_days, status, started_at')
      .eq('user_id', userId)
      .order('position', { ascending: true });

    // Best-effort (R-245): o /status é sobre os tratamentos; falhar a escada não pode derrubar
    // a resposta inteira. Mas não some em silêncio — sem log, a linha de titulação
    // simplesmente não aparece e ninguém sabe por quê.
    if (stepsError) console.error('Escada de titulação indisponível no /status:', stepsError);

    const { protocols: withLadders, orphanTitrationIds } = attachFullLadders(
      protocols,
      stepsError ? [] : steps,
    );
    for (const titrationId of orphanTitrationIds) {
      console.error(
        `Titulação órfã ${titrationId}: nenhuma etapa carrega protocol_id — o /status fica sem a linha de evolução (AP-311)`,
      );
    }

    let message = '📋 *Seus Protocolos Ativos:*\n\n';
    withLadders.forEach(p => {
      message += formatProtocol(p) + '\n';
    });

    await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
  } catch (err) {
    console.error('Erro ao buscar protocolos:', err);
    await bot.sendMessage(chatId, 'Erro ao buscar seus dados\\.');
  }
}
