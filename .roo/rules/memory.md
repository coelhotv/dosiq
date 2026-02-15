

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

*Última atualização: 2026-02-15 | Documentação do sistema de notificações v3.0.0*
