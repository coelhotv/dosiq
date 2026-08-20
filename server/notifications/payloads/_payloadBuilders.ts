import type { z } from 'zod';
import {
  dailyDigestDataSchema,
  adherenceReportDataSchema,
  weeklyAdherenceDataSchema,
  stockAlertDataSchema,
  stockExpiryAlertDataSchema,
  titrationAlertDataSchema,
  actionSchema,
  prescriptionAlertDataSchema,
  dlqDigestDataSchema,
  consentPruneNoticeDataSchema,
  doseReminderByPlanDataSchema,
  doseReminderMiscDataSchema
} from './_payloadSchemas.js';
import { escapeMarkdownV2 } from '../../utils/formatters.js';
import { getGreeting, getMotivationalNudge, getTimeOfDayGreeting } from '../../bot/utils/notificationHelpers.js';
import { getSaoPauloTime } from '../../utils/dateUtils.js';
import { formatDoseItem, formatDose, formatNumberPtBR } from '@dosiq/core';

interface NotificationPayload {
  title: string
  body: string
  pushBody: string
}

type DailyDigestMedicine = z.input<typeof dailyDigestDataSchema>['medicines'][number];

// 012 Fase D (FR-015b): frase de dose via formatters core (R-272). Líquido →
// unidade de tomada real (gotas/ml/UI + ≈ml), case canônico (UI upper). Sólido →
// hint de princípio ativo. Substitui o antigo formatDose local lossy ("1 un." p/
// mg/ml; lowercase). Sem dose válida → undefined (mantém guarda do call site).
const formatDigestDose = (m: DailyDigestMedicine): string | undefined => {
  if (m.dosagePerIntake === undefined || m.dosagePerIntake === null) return undefined;
  return formatDoseItem({
    dosagePerIntake: m.dosagePerIntake,
    intakeUnit: m.intakeUnit,
    dosageUnit: m.dosageUnit,
    dosagePerPill: m.dosagePerPill,
    unitsPerMl: m.unitsPerMl
  });
};

export function buildDailyDigestPayload(data: z.input<typeof dailyDigestDataSchema>): NotificationPayload {
  const { firstName, hour, pendingCount, medicines } = dailyDigestDataSchema.parse(data);
  const greeting = getGreeting(hour);
  const title = '📅 Resumo do Dia';
  const safeName = escapeMarkdownV2(firstName);
  
  let richMsg = `${greeting}, *${safeName}*\\!\n\n`;
  let plainMsg = `${greeting}, ${firstName}! `;
  
  if (pendingCount > 0) {
    const text = pendingCount === 1 ? 'dose pendente' : 'doses pendentes';
    richMsg += `Você tem *${pendingCount}* ${text} para hoje:\n\n`;
    plainMsg += `Você tem ${pendingCount} ${text} para hoje:\n`;
    
    medicines.forEach(m => {
      const displayDosage = formatDigestDose(m);
      richMsg += `💊 *${escapeMarkdownV2(m.name)}*\n`;
      richMsg += `⏰ ${escapeMarkdownV2(m.time)}${displayDosage ? ` \\(${escapeMarkdownV2(displayDosage)}\\)` : ''}\n\n`;
      plainMsg += `⏰ ${m.name} — ${m.time}${displayDosage ? ` (${displayDosage})` : ''}\n`;
    });
    richMsg += `Não se esqueça de registrar no app\\!`;
    plainMsg += `Não se esqueça de registrar no app!`;
  } else {
    const success = `Você está em dia com todos os seus medicamentos de hoje\\! 🎉`;
    const plainSuccess = `Você está em dia com todos os seus medicamentos de hoje! 🎉`;
    richMsg += success;
    plainMsg += plainSuccess;
  }
  
  return { title, body: richMsg, pushBody: plainMsg };
}

export function buildAdherenceReportPayload(data: z.input<typeof adherenceReportDataSchema>): NotificationPayload {
  const { firstName, period, percentage, taken, total, comparison } = adherenceReportDataSchema.parse(data);
  const nudge = getMotivationalNudge(percentage);
  const title = '📈 Relatório diário';
  
  const safeName = escapeMarkdownV2(firstName);
  const safePeriod = escapeMarkdownV2(period);
  
  let richMsg = `Olá, *${safeName}*\\!\n\n`;
  richMsg += `Sua adesão ${safePeriod} foi de *${percentage}%*\n`;
  richMsg += `✅ *${taken}* de *${total}* doses registradas\\.\n\n`;
  
  let plainMsg = `Olá, ${firstName}! \n`;
  plainMsg += `Sua adesão ${period} foi de ${percentage}% `;
  plainMsg += `✅ ${taken} de ${total} doses registradas.\n`;
  
  if (comparison) {
    const { deltaPercent, trend } = comparison;
    const trendEmoji = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';
    // Relatório matinal: os dados são de ONTEM → a comparação é com ANTEONTEM
    // (não "vs ontem"). O builder já usa beforeYesterdayCounts como base.
    const trendText = trend === 'up'
      ? `Melhora de ${deltaPercent}% vs anteontem`
      : trend === 'down'
      ? `Queda de ${deltaPercent}% vs anteontem`
      : `Estável vs anteontem`;

    richMsg += `*Comparação:* ${trendEmoji} ${escapeMarkdownV2(trendText)}\n\n`;
    plainMsg += `Comparação: ${trendEmoji} ${trendText}\n`;
  }
  
  richMsg += `_${escapeMarkdownV2(nudge)}_`;
  plainMsg += nudge;
  
  return { title, body: richMsg, pushBody: plainMsg };
}

export function buildWeeklyAdherencePayload(data: z.input<typeof weeklyAdherenceDataSchema>): NotificationPayload {
  const { firstName, percentage, taken, total } = weeklyAdherenceDataSchema.parse(data);
  const nudge = getMotivationalNudge(percentage);
  const title = '📊 Relatório Semanal';

  const safeName = escapeMarkdownV2(firstName);

  let richMsg = `Olá, *${safeName}*\\!\n\n`;
  richMsg += `Sua adesão na última semana foi de *${percentage}%*\n`;
  richMsg += `✅ *${taken}* de *${total}* doses registradas\\.\n\n`;
  richMsg += `_${escapeMarkdownV2(nudge)}_`;

  let plainMsg = `Olá, ${firstName}!\n`;
  plainMsg += `Sua adesão na última semana foi de ${percentage}% `;
  plainMsg += `✅ ${taken} de ${total} doses registradas.\n`;
  plainMsg += nudge;

  return { title, body: richMsg, pushBody: plainMsg };
}

export function buildDoseReminderByPlanPayload(data: z.input<typeof doseReminderByPlanDataSchema>): NotificationPayload {
  const n = data.doses?.length ?? 0;
  const planName = data.planName ?? 'Plano de tratamento';
  const scheduledTime = data.scheduledTime ?? 'agora';
  const hour = data.hour ?? getSaoPauloTime().getHours();

  const greeting = getTimeOfDayGreeting(hour);
  const title = `${greeting} — ${planName}`;

  const body = `Está na hora de tomar ${n} medicamento${n !== 1 ? 's' : ''} do seu plano \\(${escapeMarkdownV2(scheduledTime)}\\)\\.`;
  const pushBody = `Está na hora de tomar ${n} medicamento${n !== 1 ? 's' : ''} do seu plano (${scheduledTime}).`;
  return { title, body, pushBody };
}

export function buildDoseReminderMiscPayload(data: z.input<typeof doseReminderMiscDataSchema>): NotificationPayload {
  const n = data.doses?.length ?? 0;
  const scheduledTime = data.scheduledTime ?? 'agora';
  const hour = data.hour ?? getSaoPauloTime().getHours();

  const title = getTimeOfDayGreeting(hour);
  const body = `Você tem ${n} medicamento${n !== 1 ? 's' : ''} pendente${n !== 1 ? 's' : ''} para ${escapeMarkdownV2(scheduledTime)}\\. Clique para registrar\\.`;
  const pushBody = `Você tem ${n} medicamento${n !== 1 ? 's' : ''} pendente${n !== 1 ? 's' : ''} para ${scheduledTime}. Clique para registrar.`;
  return { title, body, pushBody };
}

export function buildStockAlertPayload(data: z.input<typeof stockAlertDataSchema>): NotificationPayload {
  const { medicineName, remaining, daysRemaining } = stockAlertDataSchema.parse(data);
  const title = `📦 Alerta de Estoque: ${medicineName}`;
  
  let richMsg = `📉 **Restam:** ${remaining} doses\\.\n`;
  let plainMsg = `📉 Restam: ${remaining} doses.\n`;
  
  if (daysRemaining !== undefined) {
    richMsg += `⏳ **Previsão:** Acaba em aproximadamente **${daysRemaining} dias**\\.\n\n`;
    plainMsg += `⏳ Previsão: Acaba em aproximadamente ${daysRemaining} dias.\n\n`;
  }
  
  const footer = `Recomendamos a reposição em breve\\.`;
  const plainFooter = `Recomendamos a reposição em breve.`;
  richMsg += footer;
  plainMsg += plainFooter;
  
  return { title, body: richMsg, pushBody: plainMsg };
}

// 012 Fase A (ADR-059): validade biologica (TTL pos-abertura) — eixo distinto do
// alerta de volume (stock_alert). Cadencia D-3 + vencimento e controlada no cron.
export function buildStockExpiryAlertPayload(data: z.input<typeof stockExpiryAlertDataSchema>): NotificationPayload {
  const { medicineName, daysLeft } = stockExpiryAlertDataSchema.parse(data);
  const title = `⏰ Validade após aberto: ${medicineName}`;
  const safeName = escapeMarkdownV2(medicineName);

  let richMsg;
  let plainMsg;
  if (daysLeft <= 0) {
    richMsg = `O frasco/caneta aberto de *${safeName}* atingiu hoje o limite de uso após a abertura\\.\n\nRecomendamos iniciar um novo frasco/refil\\. Confira a bula\\.`;
    plainMsg = `O frasco/caneta aberto de ${medicineName} atingiu hoje o limite de uso após a abertura.\n\nRecomendamos iniciar um novo frasco/refil. Confira a bula.`;
  } else {
    const diaLabel = daysLeft === 1 ? 'dia' : 'dias';
    richMsg = `O frasco/caneta aberto de *${safeName}* vence em *${daysLeft} ${diaLabel}* \\(validade após aberto\\)\\.\n\nPrograme\\-se para abrir um novo\\.`;
    plainMsg = `O frasco/caneta aberto de ${medicineName} vence em ${daysLeft} ${diaLabel} (validade após aberto).\n\nPrograme-se para abrir um novo.`;
  }

  return { title, body: richMsg, pushBody: plainMsg };
}

/**
 * Dose na unidade de tomada, para a copy da Evolução do tratamento (§8).
 *
 * `formatDose` do core cobre gotas/ml/UI/mg, mas devolve `'2 cp'` para comprimido — e a copy
 * decidida é "Dose ajustada para **2 comprimidos**". `cp` só existe em `titration_steps`
 * (em `protocols` o comprimido é NULL — AP-299), por isso o plural mora aqui e não no core.
 * @private
 */
function _formatStepDose(dose: number | undefined, intakeUnit: string | null | undefined): string {
  if (dose === undefined || dose === null || !Number.isFinite(dose)) return '';
  if (intakeUnit === 'cp' || !intakeUnit) {
    return `${formatNumberPtBR(dose)} ${dose === 1 ? 'comprimido' : 'comprimidos'}`;
  }
  return formatDose(dose, intakeUnit);
}

/**
 * Notificação da Evolução do tratamento (029 F5 / T025 / FR-004 · copy literal das Decisões §8).
 *
 * Dirigida por `transition` — a mesma derivação do motor (CON-032). Cobre single-med
 * (`dose_change`) e multi-med (`medicine_switch`) pela MESMA porta; não há copy "N1" e "N2".
 *
 * ⚰️ Substitui a copy legada do 012/FR-021 ("Hora de trocar de apresentação" / "Atualização de
 * Titulação"), que violava §0/§8 em dois pontos: dizia **"caneta"** (proibido na UI — sempre o
 * nome do medicamento) e chamava a entidade de "Titulação" (o naming é "Evolução do tratamento";
 * "titulação" fica só em código/spec). SaMD/ADR-062: factual, "como prescrito", nunca
 * "recomendada", sem urgência artificial.
 *
 * As AÇÕES saem só no `medicine_switch` (§3.1): `[Iniciar etapa]` `[Ainda não]`, espelhando o
 * card do Hoje. `dose_change` é automático na data → informativo, SEM botões (§3.4).
 */
export function buildTitrationAlertPayload(data: z.input<typeof titrationAlertDataSchema>): NotificationPayload & { actions?: Array<z.input<typeof actionSchema>> } {
  const parsed = titrationAlertDataSchema.parse(data);
  const { medicineName, currentStage, totalStages, stepId, dose, intakeUnit, status, requiresNewMedicine } = parsed;

  // Compat de outbox (R-193): payload enfileirado ANTES do deploy não tem `transition`.
  // Deriva do par N1 para não emitir copy errada durante a janela de drenagem.
  const transition = parsed.transition
    ?? (requiresNewMedicine ? 'medicine_switch' : status === 'alvo_atingido' ? 'target_reached' : 'dose_change');

  const safeName = escapeMarkdownV2(medicineName);
  const doseLabel = _formatStepDose(dose, intakeUnit);

  if (transition === 'medicine_switch') {
    // §8: "Etapa 2 começa hoje" · "Semaglutida 0,5 mg" · "Como prescrito pelo seu médico."
    const title = `Etapa ${currentStage} começa hoje`;
    const rich = `*Etapa ${currentStage} começa hoje*\n\n${safeName}${doseLabel ? ` • ${escapeMarkdownV2(doseLabel)}` : ''}\n\nComo prescrito pelo seu médico\\.`;
    const plain = `Etapa ${currentStage} começa hoje\n${medicineName}${doseLabel ? ` • ${doseLabel}` : ''}\nComo prescrito pelo seu médico.`;
    return {
      title,
      body: rich,
      pushBody: plain,
      // `stepId` é o argumento de `confirm_titration_switch(p_step_id)`. Sem ele a ação não tem
      // o que confirmar — melhor sair sem botão do que com botão que falha no toque.
      actions: stepId
        ? [
            { id: 'start_step', label: 'Iniciar etapa', params: { stepId } },
            { id: 'not_yet', label: 'Ainda não', params: { stepId } },
          ]
        : [],
    };
  }

  if (transition === 'target_reached') {
    // Última etapa finita esgotada: a escada deixa de reger a dose (a de manutenção vive no
    // protocol). Factual e sóbrio — nada a confirmar, logo sem ações.
    const title = 'Evolução do tratamento concluída';
    const rich = `*Evolução do tratamento concluída*\n\n${safeName}\n\nVocê chegou à última etapa prescrita\\. Os lembretes seguem na dose atual\\.`;
    const plain = `Evolução do tratamento concluída\n${medicineName}\nVocê chegou à última etapa prescrita. Os lembretes seguem na dose atual.`;
    return { title, body: rich, pushBody: plain, actions: [] };
  }

  // dose_change (§3.4 / §8): automático na data — informativo, SEM botões.
  // "Dose ajustada para 2 comprimidos" · "Metoprolol 50 mg · etapa 2 da evolução do tratamento,
  //  como prescrito. Os lembretes já estão na dose nova."
  const title = doseLabel ? `Dose ajustada para ${doseLabel}` : 'Dose ajustada';
  const rich =
    `*${escapeMarkdownV2(title)}*\n\n` +
    `${safeName} • etapa ${currentStage} de ${totalStages} da evolução do tratamento, como prescrito\\.\n\n` +
    `Os lembretes já estão na dose nova\\.`;
  const plain =
    `${title}\n` +
    `${medicineName} • etapa ${currentStage} de ${totalStages} da evolução do tratamento, como prescrito.\n` +
    `Os lembretes já estão na dose nova.`;
  return { title, body: rich, pushBody: plain, actions: [] };
}

export function buildMonthlyReportPayload(data: z.input<typeof adherenceReportDataSchema>): NotificationPayload {
  const { firstName, percentage, taken, total } = adherenceReportDataSchema.parse(data);
  const title = '🗓️ Relatório Mensal';
  
  let richMsg = `📊 *Seu Relatório Mensal*\n\n`;
  richMsg += `Olá ${escapeMarkdownV2(firstName)}, sua taxa de adesão no último mês foi de **${percentage}%**\\.\n`;
  richMsg += `✅ **Doses tomadas:** ${taken}\n`;
  richMsg += `📝 **Doses esperadas:** ${total}\n\n`;
  
  let plainMsg = `📊 Seu Relatório Mensal\n`;
  plainMsg += `Olá ${firstName}, sua taxa de adesão no último mês foi de ${percentage}%.\n`;
  plainMsg += `✅ Doses tomadas: ${taken}\n`;
  plainMsg += `📝 Doses esperadas: ${total}\n\n`;
  
  let nudge = '';
  let plainNudge = '';
  if (percentage >= 90) { nudge = `🚀 *Desempenho excepcional\\!* Continue assim\\.`; plainNudge = `🚀 Desempenho excepcional! Continue assim.`; }
  else if (percentage >= 70) { nudge = `💪 *Bom trabalho\\!* Vamos buscar os 100% no próximo mês?`; plainNudge = `💪 Bom trabalho! Vamos buscar os 100% no próximo mês?`; }
  else { nudge = `💡 *Lembrete:* Manter a constância é fundamental para o sucesso do tratamento\\.`; plainNudge = `💡 Lembrete: Manter a constância é fundamental para o sucesso do tratamento.`; }
  
  richMsg += nudge;
  plainMsg += plainNudge;
  
  return { title, body: richMsg, pushBody: plainMsg };
}

export function buildPrescriptionAlertPayload(data: z.input<typeof prescriptionAlertDataSchema>): NotificationPayload {
  const { medicineName, endDate, daysRemaining } = prescriptionAlertDataSchema.parse(data);
  const date = getSaoPauloTime(endDate).toLocaleDateString('pt-BR');
  const title = '📋 Alerta de Prescrição';

  let richMsg = '';
  let plainMsg = '';
  if (daysRemaining === 1) {
    richMsg = `⚠️ *Sua prescrição vence amanhã\\.!*\n\n`;
    plainMsg = `⚠️ Sua prescrição vence amanhã!\n`;
  } else if (daysRemaining <= 7) {
    richMsg = `⚠️ *Prescrição vencendo em ${daysRemaining} dias*\n\n`;
    plainMsg = `⚠️ Prescrição vencendo em ${daysRemaining} dias\n`;
  } else {
    richMsg = `📋 *Renovação de Prescrição*\n\n`;
    plainMsg = `📋 Renovação de Prescrição\n`;
  }

  const info = `Medicamento: ${medicineName}\n` + `Vencimento: ${date}\n\n`;
  richMsg += escapeMarkdownV2(info);
  plainMsg += info;

  let footer = '';
  let plainFooter = '';
  if (daysRemaining <= 7) {
    footer = `🚨 *Atenção\\.!* Renove sua prescrição o quanto antes para evitar interrupção no tratamento\\.`;
    plainFooter = `🚨 Atenção! Renove sua prescrição o quanto antes para evitar interrupção no tratamento.`;
  } else {
    footer = `💡 É um bom momento para agendar sua consulta de acompanhamento para renovação\\.`;
    plainFooter = `💡 É um bom momento para agendar sua consulta de acompanhamento para renovação.`;
  }
  
  richMsg += footer;
  plainMsg += plainFooter;

  return { title, body: richMsg, pushBody: plainMsg };
}

export function buildDlqDigestPayload(data: z.input<typeof dlqDigestDataSchema>): NotificationPayload {
  const { failedCount, failures } = dlqDigestDataSchema.parse(data);
  const title = '⚠️ DLQ Digest';
  
  let richMsg = `*${failedCount} notificações falhadas*\n\n`;
  let plainMsg = `${failedCount} notificações falhadas\n\n`;
  
  const items = failures.map(f => {
    const localTime = getSaoPauloTime(f.created_at);
    const time = localTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const error = (f.error_message || 'Erro desconhecido').substring(0, 50);
    return {
      rich: `• [${time}] *${escapeMarkdownV2(f.type)}*: _${escapeMarkdownV2(error)}_`,
      plain: `• [${time}] ${f.type}: ${error}`
    };
  });

  richMsg += items.map(i => i.rich).join('\n');
  plainMsg += items.map(i => i.plain).join('\n');
  
  return { title, body: richMsg, pushBody: plainMsg };
}

/**
 * Aviso de exclusão automática por consentimento revogado (046 Slice C / T013d).
 *
 * ⚠️ A copy é o CONTROLE de privacidade, não decoração. Este é o único aviso que chega à tela de
 * bloqueio de alguém que revogou o consentimento: uma palavra clínica aqui — "medicamento",
 * "dose", "tratamento" — vazaria condição de saúde para quem estiver olhando o celular por cima do
 * ombro dele, exatamente no momento em que ele pediu para o app parar. Nada disso entra.
 */
export function buildConsentPruneNoticePayload(
  data: z.input<typeof consentPruneNoticeDataSchema>
): NotificationPayload {
  const { daysLeft } = consentPruneNoticeDataSchema.parse(data);
  const title = 'Sua conta precisa de uma ação';
  const prazo = daysLeft === 1 ? '1 dia' : `${daysLeft} dias`;
  const plain =
    `Você retirou sua autorização de uso de dados no dosiq. Se nada for feito, sua conta e seus ` +
    `dados serão excluídos automaticamente em ${prazo}. Para manter a conta, abra o app e ` +
    `autorize novamente. Você também pode exportar seus dados ou excluir a conta agora.`;
  return { title, body: escapeMarkdownV2(plain), pushBody: plain };
}
