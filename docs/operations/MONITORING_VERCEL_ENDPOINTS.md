# Monitoramento de Endpoints Vercel

> **Documentação operacional dos endpoints da arquitetura Gemini Code Assist**  
> **Versão:** 1.0.0 | Última atualização: 2026-02-23

---

## 📋 Visão Geral

Esta documentação descreve como monitorar os endpoints Vercel da nova arquitetura segura (Actions → Vercel → Supabase) utilizada pela integração Gemini Code Assist.

### Endpoints Monitorados

| Endpoint | Método | Função |
|----------|--------|--------|
| `/api/gemini-reviews/persist` | `POST` | Persiste reviews no Supabase com deduplicação por hash |
| `/api/gemini-reviews/create-issues` | `POST` | Cria issues no GitHub a partir dos reviews |
| `/api/gemini-reviews/update-status` | `POST` | Atualiza status de issues existentes |

### Fluxo de Dados

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  GitHub Actions │───▶│  Vercel API     │───▶│  Supabase       │
│  (gemini-review │    │  (Serverless    │    │  (PostgreSQL +  │
│   .yml)         │    │   Functions)    │    │   RLS)          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  Vercel Blob    │
                       │  (Cache/Dados)  │
                       └─────────────────┘
```

---

## 🖥️ Dashboard Vercel

### Acesso

**URL:** https://vercel.com/coelhotv/dosiq

#### Navegação para Logs

1. Acesse o dashboard do projeto
2. Clique na aba **"Functions"** no menu lateral
3. Selecione o ambiente (Production/Preview)
4. Use o campo de busca para filtrar por path

### Filtrando Logs por Path

Para visualizar logs específicos dos endpoints de Gemini reviews:

**Filtro recomendado:**
```
/api/gemini-reviews/*
```

**Para endpoint específico:**
```
/api/gemini-reviews/persist
/api/gemini-reviews/create-issues
/api/gemini-reviews/update-status
```

#### Interface do Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  Vercel Dashboard - Functions                                   │
├─────────────────────────────────────────────────────────────────┤
│  [Buscar...] [Environment: Production ▼] [Time: Last Hour ▼]    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🔍 /api/gemini-reviews/persist                         │   │
│  │  200 OK • 23:45:02 • 145ms • 2.3KB                     │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  Request ID: req_abc123xyz                              │   │
│  │  Method: POST                                           │   │
│  │  Status: 200                                            │   │
│  │  Duration: 145ms                                        │   │
│  │  Cold Start: No                                         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  [Request Headers] [Response] [Logs] [Errors]           │   │
│  │  • Authorization: Bearer ****                           │   │
│  │  • Content-Type: application/json                       │   │
│  │  • X-RateLimit-Remaining: 58                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Interpretação de Status Codes

| Status | Significado | Ação Requerida |
|--------|-------------|----------------|
| **200** | Sucesso | ✅ Nenhuma ação |
| **400** | Bad Request (dados inválidos) | Verificar schema Zod no payload |
| **401** | Não autorizado (JWT inválido) | Verificar `VERCEL_GITHUB_ACTIONS_SECRET` |
| **429** | Rate limit excedido (60 req/min) | Verificar se não há loops ou excesso de requisições |
| **500** | Erro interno do servidor | Verificar logs detalhados no Vercel |

### Visualizando Logs Detalhados

Clique em qualquer execução para expandir:

1. **Request**: Headers e body da requisição
2. **Response**: Body e headers da resposta
3. **Logs**: Logs do console (`console.log`, `console.error`)
4. **Errors**: Stack traces de exceções

---

## 📊 Métricas Importantes

### Cold Starts

**O que é:** Tempo de inicialização da função serverless quando não há instância quente.

**Valores esperados:**
- **Normal:** 50-200ms
- **Alerta:** >500ms
- **Crítico:** >1000ms

**Onde ver no Vercel:**
```
Dashboard → Functions → [Selecionar execução] → "Cold Start: Yes"
```

**Dica:** Cold starts frequentes indicam baixo tráfego (normal para este caso de uso) ou timeout das instâncias.

### Rate Limiting

**Limite:** 60 requisições por minuto por IP

**Headers de resposta:**
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1708723200
```

**Monitoramento:**
- Verificar se `X-RateLimit-Remaining` está próximo de 0 frequentemente
- Múltiplos 429 indicam possível loop ou configuração errada

### Erros por Categoria

#### Erros 401 (Autenticação)

**Causas comuns:**
- `VERCEL_GITHUB_ACTIONS_SECRET` expirado ou incorreto
- Token JWT malformado
- Secret não configurado no Vercel

**Diagnóstico rápido:**
```bash
# Verificar se secret está configurado
vercel env ls | grep VERCEL_GITHUB_ACTIONS_SECRET
```

#### Erros 500 (Erros Internos)

**Causas comuns:**
- Falha na conexão com Supabase
- Erro no schema Zod (dados inesperados)
- Problema com Vercel Blob
- Timeout da função (>10s no plano Hobby)

**Diagnóstico:**
```
Dashboard → Functions → [Execução com erro] → Aba "Errors"
```

### Latência

**Valores esperados por endpoint:**

| Endpoint | Latência Normal | Alerta |
|----------|-----------------|--------|
| `/persist` | 100-300ms | >500ms |
| `/create-issues` | 500-1500ms | >3000ms |
| `/update-status` | 100-200ms | >500ms |

**Nota:** `/create-issues` é mais lento pois faz chamadas à API do GitHub.

---

## 🔍 Logs GitHub Actions

### Acesso aos Logs

#### Via Web (GitHub)

1. Acesse: `https://github.com/coelhotv/dosiq/actions`
2. Filtre por workflow: **"Gemini Code Review Parser"**
3. Clique no run desejado

#### Via CLI (gh)

```bash
# Listar últimos runs do workflow
gh run list --workflow=gemini-review.yml --limit 10

# Ver detalhes de um run específico
gh run view RUN_ID

# Ver apenas logs de falhas
gh run view RUN_ID --log-failed
```

### Jobs a Monitorar

O workflow `gemini-review.yml` contém os seguintes jobs:

| Job | Função | Logs Importantes |
|-----|--------|------------------|
| `detect` | Detecta review do Gemini | "Gemini Review: true/false" |
| `poll-review` | Polling para review | "Attempt X/20: Checking..." |
| `parse` | Parseia comentários | "Total Issues: N" |
| `persist` | Chama `/api/gemini-reviews/persist` | "Calling persist endpoint..." |
| `create-issues` | Chama `/api/gemini-reviews/create-issues` | Response status e dados |
| `check-resolutions` | Verifica issues resolvidos | Issues atualizadas |

### Identificando Erros nas Chamadas

No job `persist`, procure por:

```
✅ Sucesso:
  Calling persist endpoint...
  Response: 200
  Data persisted successfully

❌ Falha:
  Calling persist endpoint...
  Response: 401
  Error: Authentication failed
```

No job `create-issues`, procure por:

```
✅ Sucesso:
  Calling create-issues endpoint...
  Response: 200
  Created issues: ["#123", "#124"]

❌ Falha:
  Calling create-issues endpoint...
  Response: 500
  Error: Failed to create GitHub issue
```

### Variáveis de Debug

Para debug avançado, adicione no workflow:

```yaml
- name: Debug Endpoint Call
  run: |
    echo "URL: ${{ steps.endpoint.outputs.url }}"
    echo "Status: ${{ steps.call.outputs.status }}"
    echo "Response: ${{ steps.call.outputs.response }}"
```

---

## 🚨 Alertas Recomendados

### Taxa de Erro > 5%

**Configuração (Vercel Analytics):**
```
Metric: Error Rate
Threshold: > 5%
Window: 5 minutes
Notification: Email/Slack
```

**Verificação manual:**
```bash
# Contar erros nas últimas 100 execuções
vercel logs dosiq --path=/api/gemini-reviews/persist --limit=100 | grep -c "Status: 5"
```

### Latência Média > 3 Segundos

**Configuração:**
```
Metric: Function Duration (p95)
Threshold: > 3000ms
Window: 10 minutes
```

**Nota:** Latência alta em `/create-issues` pode indicar:
- Rate limiting da API do GitHub
- Muitos issues sendo criados de uma vez
- Problemas de rede

### Rate Limit Atingido Frequentemente

**Sinal de alerta:**
- Múltiplos status 429 em sequência
- `X-RateLimit-Remaining: 0` consistentemente

**Ação imediata:**
1. Verificar se há loops no workflow
2. Verificar se múltiplos runs estão em paralelo
3. Considerar implementar backoff exponencial

### Alertas de Infraestrutura

| Alerta | Threshold | Ação |
|--------|-----------|------|
| Cold starts >50% | > 50% das requisições | Considerar Edge Config ou cron job de keep-alive |
| Timeout de função | > 1% das execuções | Otimizar código ou aumentar timeout |
| Blob errors | > 5 erros/hora | Verificar `VERCEL_BLOB_TOKEN` e quotas |

---

## 🔧 Troubleshooting

### JWT Expirado ou Inválido (401)

**Sintoma:**
```
Response: 401
Error: Invalid token
```

**Diagnóstico:**
```bash
# 1. Verificar se secret existe no Vercel
vercel env ls

# 2. Verificar se secret está sincronizado
vercel env pull

# 3. Verificar se GitHub Actions tem o secret correto
gh secret list | grep VERCEL_GITHUB_ACTIONS_SECRET
```

**Resolução:**
1. Gere novo JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Atualize em ambos os lugares:
   - Vercel: `vercel env add VERCEL_GITHUB_ACTIONS_SECRET`
   - GitHub: `gh secret set VERCEL_GITHUB_ACTIONS_SECRET`

### 404 nos Endpoints

**Sintoma:**
```
Response: 404
Error: Not Found
```

**Diagnóstico:**
```bash
# Verificar se arquivos existem
ls -la api/gemini-reviews/

# Verificar deploy
vercel --version
vercel --prod
```

**Causas comuns:**
1. **Arquivos não commitados:**
   ```bash
   git status
   git add api/gemini-reviews/
   git commit -m "feat: add gemini-reviews endpoints"
   ```

2. **Deploy falhou:**
   - Verificar logs de build no Vercel
   - Verificar se `vercel.json` está configurado

3. **Path incorreto:**
   - Verificar se a URL está correta
   - Verificar rewrites em `vercel.json`

### 429 Rate Limit

**Sintoma:**
```
Response: 429
Error: Rate limit exceeded
Retry-After: 60
```

**Diagnóstico:**
```bash
# Verificar quantidade de requisições recentes
vercel logs dosiq --path=/api/gemini-reviews/ --limit=200 | grep -c "POST"
```

**Resolução:**
1. **Implementar retry com backoff:**
   ```javascript
   const delay = Math.pow(2, attempt) * 1000;
   await new Promise(r => setTimeout(r, delay));
   ```

2. **Verificar loops no workflow:**
   - Verificar se `poll-review` não está chamando endpoints em loop
   - Verificar se não há múltiplos triggers simultâneos

3. **Considerar rate limit por IP:**
   - O limite é 60 req/min por IP
   - GitHub Actions pode ter IP dinâmico

### Erros no Vercel Blob

**Sintoma:**
```
Error: Failed to fetch from blob storage
```

**Diagnóstico:**
```bash
# Verificar token
vercel env ls | grep VERCEL_BLOB_TOKEN

# Verificar quota
curl -H "Authorization: Bearer $VERCEL_BLOB_TOKEN" \
  https://api.vercel.com/v1/blob
```

**Resolução:**
1. Verificar se `VERCEL_BLOB_TOKEN` está configurado:
   ```bash
   vercel env add VERCEL_BLOB_TOKEN
   ```

2. Verificar quotas na dashboard Vercel

3. Verificar se a URL do blob é válida:
   ```javascript
   // No código
   const blobUrl = new URL(blobUrlString);
   if (!blobUrl.hostname.endsWith('.public.blob.vercel-storage.com')) {
     throw new Error('Invalid blob URL');
   }
   ```

### Timeout da Função (504)

**Sintoma:**
```
Response: 504
Error: FUNCTION_INVOCATION_TIMEOUT
```

**Causas comuns:**
1. **Query Supabase lenta:**
   - Verificar índices na tabela `gemini_reviews`
   - Verificar queries N+1

2. **Chamada GitHub lenta:**
   - API do GitHub pode estar lenta
   - Muitos issues sendo criados

3. **Cold start + operação lenta:**
   - Implementar health check periódico
   - Usar Edge Functions para menor cold start

**Resolução:**
1. Aumentar timeout (planos pagos):
   ```json
   // vercel.json
   {
     "functions": {
       "api/gemini-reviews/*.js": {
         "maxDuration": 30
       }
     }
   }
   ```

2. Otimizar queries:
   ```sql
   -- Verificar índices
   CREATE INDEX IF NOT EXISTS idx_gemini_reviews_pr_number 
   ON gemini_reviews(pr_number);
   ```

---

## 💻 Comandos Úteis

### Vercel CLI

```bash
# Ver logs em tempo real
vercel logs dosiq --follow

# Filtrar por path específico
vercel logs dosiq --path=/api/gemini-reviews/persist

# Ver logs das últimas 24 horas
vercel logs dosiq --since=24h

# Ver apenas erros
vercel logs dosiq --level=error

# Ver logs de deploy específico
vercel logs dosiq --deployment=DEPLOYMENT_ID
```

### GitHub CLI

```bash
# Listar runs do workflow
gh run list --workflow=gemini-review.yml --limit 10

# Ver último run
gh run view --workflow=gemini-review.yml

# Ver logs de um run específico
gh run view RUN_ID --log

# Ver apenas falhas
gh run view RUN_ID --log-failed

# Rerun de um workflow falho
gh run rerun RUN_ID

# Rerun com debug
gh run rerun RUN_ID --debug
```

### cURL (Testes Manuais)

```bash
# Testar endpoint persist (com auth)
curl -X POST https://dosiq.vercel.app/api/gemini-reviews/persist \
  -H "Authorization: Bearer $VERCEL_GITHUB_ACTIONS_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "pr_number": 123,
    "commit_sha": "abc123",
    "issues": []
  }' \
  -v

# Testar sem auth (deve retornar 401)
curl -X POST https://dosiq.vercel.app/api/gemini-reviews/persist \
  -H "Content-Type: application/json" \
  -d '{}'

# Ver headers de rate limit
curl -I https://dosiq.vercel.app/api/gemini-reviews/persist
```

### Scripts de Monitoramento

```bash
#!/bin/bash
# monitor-endpoints.sh - Script para monitoramento rápido

echo "=== Monitoramento Endpoints Gemini ==="
echo ""

# Verificar últimas falhas
echo "1. Últimas falhas (última hora):"
vercel logs dosiq --path=/api/gemini-reviews/ --since=1h | grep -E "(Status: [45]|Error)" | head -10

echo ""
echo "2. Status codes (últimos 100 logs):"
vercel logs dosiq --path=/api/gemini-reviews/ --limit=100 | grep -oE "Status: [0-9]+" | sort | uniq -c | sort -rn

echo ""
echo "3. Último run do GitHub Actions:"
gh run list --workflow=gemini-review.yml --limit 1 --json status,conclusion,createdAt

echo ""
echo "4. Cold starts (últimos 50):"
vercel logs dosiq --path=/api/gemini-reviews/ --limit=50 | grep -c "Cold Start: Yes"
```

### Verificação de Saúde

```bash
# Verificar todos os endpoints
check_endpoints() {
  local base="https://dosiq.vercel.app"
  local token="$VERCEL_GITHUB_ACTIONS_SECRET"
  
  for endpoint in persist create-issues update-status; do
    echo "Checking /api/gemini-reviews/$endpoint..."
    
    # HEAD request para verificar se endpoint responde
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $token" \
      "$base/api/gemini-reviews/$endpoint")
    
    if [ "$status" = "200" ] || [ "$status" = "400" ]; then
      echo "  ✅ OK (status: $status)"
    elif [ "$status" = "401" ]; then
      echo "  ⚠️  Auth error (401)"
    else
      echo "  ❌ Error (status: $status)"
    fi
  done
}

check_endpoints
```

---

## 📚 Referências Rápidas

### URLs Importantes

| Recurso | URL |
|---------|-----|
| Dashboard Vercel | https://vercel.com/coelhotv/dosiq |
| Actions GitHub | https://github.com/coelhotv/dosiq/actions |
| Supabase Dashboard | https://app.supabase.com/project/_/editor |

### Comandos de Emergência

```bash
# Rollback rápido para deploy anterior
vercel --prod --rollback

# Redeploy forçado
vercel --prod --force

# Limpar cache e redeploy
vercel --prod --no-cache
```

### Contatos e Escalation

| Problema | Ação |
|----------|------|
| Indisponibilidade total | Verificar status.vercel.com |
| Erros persistentes | Reverter para último deploy estável |
| Suspeita de ataque | Habilitar Vercel Firewall |

---

*Documentação criada em: 2026-02-23*  
*Mantenedor: DevOps Team*  
*Próxima revisão: 2026-03-23*
