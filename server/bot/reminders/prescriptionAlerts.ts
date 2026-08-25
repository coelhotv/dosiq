import { supabase } from '../../services/supabase.js';
import { createLogger } from '../logger.js';
import { parseLocalDate, getTodayLocal } from '../../utils/dateUtils.js';

const logger = createLogger('PrescriptionAlerts');

async function _processPrescriptionProtocol(userId, protocol, todayDate, dispatcher, correlationId) {
  const endDate = parseLocalDate(protocol.end_date);
  const diffTime = endDate.getTime() - todayDate.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const alertDays = [30, 7, 1];
  if (!alertDays.includes(daysRemaining)) return;

  await dispatcher.dispatch({
    userId,
    kind: 'prescription_alert',
    data: {
      medicineName: protocol.medicine?.name || 'Medicamento',
      endDate: protocol.end_date,
      daysRemaining
    },
    context: { correlationId, jobType: 'prescription_alert' }
  });
}

export async function checkPrescriptionAlertsViaDispatcher(dispatcher: any, correlationId: string) {
  try {
    const { data: users, error: userError } = await (supabase as any)
      .from('user_settings')
      .select('user_id, timezone')
      .eq('notifications_enabled', true);

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    logger.info(`Iniciando alertas de prescrição via Dispatcher para ${users.length} usuários`, { correlationId });

    for (const user of users) {
      const userId = user.user_id;
      const todayDate = parseLocalDate(getTodayLocal());

      const { data: protocols } = await (supabase as any)
        .from('protocols')
        .select(`
          *,
          medicine:medicines(name, dosage_unit)
        `)
        .eq('user_id', userId)
        .eq('active', true)
        .not('end_date', 'is', null);

      if (!protocols || protocols.length === 0) continue;

      for (const protocol of protocols) {
        await _processPrescriptionProtocol(userId, protocol, todayDate, dispatcher, correlationId);
      }
    }
  } catch (err) {
    logger.error('Erro em checkPrescriptionAlertsViaDispatcher', err, { correlationId });
  }
}
