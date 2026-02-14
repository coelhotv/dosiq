# 🔧 Fix: Correção dos Alerts do Telegram em Produção

## 🎯 Resumo

Esta PR corrige o problema onde os alerts do bot Telegram não funcionavam em produção (deploy Vercel). O root cause foi identificado como configuração inadequada de variáveis de ambiente em ambiente serverless.

---

## 📋 Tarefas Implementadas

### ✅ Fix 1 - Configuração Serverless do Supabase
- [x] `dotenv.config()` agora é condicional (apenas em desenvolvimento)
- [x] Removido `process.exit(1)` que terminava a função serverless
- [x] Agora usa `throw new Error()` para propagar erros corretamente

### ✅ Fix 2 - Timeout para Funções Serverless
- [x] Adicionado `maxDuration: 60` em `vercel.json` para funções que processam múltiplos usuários
- [x] Configuração adequada para o endpoint `/api/notify`

### ✅ Fix 3 - Logging Diagnóstico
- [x] Adicionado logging em `api/notify.js` para verificação de variáveis de ambiente
- [x] Facilita debug em produção sem expor valores sensíveis

---

## 🔍 Root Cause Analysis

| Problema | Causa | Solução |
|----------|-------|---------|
| Bot não respondia | `dotenv.config()` tentava carregar `.env` inexistente | Condicional baseado em `NODE_ENV` |
| Função crashava | `process.exit(1)` terminava execução | Substituído por `throw new Error()` |
| Timeout em produção | Funções longas sem configuração | Adicionado `maxDuration: 60` no `vercel.json` |

---

## 🔧 Arquivos Alterados

```
server/
└── services/
    └── supabase.js          # Dotenv condicional + remoção de process.exit()

api/
└── notify.js                # Logging diagnóstico

vercel.json                  # Configuração de timeout para funções serverless
```

---

## ✅ Checklist de Verificação

### Código
- [x] Todos os testes passam (`npm run test:critical` - 149 testes)
- [x] Lint sem erros (`npm run lint`)
- [x] Build bem-sucedido (`npm run build`)

### Serverless
- [x] Dotenv não é chamado em produção
- [x] Erros são propagados via throw, não exit
- [x] Timeout configurado para funções longas

### Documentação
- [x] Memory atualizada em `.roo/rules/memory.md`

---

## 🚀 Como Testar

```bash
# 1. Verificar lint
npm run lint

# 2. Executar testes críticos
npm run test:critical

# 3. Build de produção
npm run build

# 4. Deploy e verificar logs do Vercel
# Acessar: https://vercel.com/dashboard → Logs
```

---

## 🔗 Issues Relacionadas

- Fix para problema de alerts do Telegram em produção
- Relacionado ao bot do Telegram

---

## 📝 Notas para Reviewers

1. **Serverless:** Verificar que `dotenv` é condicional e não quebra em produção
2. **Erros:** Confirmar que `throw` é usado ao invés de `process.exit()`
3. **Timeout:** Validar que `maxDuration` está configurado corretamente no `vercel.json`

---

## 🏷️ Versão

**Tipo:** Patch (`2.8.0` → `2.8.1`)
**Tag sugerida:** `v2.8.1`

---

/cc @reviewers
