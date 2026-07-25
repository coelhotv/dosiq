// server/utils/auth.ts
// Utilitário compartilhado de verificação de acesso administrativo.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// MODELO DE AUTORIZAÇÃO: uid autenticado (ADR-091 D10 · RC-SEC-2 S-6, CRITICAL)
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// Admin é `auth.users.id === ADMIN_USER_ID`. Ponto. Sem consulta a tabela.
//
// O QUE ISTO SUBSTITUIU e por que era grave: até 2026-07-25 admin era *"a linha de `user_settings`
// do usuário tem `telegram_chat_id == ADMIN_CHAT_ID`"*. Medido no banco: a policy de UPDATE de
// `user_settings` não restringe COLUNA, `authenticated` tem o privilégio nela, e não há UNIQUE que
// tornasse a colisão visível ⇒ qualquer uma das 48 contas podia se AUTO-PROMOVER a admin escrevendo
// o chat_id do admin na própria linha. O furo era pré-existente e protegia DLQ, feedbacks e nudges —
// ruim, mas contido. O que mudou foi o que passa a estar atrás dele: bloquear o boot de toda a base
// instalada de um app de medicação (FR-021 / kill switch de versão).
//
// Por que o uid fecha: `auth.users` tem ZERO grants para `anon`, `authenticated` e `service_role`
// (verificado 2026-07-25) — não é alcançável por PostgREST nesses papéis, e o `id` é a PK atribuída
// pelo GoTrue no signup. Não existe superfície para o usuário alterar o próprio uid. E são 122 bits
// de entropia contra ~10 dígitos chutáveis de um chat_id do Telegram.
//
// GUARDS QUE FAZEM PARTE DO CONTROLE — não são extras, não "otimizar" depois:
//  1. `getUser()` SEMPRE: valida o token contra o servidor de auth. NUNCA decodificar JWT local sem
//     verificar assinatura — derrubaria o controle inteiro, e é o tipo de mudança que passa por um
//     review futuro como "dá no mesmo e é mais rápido".
//  2. FAIL-CLOSED: env ausente ⇒ NEGAR. Nada de `if (adminUserId && ...)`, que converte
//     "não configurado" em "todo mundo entra".
//  3. AP-216: desestruturar `data` primeiro e ler `data?.user` — nunca `const { data: { user } }`,
//     que estoura TypeError quando `data` vem null.
//  4. S-12: mensagem UNIFORME para fora. Quem chama não descobre se falhou por token inválido, por
//     não ser admin ou por env faltando; o detalhe fica no log do servidor.
//
// `ADMIN_CHAT_ID` continua existindo e volta a significar só o que sempre foi: mensageria do bot.

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { createLogger } from '../bot/logger.js';

const logger = createLogger('AdminAuth');

/**
 * Env lida NA CHAMADA, não no escopo do módulo — e isso é parte do controle, não estilo.
 *
 * MEDIDO em 2026-07-25: com a leitura em escopo de módulo, este arquivo via `ADMIN_USER_ID`
 * como `undefined` enquanto `api/admin.ts` a via preenchida. Causa: um `dotenv/config` TRANSITIVO
 * (via `server/services/deadLetterQueue.js`) injeta o `.env` *durante* o grafo de import, e a ordem
 * ESM avalia este módulo ANTES disso. Ou seja: o valor que um controle de autorização enxerga
 * dependia de qual import veio primeiro.
 *
 * Em produção (Vercel) a env existe antes do processo subir, então não havia impacto — e a falha
 * ocorreu para o lado seguro (negou). Mas "seguro por acidente de ordenação" é a definição do
 * AP-278: uma proteção que evapora no primeiro refactor legítimo de imports.
 */
function readConfig() {
  return {
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    adminUserId: process.env.ADMIN_USER_ID,
  };
}

/**
 * Mensagem única de QUALQUER negação (S-12). O motivo real vai para o log.
 * Não parametrizar: uma mensagem diferente por causa é um oráculo para quem sonda.
 */
const DENIED = 'Acesso negado';

export interface AdminAccessResult {
  authorized: boolean;
  error?: string;
  userId?: string;
}

/**
 * Verifica se o portador do token é o administrador.
 *
 * @param authHeader - Header `Authorization: Bearer <access_token>`
 * @returns `{ authorized: true, userId }` ou `{ authorized: false, error }` (motivo genérico)
 */
export async function verifyAdminAccess(authHeader: string | undefined): Promise<AdminAccessResult> {
  const { supabaseUrl, supabaseAnonKey, adminUserId } = readConfig();

  // Fail-closed ANTES de qualquer trabalho: sem a env não existe admin — e "não existe admin" é
  // negar todos, não liberar todos. Se o painel aparecer com 401 em tudo, a primeira coisa a
  // conferir é ADMIN_USER_ID no ambiente: é por desenho, não é bug.
  if (!adminUserId) {
    logger.error('ADMIN_USER_ID não configurada — todo acesso admin será NEGADO (fail-closed)');
    return { authorized: false, error: DENIED };
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    logger.error('Configuração do Supabase ausente na verificação de admin');
    return { authorized: false, error: DENIED };
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: DENIED };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return { authorized: false, error: DENIED };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    },
    realtime: { transport: /* TODO(040-strict): typar transport supabase realtime */ ws as any },
  });

  try {
    // Validação SERVER-SIDE do token (assinatura, expiração, revogação). Insubstituível por decode.
    const { data, error: authError } = await supabase.auth.getUser();
    const user = data?.user; // AP-216: `data` pode ser null

    if (authError || !user?.id) {
      logger.warn('Token inválido ou expirado na verificação de admin');
      return { authorized: false, error: DENIED };
    }

    if (user.id !== adminUserId) {
      logger.warn('Tentativa de acesso admin por usuário não-admin', { userId: user.id });
      return { authorized: false, error: DENIED };
    }

    return { authorized: true, userId: user.id };
  } catch (err) {
    logger.error('Erro na verificação de admin', err);
    return { authorized: false, error: DENIED };
  }
}
