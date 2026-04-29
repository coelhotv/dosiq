import { buildNotificationPayload } from '../server/notifications/payloads/buildNotificationPayload.js';

try {
  console.log('Testing daily_digest...');
  const digest = buildNotificationPayload({
    kind: 'daily_digest',
    data: {
      firstName: 'Tiago',
      hour: 8,
      pendingCount: 2,
      medicines: [
        { name: 'Omega 3', time: '08:00', dosage: '1 caps' },
        { name: 'Vitamina D', time: '09:00' }
      ]
    }
  });
  console.log('Title:', digest.title);
  console.log('Body:', digest.body);
  console.log('Deeplink:', digest.deeplink);

  console.log('\nTesting adherence_report...');
  const report = buildNotificationPayload({
    kind: 'adherence_report',
    data: {
      firstName: 'Tiago',
      period: 'esta semana',
      percentage: 85,
      taken: 17,
      total: 20
    }
  });
  console.log('Title:', report.title);
  console.log('Body:', report.body);
  console.log('Deeplink:', report.deeplink);

  console.log('\nGATE 1 VALIDATION SUCCESSFUL!');
} catch (error) {
  console.error('\nGATE 1 VALIDATION FAILED!');
  console.error(error);
  process.exit(1);
}
