// scripts/smoke-server.mjs
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Configurar variáveis de ambiente fake para simular o import em produção
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fake-supabase-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fake-supabase-service-role-key-that-satisfies-length-constraints';
process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'fake-anon-key';
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '123456789:fake-telegram-bot-token-for-smoke-test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Módulos a serem importados relativamente ao diretório do script
const modulesToTest = [
  { name: 'Supabase Service', path: '../server/services/supabase.js', critical: true },
  { name: 'Dead Letter Queue', path: '../server/services/deadLetterQueue.js', critical: true },
  { name: 'Bot Factory', path: '../server/bot/bot-factory.js', critical: true },
  { name: 'Notification Dispatcher', path: '../server/notifications/dispatcher/dispatchNotification.js', critical: false },
  { name: 'Notification Payloads', path: '../server/notifications/payloads/buildNotificationPayload.js', critical: false }
];

console.log('🧪 Iniciando Smoke Test do Servidor (Verificação de Cold Start)...');
console.log(`Runtime: Node.js ${process.version}`);
console.log('='.repeat(60));

let failedCriticalCount = 0;
let failedNonCriticalCount = 0;

for (const mod of modulesToTest) {
  const absolutePath = path.resolve(__dirname, mod.path);
  try {
    console.log(`⏳ Importando ${mod.name}...`);
    // Usando dynamic import
    await import(absolutePath);
    console.log(`✅ ${mod.name} importado com sucesso.`);
  } catch (error) {
    console.error(`❌ Falha ao importar ${mod.name}:`);
    console.error(error);
    if (mod.critical) {
      failedCriticalCount++;
    } else {
      failedNonCriticalCount++;
    }
  }
  console.log('-'.repeat(60));
}

console.log('='.repeat(60));
console.log('📊 Resumo do Smoke Test:');
console.log(`Critical modules failed: ${failedCriticalCount}`);
console.log(`Non-critical modules failed: ${failedNonCriticalCount}`);

if (failedCriticalCount > 0) {
  console.error('❌ FAILED: Um ou mais módulos críticos falharam ao importar.');
  process.exit(1);
} else {
  console.log('✅ SUCCESS: Todos os módulos críticos importados com sucesso!');
  process.exit(0);
}
