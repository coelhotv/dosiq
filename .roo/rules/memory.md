

---

## Memory Entry — 2026-02-14 18:48
**Contexto / Objetivo**
- Corrigir alerts do bot Telegram que não funcionavam em produção (deploy Vercel)
- Identificar e resolver problema de configuração serverless

**O que foi feito (mudanças)**
- Branch criada: `fix/telegram-alerts-production`
- Arquivos alterados:
  - `server/services/supabase.js` — dotenv condicional + remoção de process.exit()
  - `vercel.json` — adicionada configuração de timeout para funções serverless
  - `api/notify.js` — logging diagnóstico para verificação de variáveis de ambiente

**Root Cause Identificado**
- `dotenv.config()` tentava carregar arquivo `.env` que não existe em Vercel
- `process.exit(1)` terminava a função serverless ao invés de lançar erro
- Função `/api/notify` crashava antes de processar qualquer notificação

**O que deu certo**
- Análise identificou corretamente o problema de configuração
- Validação confirmou que variáveis de ambiente estão configuradas no Vercel
- Fix aplicado seguindo padrões serverless (throw ao invés de exit)
- Todos os testes passando (149) e lint limpo

**Regras locais para o futuro (lições acionáveis)**
- NUNCA usar `process.exit()` em funções serverless — sempre usar `throw new Error()`
- SEMPRE fazer dotenv condicional: `if (process.env.NODE_ENV !== 'production')`
- Vercel injeta variáveis de ambiente automaticamente — não precisa de dotenv em produção
- Adicionar logging diagnóstico no início de handlers para debugar env vars
- Configurar `maxDuration` em `vercel.json` para funções que processam múltiplos usuários

**Pendências / próximos passos**
- Push da branch: `git push origin fix/telegram-alerts-production`
- Criar PR para review
- Deploy em produção e monitorar logs do Vercel
- Verificar se alerts estão sendo enviados corretamente

---

## Memory Entry — 2026-02-15 11:15
**Contexto / Objetivo**
- Documentar o sistema de notificações refactorado do bot Telegram (PRs #19, #20, #21, #22)
- Criar documentação completa da arquitetura de 3 fases (P0/P1/P2)
- Atualizar documentação existente para refletir nova arquitetura

**O que foi feito (mudanças)**
- Branch criada: `docs/bot-notification-refactor`
- Arquivos criados:
  - `docs/TELEGRAM_BOT_NOTIFICATION_SYSTEM.md` - Documentação completa do sistema
  - `docs/past_deliveries/BOT_NOTIFICATION_REFACTOR_DELIVERY.md` - Resumo da entrega
- Arquivos atualizados:
  - `server/Telegram Bot Architect.md` - Adicionada seção "Notification System Architecture"
  - `server/BOT README.md` - Adicionada seção "Notification System (v3.0.0)"
  - `docs/ARQUITETURA.md` - Atualizado diagrama e features (F4.7)
  - `.roo/rules/memory.md` - Esta entrada

**Arquitetura Documentada**
- Fase P0: Result object pattern, DB status tracking, log pattern
- Fase P1: Retry Manager (1s→2s→4s), Correlation Logger (UUID), Dead Letter Queue
- Fase P2: Notification Metrics (p50/p95/p99), Health Check API, Dashboard Widget

**Diagramas Criados**
- Diagrama de 3 fases (ASCII art)
- Fluxo de dados (Mermaid)
- Ciclo de vida da notificação
- Arquitetura do sistema completo

**O que deu certo**
- Documentação consistente com padrões do projeto (português)
- Referências cruzadas entre documentos
- Diagramas claros explicando fluxo e componentes
- Troubleshooting guide incluído

**Regras locais para o futuro (lições acionáveis)**
- Sempre documentar nova arquitetura em 3 níveis: overview, detalhada, troubleshooting
- Manter consistência de linguagem (português para docs, inglês para código)
- Incluir diagramas Mermaid quando possível para fluxos complexos
- Criar arquivo de delivery em `docs/past_deliveries/` para grandes features

**Pendências / próximos passos**
- Push da branch: `git push origin docs/bot-notification-refactor`
- Criar PR usando template
- Solicitar review
- Merge para main

---

## Memory Entry — 2026-02-16 00:55
**Contexto / Objetivo**
- Corrigir falha de parsing Markdown no bot Telegram (20:30)
- Identificar root cause e implementar fixes imediatos
- Documentar arquitetura de melhorias futuras

**O que foi feito (mudanças)**
- Branch: Main (deploy direto para produção)
- Arquivos alterados:
  - `server/bot/tasks.js` — escapados 7 caracteres `!` em mensagens MarkdownV2
  - `.migrations/add_dead_letter_queue.sql` — migration idempotente com IF NOT EXISTS
  - `server/services/deadLetterQueue.js` — alterado onConflict para 'correlation_id'
  - `scripts/validate-dlq-fix.sh` — criado script de validação
- Arquivos criados:
  - `plans/telegram-notification-fixes-plan.md` — plano de fixes imediato
  - `plans/telegram-architecture-improvements.md` — arquitetura de melhorias futuras

**Root Cause Identificado**
1. Markdown escaping: Literais de template com `!` não escapados (ex: `Hora do seu remédio!`)
2. DLQ schema: Falta UNIQUE constraint para upsert com onConflict

**O que deu certo**
- Vercel logs funcionando com VERCEL_TOKEN
- Deploy automático funcionando (código já incluiu escapeMarkdown anterior)
- Notificação 21:52 enviada com sucesso após fix
- DLQ funcionando corretamente (notification enqueued to DLQ)

**O que não deu certo / riscos**
- Stale deployments: Vercel estava rodando código antigo sem o escape fix
- Múltiplos `!` em mensagens não detectados inicialmente (precisou de 3 iterações)
- Migration original sem idempotência falhou com "policy already exists"

**Regras locais para o futuro (lições acionáveis)**
- TODAS as mensagens MarkdownV2 DEVEM usar escapeMarkdown() ou telegramFormatter
- Literal `!` em templates string é字符 especial em MarkdownV2 e DEVE ser escapado como `\!`
- Migrations DEVEM usar IF NOT EXISTS para políticas RLS e constraints
- Usar `grep -n "![^}]" server/bot/*.js` para encontrar caracteres não escapados
- Commit inicial com escapeMarkdown existía mas código não foi redeployado

**Documentação Atualizada**
- `docs/TELEGRAM_BOT_NOTIFICATION_SYSTEM.md` - Precisa de atualização com lessons learned
- `server/BOT README.md` - Verificar seção de troubleshooting

**Pendências / próximos passos**
- Implementar Fase 1: Retry mechanism + telegramFormatter library
- Implementar Fase 2: Alerting + métricas
- Atualizar docs/TELEGRAM_BOT_NOTIFICATION_SYSTEM.md com novos aprendizados
- Adicionar testes unitários para formatação de mensagens

---

*Última atualização: 2026-02-16 | Correção de parsing Markdown e DLQ schema*
