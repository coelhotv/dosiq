# Análise do Workflow Gemini Code Assist — Issues CRITICAL

> **Data:** 2026-02-26  
> **Contexto:** GATE 5.3 — Sprint 5.3 Finalização  
> **PR Afetado:** #223

---

## 🎯 Problema Central

O workflow de integração com Gemini Code Assist possui um **impasse lógico** quando issues **CRITICAL** ou **HIGH** são detectados:

1. **Bloqueio Inicial:** Issues CRITICAL/HIGH bloqueiam o workflow (correto)
2. **Correção:** Desenvolvedor corrige os issues e faz push
3. **Re-review:** Gemini deve reavaliar e marcar issues como resolvidos
4. **Desbloqueio:** Workflow deveria liberar, mas **permanece bloqueado**

---

## 🔍 Análise do Fluxo Atual

### Jobs do Workflow (`.github/workflows/gemini-review.yml`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DE REVISÃO                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. detect              → Detecta review do Gemini ou novo commit      │
│  2. poll-review         → Polling para review (se não detectado)       │
│  3. parse               → Extrai e categoriza issues                   │
│  4. upload-to-blob      → Upload JSON para Vercel Blob                 │
│  5. persist             → Persiste no Supabase via Vercel API          │
│  6. check-critical  ⚠️  → **BLOQUEIA** se CRITICAL/HIGH encontrados    │
│  7. notify-agents       → Notifica agents externos                     │
│  8. auto-fix            → Aplica correções automáticas (se aplicável)  │
│  9. validate            → Executa lint, tests, build                   │
│  10. apply-labels       → Aplica labels no PR                          │
│  11. summary            → Posta/atualiza resumo no PR                  │
│  12. trigger-rereview   → Trigger re-review em novos commits           │
│  13. create-issues  ❌  → **SÓ executa se NÃO houver blocking issues** │
│  14. check-resolutions  → Verifica resoluções via Vercel API           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Job Crítico: `check-critical` (linhas 636-693)

```yaml
check-critical:
  name: Check Critical/High Issues
  needs: [detect, parse, persist]
  if: always() && needs.persist.result == 'success'
  outputs:
    has_blocking_issues: ${{ steps.check.outputs.has_blocking_issues }}
    has_critical: ${{ steps.check.outputs.has_critical }}
    # ... outros outputs
```

**Comportamento:**
- Executa o script `check-critical-issues.cjs`
- Seta `has_blocking_issues=true` se encontrar CRITICAL ou HIGH (security/performance)
- Posta comentário de bloqueio no PR

### Job Afetado: `create-issues` (linhas 1025-1141)

```yaml
create-issues:
  name: Create GitHub Issues via Vercel API
  needs: [detect, parse, upload-to-blob, persist, check-critical]
  # ❌ SÓ executa se NÃO houver issues bloqueantes
  if: always() && ... && needs.check-critical.outputs.has_blocking_issues != 'true'
```

**Problema:** Este job é **skippado** quando há issues bloqueantes, mas não há mecanismo automático para:
1. Re-executar o `check-critical` após correções
2. Atualizar o status de `has_blocking_issues` quando issues são resolvidos

---

## 📋 Issues Detectados no PR #223

| Prioridade | Arquivo | Linha | Descrição | Correção Aplicada |
|------------|---------|-------|-----------|-------------------|
| 🚨 CRITICAL | `tasks.js` | 716 | `logSuccessfulNotification` faltando após envio de alerta crítico | ✅ Adicionada chamada correta |
| 🚨 CRITICAL | `tasks.js` | 745 | `logSuccessfulNotification` faltando após envio de alerta proativo | ✅ Adicionada chamada correta |
| 🚨 CRITICAL | `Consultation.jsx` | 132 | Função `uploadAndShare` não existe → corrigir para `shareReport` | ✅ Corrigido para `shareReport` com destructuring |
| ⚠️ MEDIUM | `Dashboard.jsx` | 863 | Estilos inline no botão — mover para CSS Modules | 🔜 Criar issue separada |

---

## 💡 Soluções Propostas

### Solução 1: Re-trigger Automático do Workflow (Recomendada)

**Modificar o job `trigger-rereview` para também re-executar o workflow completo:**

```yaml
trigger-rereview:
  name: Trigger Re-review
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request' && github.event.action == 'synchronize'
  steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Check and Trigger Re-review
      uses: actions/github-script@v7
      with:
        script: |
          const { shouldTriggerRereview, triggerRereview } = require('./.github/scripts/trigger-re-review.cjs');
          
          const shouldTrigger = await shouldTriggerRereview(
            context.payload.pull_request.number,
            github,
            context
          );
          
          if (shouldTrigger) {
            console.log('Alterações significativas detectadas, solicitando re-review...');
            await triggerRereview(
              context.payload.pull_request.number,
              github,
              context
            );
            
            // 🆕 NOVO: Disparar evento para re-executar workflow
            await github.rest.actions.createWorkflowDispatch({
              owner: context.repo.owner,
              repo: context.repo.repo,
              workflow_id: 'gemini-review.yml',
              ref: context.payload.pull_request.head.ref,
              inputs: {
                pr_number: context.payload.pull_request.number.toString()
              }
            });
          }
```

**Vantagens:**
- Re-executa todo o workflow com novo commit
- `check-critical` reavalia issues do zero
- Não depende de estado anterior

**Desvantagens:**
- Pode criar loop se não houver mudanças significativas
- Custo de execução do workflow completo

---

### Solução 2: Verificação de Resolução no `check-critical`

**Modificar o script `check-critical-issues.cjs` para verificar se issues foram resolvidos:**

```javascript
// .github/scripts/check-critical-issues.cjs

async function checkCriticalIssues({ reviewFile, github, context, core, prNumber }) {
  // ... código existente ...
  
  // 🆕 NOVO: Verificar no Supabase se issues anteriores foram resolvidos
  const { data: resolvedIssues } = await supabase
    .from('gemini_reviews')
    .select('id, status, priority')
    .eq('pr_number', prNumber)
    .eq('status', 'resolved')
    .in('priority', ['CRITICAL', 'HIGH']);
  
  // Comparar com issues atuais
  const previouslyBlocking = resolvedIssues.filter(i => 
    ['CRITICAL', 'HIGH'].includes(i.priority)
  );
  
  if (previouslyBlocking.length > 0 && currentCritical.length === 0) {
    console.log('✅ Issues anteriormente bloqueantes foram resolvidos');
    core.setOutput('has_blocking_issues', 'false');
    return { hasBlockingIssues: false };
  }
  
  // ... resto do código ...
}
```

**Vantagens:**
- Mais preciso — verifica estado real no banco
- Não re-executa workflow inteiro

**Desvantagens:**
- Requer integração com Supabase no script
- Complexidade adicional

---

### Solução 3: Comando Manual `/gemini review`

**Implementar suporte a comando manual no workflow:**

```yaml
# Adicionar ao job detect
- name: Check for Manual Trigger
  id: manual
  uses: actions/github-script@v7
  with:
    script: |
      if (context.eventName === 'issue_comment') {
        const comment = context.payload.comment.body;
        const isManualTrigger = comment.includes('/gemini review');
        core.setOutput('manual_trigger', isManualTrigger);
      }

# Modificar condição do check-critical
if: always() && (needs.persist.result == 'success' || steps.manual.outputs.manual_trigger == 'true')
```

**Vantagens:**
- Controle manual pelo desenvolvedor
- Simplicidade de implementação

**Desvantagens:**
- Requer ação manual
- Pode ser esquecido

---

### Solução 4: Timeout com Reavaliação (Híbrida)

**Adicionar job de reavaliação automática após N minutos:**

```yaml
re-evaluate:
  name: Re-evaluate Critical Issues
  runs-on: ubuntu-latest
  needs: [check-critical]
  if: always() && needs.check-critical.outputs.has_blocking_issues == 'true'
  steps:
    - name: Wait for Corrections
      run: sleep 300  # 5 minutos
    
    - name: Re-check Issues
      uses: actions/github-script@v7
      with:
        script: |
          // Re-executar verificação
          // Se issues resolvidos, atualizar status
```

**Vantagens:**
- Automático após timeout
- Não requer intervenção manual

**Desvantagens:**
- Atraso na execução
- Recursos consumidos durante espera

---

## 🔍 Nova Descoberta: Fluxo Real de Resolução

Após análise detalhada do PR #223, descobrimos o **fluxo real** de trabalho do mantenedor:

### Fluxo Manual Atual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUXO REAL DE RESOLUÇÃO                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Gemini posta review com issues CRITICAL                             │
│  2. Workflow bloqueia (check-critical: has_blocking_issues=true)        │
│  3. Desenvolvedor corrige código                                        │
│  4. Desenvolvedor faz push do commit de correção                        │
│  5. Desenvolvedor responde inline no comentário do Gemini:              │
│     "erro resolvido no commit {sha}"                                    │
│  6. Desenvolvedor marca thread como **RESOLVIDA** (resolved)            │
│  7. Gemini confirma resolução em resposta                               │
│  8. Workflow CONTINUA BLOQUEADO ❌ (não vê threads resolvidas)          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Evidências do PR #223

**Comentários resolvidos confirmados pelo Gemini:**

| ID | Arquivo | Linha | Status | Confirmação do Gemini |
|----|---------|-------|--------|----------------------|
| 2861813033 | `tasks.js` | 716 | ✅ Resolvido | "Sim, o erro foi resolvido. A chamada para `logSuccessfulNotification` foi adicionada..." |
| 2861813038 | `tasks.js` | 765 | ✅ Resolvido | "Sim, `coelhotv`. Verifiquei o commit `013d31b` e a chamada... foi adicionada corretamente" |
| 2861813039 | `Consultation.jsx` | 132 | ✅ Resolvido | "Obrigado por avisar! Analisei o commit `013d31b` e confirmo que a correção... foi aplicada" |

**Problema:** O workflow NÃO verifica o estado das review threads (resolved/unresolved).

---

## 🔧 Solução Implementada (Solução 5: Verificação de Threads Resolvidas)

### Implementação no Workflow (`.github/workflows/gemini-review.yml`)

```yaml
# No job 'parse', step 'Fetch Gemini Comments':

# 🆕 Buscar review threads para verificar status de resolução
const { data: reviewThreads } = await github.rest.pulls.listReviewThreads({
  owner: context.repo.owner,
  repo: context.repo.repo,
  pull_number: prNumber
});

// Criar set de IDs de comentários em threads resolvidas
const resolvedCommentIds = new Set();
reviewThreads.forEach(thread => {
  if (thread.resolved) {
    thread.comments.forEach(comment => {
      resolvedCommentIds.add(comment.id);
    });
  }
});

console.log(`🔍 Encontradas ${resolvedCommentIds.size} threads resolvidas`);

// 🆕 Filtrar comentários resolvidos
const geminiReviewComments = reviewComments.filter(c => {
  const isGemini = c.user.login === 'gemini-code-assist[bot]';
  const isResolved = resolvedCommentIds.has(c.id);
  if (isGemini && isResolved) {
    console.log(`✅ Ignorando comentário resolvido: ${c.path}:${c.line}`);
  }
  return isGemini && !isResolved;
});
```

### Como Funciona

1. **Busca Threads:** Usa `github.rest.pulls.listReviewThreads()` para buscar todas as threads do PR
2. **Identifica Resolvidas:** Para cada thread onde `thread.resolved === true`, coleta os IDs dos comentários
3. **Filtra Comentários:** Exclui comentários cujos IDs estão no set de resolvidos
4. **Parseia apenas ativos:** O resto do workflow processa apenas issues não-resolvidos

### Vantagens

- ✅ **Integração natural** com fluxo de trabalho existente do mantenedor
- ✅ **Sem necessidade de comandos manuais** (`/gemini review`)
- ✅ **Reconhece resolução** quando mantenedor marca thread como resolved
- ✅ **Não requer re-executar workflow** — próxima execução já vê threads resolvidas

---

## 📊 Status do PR #223

| Item | Status |
|------|--------|
| Correções CRITICAL aplicadas | ✅ Sim (commit `013d31b`) |
| Threads marcadas como resolvidas | ✅ Sim (3 threads) |
| Gemini confirmou resoluções | ✅ Sim |
| Workflow atualizado para verificar threads | ✅ Implementado |
| Merge disponível | ⏳ Aguardando re-execução do workflow |

### Correções Aplicadas (Commit `013d31b`)

1. **tasks.js:717** — Adicionado `await logSuccessfulNotification(userId, null, 'stock_alert', { messageId: result.messageId })`
2. **tasks.js:746** — Adicionado `await logSuccessfulNotification(userId, null, 'proactive_stock_alert', { messageId: result.messageId })`
3. **Consultation.jsx:129** — Corrigido para `const { url: shareUrl } = await shareService.shareReport(pdfBlob, { filename: 'consulta-medica.pdf' })`

**Bônus:** Integração com DLQ adicionada para falhas nos envios de estoque proativo e crítico.

---

## 📝 Próximos Passos

1. **Push das alterações do workflow** — Commit com a verificação de threads resolvidas
2. **Aguardar re-execução do workflow** — Pode ser necessário novo commit ou `/gemini review`
3. **Verificar desbloqueio** — Workflow deve passar `check-critical` sem issues bloqueantes
4. **Merge com `--no-ff`** — Após aprovação completa
5. **Validação pós-merge** — `npm run validate:full` na `main`

---

## 🔗 Referências

- [`.github/workflows/gemini-review.yml`](../.github/workflows/gemini-review.yml)
- [`docs/standards/GEMINI_INTEGRATION.md`](docs/standards/GEMINI_INTEGRATION.md)
- [PR #223](https://github.com/coelhotv/meus-remedios/pull/223)
- [`.github/scripts/check-critical-issues.cjs`](../.github/scripts/check-critical-issues.cjs)
- [GitHub API: List review threads](https://docs.github.com/en/rest/pulls/comments?apiVersion=2022-11-28#list-review-comments-on-a-pull-request)

---

## 🎓 Lições Aprendidas

### O que funcionou
- ✅ Manter documentação detalhada do fluxo real (não assumir)
- ✅ Analisar comentários reais do PR via `gh api`
- ✅ Verificar estado das threads, não apenas presença de comentários

### O que evitar
- ❌ Assumir que novo commit automaticamente re-executa workflow com dados frescos
- ❌ Depender apenas de parsing de comentários sem considerar estado de resolução
- ❌ Ignorar o fluxo de trabalho manual já estabelecido pelo time

### Melhorias Futuras
- 🔄 Cache de threads resolvidas para evitar re-processamento
- 🔄 Notificação automática quando todas as threads críticas forem resolvidas
- 🔄 Dashboard de issues do Gemini com status de resolução
