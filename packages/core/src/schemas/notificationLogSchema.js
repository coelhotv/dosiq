import { z } from 'zod';

const baseSchema = {
  user_id:           z.string().uuid(),
  protocol_id:       z.string().uuid().optional().nullable(),
  notification_type: z.string(),
  status:            z.string().default('enviada'),
  sent_at:           z.string().datetime({ offset: true }).optional(),
  title:             z.string().optional().nullable(),
  body:              z.string().optional().nullable(),
  medicine_name:     z.string().optional().nullable(),
  protocol_name:     z.string().optional().nullable(),
  channels:          z.array(z.object({
    channel:    z.string(),
    status:     z.string(),
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
});
