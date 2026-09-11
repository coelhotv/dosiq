import { z } from 'zod';

// Desfecho da ENTREGA FÍSICA de uma notificação (ADR-100). O `status` NÃO descreve a notificação
// — a notificação é a linha na inbox (ADR-047) e continua visível com qualquer valor daqui.
//
// ⚠️ R-271: os arrays abaixo espelham o CHECK `notification_log_status_check`. Valor novo aqui SEM
// migração do CHECK = insert que falha só em runtime (23514). Andam sempre juntos.
// CHECK conferido em prod em 2026-09-11 (R-295), após as migrações
// `docs/migrations/20260910_notification_log_status_vocab.sql` e
// `docs/migrations/20260911_notification_log_suprimida_sem_prova.sql`.

// O que o código NOVO escreve — vocabulário fechado do ADR-100.
export const NOTIFICATION_DELIVERY_STATUSES = [
  'enviada',           // ao menos um canal aceitou a mensagem
  'falhou',            // ao menos um canal tentou e errou (`mensagem_erro` preenchida)
  'silenciada',        // suprimida por política (quiet hours / consentimento revogado)
  'suprimida_alarme',  // push omitido de propósito: o alarme local cobre a dose
  'sem_canal',         // nenhum canal físico ativo — NADA foi entregue
  // Slice C (FR-012b): push omitido SEM prova de alarme e com usuário incapaz de produzi-la.
  // Oposto de `suprimida_alarme` em risco: lá a dose está COBERTA pelo alarme do aparelho, aqui
  // ninguém avisou a paciente. Colapsar os dois faz a apuração do Slice B carimbar a dose não
  // avisada como `coberta` — que não alerta.
  'suprimida_sem_prova',
] as const;

// O que o banco ACEITA. É superconjunto do de cima: `pendente`/`sucesso`/`falha`/`entregue` são
// vocabulário legado que o CHECK ainda admite e que nenhum escritor emite hoje (medido em prod
// 2026-09-10: só `enviada` 8.061, `falhou` 472, `silenciada` 4). Ficam aqui porque a LEITURA usa
// `.parse()` — um valor fora do enum derrubaria a inbox inteira, não só a linha.
export const NOTIFICATION_LOG_STATUSES = [
  ...NOTIFICATION_DELIVERY_STATUSES,
  'pendente',
  'sucesso',
  'falha',
  'entregue',
] as const;

export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

const baseSchema = {
  user_id:           z.string().uuid(),
  protocol_id:       z.string().uuid().optional().nullable(),
  notification_type: z.string(),
  status:            z.enum(NOTIFICATION_LOG_STATUSES).default('enviada'),
  sent_at:           z.string().datetime({ offset: true }).optional(),
  title:             z.string().optional().nullable(),
  body:              z.string().optional().nullable(),
  medicine_name:     z.string().optional().nullable(),
  protocol_name:     z.string().optional().nullable(),
  treatment_plan_id:   z.string().uuid().nullable().optional(),
  treatment_plan_name: z.string().nullable().optional(),
  channels:          z.array(z.object({
    channel:    z.string(),
    status:     z.string(),
    // ADR-100: por que ESTE canal não entregou. Sem o campo declarado aqui o `z.object` o
    // REMOVERIA em silêncio no `safeParse` do repositório — o motivo nunca chegaria ao banco e
    // nenhum teste ficaria vermelho (AP-214).
    reason:     z.string().nullable().optional(),
    message_id: z.number().optional().nullable(),
    tickets:    z.array(z.unknown()).optional().nullable(),
  })).default([]),
  telegram_message_id: z.number().nullable().optional(),
  mensagem_erro:     z.string().nullable().optional(),
  provider_metadata: z.record(z.string(), z.unknown()).default({}),
};

export const notificationLogSchema = z.object({
  id: z.string().uuid().optional(),
  created_at: z.string().datetime({ offset: true }).optional(),
  ...baseSchema,
});

export const notificationLogCreateSchema = z.object({
  ...baseSchema,
  // Escrita é mais estreita que leitura: código novo só emite o vocabulário do ADR-100.
  status: z.enum(NOTIFICATION_DELIVERY_STATUSES).default('enviada'),
});
