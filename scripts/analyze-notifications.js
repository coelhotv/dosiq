#!/usr/bin/env node
/**
 * Script to analyze notification issues from Supabase
 * Query the dead letter queue and notification logs to diagnose problems
 * 
 * Usage: node scripts/analyze-notifications.js [--env=production]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const env = 'production'; // Always use .env.local for Supabase
console.log(`🔍 Analisando notificações no ambiente: ${env}\n`);

// Create Supabase client using .env.local (URL via env — nunca hardcoded; repo opensource)
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: Variáveis de ambiente do Supabase não configuradas');
  console.error('   Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeDeadLetterQueue() {
  console.log('📋 FILA DE NOTIFICAÇÕES FALHAS (Dead Letter Queue)\n');
  
  const { data: dlq, error } = await supabase
    .from('failed_notification_queue')
    .select('*')
    .in('status', ['failed', 'pending'])
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) {
    console.error('❌ Erro ao consultar DLQ:', error.message);
    return [];
  }
  
  if (!dlq || dlq.length === 0) {
    console.log('✅ Nenhuma notificação na DLQ\n');
    return [];
  }
  
  console.log(`📊 Total de falhas: ${dlq.length}\n`);
  
  // Group by error type
  const byError = {};
  const byType = {};
  const byDay = {};
  
  dlq.forEach(entry => {
    // By error code
    const code = entry.codigo_erro || 'unknown';
    byError[code] = (byError[code] || 0) + 1;
    
    // By notification type
    const type = entry.tipo_notificacao || 'unknown';
    byType[type] = (byType[type] || 0) + 1;
    
    // By day
    const day = entry.criado_em?.split('T')[0];
    if (day) {
      byDay[day] = (byDay[day] || 0) + 1;
    }
  });
  
  console.log('🏷️  Por tipo de erro:');
  Object.entries(byError)
    .sort((a, b) => b[1] - a[1])
    .forEach(([code, count]) => console.log(`   ${code}: ${count}`));
  
  console.log('\n📨 Por tipo de notificação:');
  Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => console.log(`   ${type}: ${count}`));
  
  console.log('\n📅 Por dia:');
  Object.entries(byDay)
    .sort((a, b) => b[0] - a[0])
    .forEach(([day, count]) => console.log(`   ${day}: ${count}`));
  
  console.log('\n📝 Entradas recentes (últimas 10):\n');
  dlq.slice(0, 10).forEach((entry, i) => {
    console.log(`${i + 1}. [${entry.codigo_erro || '?'}] ${entry.tipo_notificacao}`);
    console.log(`   Usuário: ${entry.usuario_id?.slice(0, 8)}...`);
    console.log(`   Erro: ${entry.mensagem_erro?.slice(0, 100)}...`);
    console.log(`   Data: ${entry.criado_em}`);
    console.log(`   Tentativas: ${entry.tentativas}`);
    console.log('');
  });
  
  return dlq;
}

async function analyzeNotificationLogs() {
  console.log('\n📋 LOGS DE NOTIFICAÇÕES (notification_logs)\n');
  
  // Check if table exists
  const { data: _check, error: checkError } = await supabase
    .from('notification_logs')
    .select('id')
    .limit(1);
  
  if (checkError && checkError.message.includes('not find')) {
    console.log('⚠️  Tabela notification_logs ainda não existe\n');
    console.log('💡 Execute a migração add_notification_status.sql\n');
    return;
  }
  
  // Check recent notification status
  const { data: logs, error } = await supabase
    .from('notification_logs')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(50);
  
  if (error) {
    console.error('❌ Erro ao consultar logs:', error.message);
    return;
  }
  
  if (!logs || logs.length === 0) {
    console.log('ℹ️  Nenhuma entrada na tabela notification_logs\n');
    return;
  }
  
  const byStatus = {};
  const byType = {};
  
  logs.forEach(log => {
    const status = log.status || 'unknown';
    const type = log.tipo_notificacao || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
    byType[type] = (byType[type] || 0) + 1;
  });
  
  console.log(`📊 Total de registros: ${logs.length}\n`);
  
  console.log('🏷️  Por status:');
  Object.entries(byStatus)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => console.log(`   ${status}: ${count}`));
  
  console.log('\n📨 Por tipo:');
  Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => console.log(`   ${type}: ${count}`));
  
  console.log('\n📝 Registros recentes:\n');
  logs.slice(0, 10).forEach((log, i) => {
    console.log(`${i + 1}. [${log.status}] ${log.tipo_notificacao}`);
    console.log(`   Usuário: ${log.usuario_id?.slice(0, 8)}...`);
    console.log(`   Data: ${log.criado_em}`);
    if (log.erro) console.log(`   Erro: ${log.erro}`);
    console.log('');
  });
}

async function analyzeProtocols() {
  console.log('\n📋 PROTOCOLS ANALYSIS\n');
  
  // Get all protocols with their user settings
  const { data: protocols, error } = await supabase
    .from('protocols')
    .select(`
      *,
      medicine:medicines(name)
    `)
    .eq('active', true);
  
  if (error) {
    console.error('❌ Erro ao consultar protocolos:', error.message);
    return;
  }
  
  console.log(`📊 Protocolos ativos: ${protocols?.length || 0}\n`);
  
  protocols?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.medicine?.name || '?'} (ID: ${p.id?.slice(0, 8)}...)`);
    console.log(`   Horários: ${p.time_schedule?.join(', ')}`);
    console.log(`   Última notificação: ${p.last_notified_at || 'nunca'}`);
    console.log(`   Status: ${p.status_ultima_notificacao || 'n/a'}`);
    console.log('');
  });
}

async function checkFailedUsers() {
  console.log('\n👥 USUÁRIOS COM FALHAS\n');
  
  // Get unique users with failed notifications
  const { data: users, error } = await supabase
    .from('failed_notification_queue')
    .select('user_id')
    .in('status', ['failed', 'pending']);
  
  if (error) {
    console.error('❌ Erro ao consultar usuários:', error.message);
    return;
  }
  
  // Get unique users
  const uniqueUsers = [...new Set(users?.map(u => u.user_id))];
  
  console.log(`📊 Usuários com falhas: ${uniqueUsers.length || 0}\n`);
  
  uniqueUsers?.forEach((u, i) => {
    console.log(`${i + 1}. ${u}`);
  });
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  ANÁLISE DE NOTIFICAÇÕES - MEUS REMÉDIOS');
  console.log('═'.repeat(60));
  console.log('');
  
  try {
    await analyzeDeadLetterQueue();
    await analyzeNotificationLogs();
    await analyzeProtocols();
    await checkFailedUsers();
    
    console.log('═'.repeat(60));
    console.log('  FIM DA ANÁLISE');
    console.log('═'.repeat(60));
    
    console.log('\n💡 RECOMENDAÇÕES:');
    console.log('1. Se houver muitas entradas "blocked" ou "invalid_chat":');
    console.log('   - Verificar se o usuário bloqueou o bot');
    console.log('   - Solicitar que o usuário digite /start novamente');
    console.log('');
    console.log('2. Se houver muitas entradas "network_error":');
    console.log('   - Verificar conectividade do servidor');
    console.log('   - O retry automático deve resolver');
    console.log('');
    console.log('3. Se não houver entradas na DLQ mas notificações não chegam:');
    console.log('   - Verificar se protocolos estão ativos (active=true)');
    console.log('   - Verificar se horário está correto no schedule');
    console.log('   - Verificar se usuário tem telegram_chat_id configurado');
    
  } catch (err) {
    console.error('❌ Erro durante análise:', err.message);
    process.exit(1);
  }
}

main();
