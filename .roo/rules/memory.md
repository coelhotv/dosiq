

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

*Última atualização: 2026-02-14 | Fix para produção: dotenv serverless + timeout config*
