
import { buildNotificationPayload } from '../server/notifications/payloads/buildNotificationPayload.js';

async function testGate2() {
  console.log('🚀 Iniciando Testes de GATE 2: Integração Business Layer (L1) -> Presentation Layer (L2)\n');

  const testCases = [
    {
      name: 'Daily Digest (L1 Data)',
      kind: 'daily_digest',
      data: {
        firstName: 'Carlos',
        hour: 8,
        pendingCount: 2,
        medicines: [
          { name: 'Losartana', time: '08:00', dosage: '50mg' },
          { name: 'Metformina', time: '08:00', dosage: '500mg' }
        ]
      }
    },
    {
      name: 'Daily Adherence (L1 Data with Storytelling)',
      kind: 'adherence_report',
      data: {
        firstName: 'Carlos',
        period: 'hoje',
        percentage: 100,
        taken: 4,
        total: 4,
        storytelling: '🌟 Segundo dia seguido com 100%!'
      }
    },
    {
      name: 'Weekly Adherence (L1 Data)',
      kind: 'adherence_report',
      data: {
        firstName: 'Carlos',
        period: 'na última semana',
        percentage: 85,
        taken: 24,
        total: 28
      }
    },
    {
      name: 'Stock Alert (L1 Data)',
      kind: 'stock_alert',
      data: {
        medicineName: 'Rivotril',
        remaining: 5,
        daysRemaining: 2
      }
    },
    {
      name: 'Titration Alert (L1 Data)',
      kind: 'titration_alert',
      data: {
        medicineName: 'Venvanse',
        currentStage: 2,
        totalStages: 4,
        status: 'titulando',
        nextStage: {
          dosage: '50mg',
          unit: 'mg',
          date: '2026-05-10'
        }
      }
    }
  ];

  let passed = 0;
  for (const tc of testCases) {
    try {
      console.log(`Testing: ${tc.name}`);
      const payload = await buildNotificationPayload({ kind: tc.kind, data: tc.data });
      
      if (!payload.title || !payload.body || !payload.deeplink) {
        throw new Error(`Payload incompleto: ${JSON.stringify(payload)}`);
      }

      console.log(`✅ Title: ${payload.title}`);
      console.log(`✅ Deeplink: ${payload.deeplink}`);
      console.log(`--- Body Snippet ---\n${payload.body.substring(0, 100)}...\n-------------------\n`);
      passed++;
    } catch (err) {
      console.error(`❌ FAILED: ${tc.name}`);
      console.error(err);
    }
  }

  console.log(`\n📊 Resultado: ${passed}/${testCases.length} testes passaram.`);
  if (passed === testCases.length) {
    console.log('\n🌟 GATE 2 VALIDADO COM SUCESSO!');
  } else {
    process.exit(1);
  }
}

testGate2();
