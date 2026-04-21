# Plano de Evolução: Gemini Code Assist Integration

> **Fases P2 → P3 → P4 da integração GitHub Actions + Gemini Code Assist**
> **Versão:** 1.4.0 | Última atualização: 2026-02-22
> **Status:** ✅ Produção | **Sprints 3 & 4 Concluídos**
> **Próxima Fase:** P2.4 / P3.3 / P4.2-5

---

## 📋 Visão Geral

Este documento define as próximas fases de evolução da integração com Gemini Code Assist, priorizando funcionalidades **GitHub-native** e evitando integrações externas (Slack/Discord).

### Comportamento Real do Gemini (Observado)

> **Importante**: Baseado em observações de uso real, o Gemini Code Assist opera de forma **assíncrona**:

1. **Imediato (0-30s)**: Posta um **resumo inicial** na timeline do PR
2. **Gradual (30s-5min)**: Começa a postar **comentários inline** linha por linha
3. **Contínuo**: Vai adicionando comentários até percorrer todos os arquivos
4. **Revisão**: Novos commits **não** disparam revisão automática (apenas triggers manuais `/gemini review` ou `@gemini-code-assist` funcionam)
5. **Noise**: Comentários do workflow atual "sujam" a timeline a cada interação

### Estado Atual (P1 + P2 - Implementados ✅)

| Componente | Status | Arquivo |
|------------|--------|---------|
| Workflow de parsing | ✅ | `.github/workflows/gemini-review.yml` |
| Parser de comentários | ✅ | `.github/scripts/parse-gemini-comments.js` |
| Testes unitários | ✅ | `.github/scripts/__tests__/parse-gemini-comments.test.js` |
| Output estruturado | ✅ | `.gemini-output/review-{pr_number}.json` |
| Documentação | ✅ | `docs/standards/GEMINI_INTEGRATION.md` |

### Fase P2 - Implementação Concluída ✅

| Fase | Item | PR | Status |
|------|------|-----|--------|
| P2.1 | Labels Automáticas | #75 | ✅ Em Produção |
| P2.2 | Resumo Editável | #76 | ✅ Em Produção |
| P2.3 | Create Issues | #78, #108 | ✅ Em Produção |
| P2.5 | Trigger Re-review | #77 | ✅ Em Produção |

### Próximas Fases Resumidas

| Fase | Nome | Objetivo Principal | Complexidade |
|------|------|-------------------|--------------|
| **P2** | GitHub-Native Automation | Labels, Issues, Reply to Comments (sem poluir timeline) | Média ✅ |
| **P3** | Intelligence & Metrics | Cache, Path Filters, Analytics | Alta ✅ |
| **P4** | Agent Integration | AI Agents consumindo output | Alta 🔄 |

---

## 🎯 Fase P2: GitHub-Native Automation

### Objetivo
Aprofundar a integração com recursos nativos do GitHub para automação de workflow, rastreamento de issues e comunicação em PRs - **sem poluir a timeline do PR com comentários repetidos**.

---

### P2.1 - Labels Automáticas ✅ IMPLEMENTADO

**Status:** ✅ Em Produção  
**PR:** #75  
**Data:** Sprint 1 (Concluído)

#### Descrição
Aplicar labels automaticamente aos PRs baseado nos issues encontrados pelo Gemini. Esta abordagem **não adiciona comentários à timeline**, apenas atualiza metadados do PR.

#### Labels Implementadas

| Label | Condição | Cor |
|-------|----------|-----|
| `🤖 gemini-reviewed` | Sempre que review completo | `#5319E7` (roxo) |
| `🔧 auto-fix-applied` | Quando auto-fix é aplicado | `#0E8A16` (verde) |
| `👀 needs-human-review` | Issues HIGH/CRITICAL encontrados | `#B60205` (vermelho) |
| `🔒 security-issue` | Issues de segurança detectados | `#D93F0B` (laranja) |
| `⚡ performance-issue` | Issues de performance detectados | `#FBCA04` (amarelo) |
| `📚 needs-docs-update` | Issues relacionados a documentação | `#0075CA` (azul) |

#### Implementação Técnica

**Arquivo:** `.github/scripts/apply-labels.js`

```javascript
/**
 * Aplica labels ao PR baseado nos issues do Gemini
 * @param {Object} reviewData - Dados do review parseado
 * @param {number} prNumber - Número do PR
 * @returns {Promise<string[]>} Labels aplicadas
 */
async function applyLabels(reviewData, prNumber) {
  const labels = ['🤖 gemini-reviewed'];
  
  // Verificar condições
  if (reviewData.summary.auto_fixable > 0) {
    labels.push('🔧 auto-fix-applied');
  }
  
  if (reviewData.summary.critical > 0 || 
      reviewData.issues.some(i => i.priority === 'HIGH')) {
    labels.push('👀 needs-human-review');
  }
  
  if (reviewData.issues.some(i => i.category === 'security')) {
    labels.push('🔒 security-issue');
  }
  
  if (reviewData.issues.some(i => i.category === 'performance')) {
    labels.push('⚡ performance-issue');
  }
  
  if (reviewData.issues.some(i => i.category === 'documentation')) {
    labels.push('📚 needs-docs-update');
  }
  
  return labels;
}
```

**Job no Workflow:** `apply-labels`

#### Critérios de Validação ✅
- [x] Labels são aplicadas automaticamente após review
- [x] Labels removidas quando issues são resolvidos
- [x] Não duplica labels já existentes
- [x] **Não adiciona comentários à timeline**

---

### P2.2 - Resumos Inteligentes (Sem Poluir Timeline) ✅ IMPLEMENTADO

**Status:** ✅ Em Produção  
**PR:** #76  
**Data:** Sprint 1 (Concluído)

#### Problema Atual
O workflow atual posta um **resumo estruturado** em comentário a cada execução, poluindo a timeline do PR.

#### Solução Implementada: Resumo Único Editável

Postar **apenas um comentário** por PR e **editá-lo** em execuções subsequentes, em vez de criar novos comentários.

#### Implementação Técnica

**Arquivo:** `.github/scripts/post-smart-summary.js`

```javascript
/**
 * Posta ou atualiza resumo do review no PR
 * Estratégia: Um único comentário editável por PR
 * 
 * @param {Object} reviewData - Dados do review
 * @param {number} prNumber - Número do PR
 * @param {Object} github - Cliente GitHub
 */
async function postOrUpdateSummary(reviewData, prNumber, github, context) {
  const COMMENT_MARKER = '<!-- GEMINI_REVIEW_SUMMARY -->';
  
  // Buscar comentários existentes do bot
  const { data: comments } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber
  });
  
  // Procurar comentário existente do nosso workflow
  const existingComment = comments.find(c => 
    c.user.login === 'github-actions[bot]' &&
    c.body.includes(COMMENT_MARKER)
  );
  
  const summaryBody = generateSummaryBody(reviewData, COMMENT_MARKER);
  
  if (existingComment) {
    // Atualizar comentário existente
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existingComment.id,
      body: summaryBody
    });
    console.log('Resumo atualizado (comentário editado)');
  } else {
    // Criar novo comentário (primeira vez)
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body: summaryBody
    });
    console.log('Resumo criado (primeira vez)');
  }
}
```

#### Critérios de Validação ✅
- [x] Apenas **um** comentário de resumo por PR
- [x] Comentário é **editado** em execuções subsequentes
- [x] Timestamp mostra última atualização
- [x] Timeline do PR não é poluída

---

### P2.3 - Criação de GitHub Issues (Para Issues Não-Críticos) ✅ IMPLEMENTADO

**Status:** ✅ Em Produção  
**PR:** #78 (Implementação), #108 (Hotfix)  
**Data:** Sprint 2 (Concluído)

#### Descrição
Criar GitHub Issues automaticamente para issues MEDIUM que não podem ser auto-fixados. Esta abordagem move discussões de refactoring para fora da timeline do PR.

#### Hotfix PR #108
Filtro para ignorar "elogios" (compliments) do Gemini na criação de issues. Evita criar issues desnecessárias quando o Gemini apenas elogia o código sem apontar problemas reais.

#### Estratégia de Prioridade

| Prioridade | Ação | Timeline |
|------------|------|----------|
| CRITICAL | Label no PR + notificação | Imediato |
| HIGH | Label no PR + destaque no resumo | Imediato |
| MEDIUM | **GitHub Issue** + Label no PR | Sprint |
| LOW | GitHub Issue (backlog) | Quando possível |

#### Implementação Técnica

**Arquivo:** `.github/scripts/create-issues.js`

```javascript
/**
 * Cria GitHub Issues para issues não-críticos
 * @param {Object} reviewData - Dados do review
 * @param {number} prNumber - Número do PR
 * @returns {Promise<number[]>} IDs das issues criadas
 */
async function createIssuesFromReview(reviewData, prNumber, github, context) {
  const createdIssues = [];
  
  // Filtrar apenas MEDIUM que não são auto-fixable e não são compliments
  const mediumIssues = reviewData.issues.filter(
    i => i.priority === 'MEDIUM' && !i.auto_fixable && !i.is_compliment
  );
  
  for (const issue of mediumIssues) {
    // Verificar se issue similar já existe (evitar duplicatas)
    const existingIssue = await findSimilarIssue(issue, github, context);
    if (existingIssue) {
      console.log(`Issue similar já existe: #${existingIssue.number}`);
      continue;
    }
    
    const issueBody = generateIssueBody(issue, prNumber);
    
    const { data: newIssue } = await github.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: `[Refactor] ${issue.file.split('/').pop()}: ${issue.issue.substring(0, 50)}...`,
      body: issueBody,
      labels: ['🤖 gemini-refactor', 'refactoring', issue.category || 'general']
    });
    
    createdIssues.push(newIssue.number);
  }
  
  return createdIssues;
}
```

#### Critérios de Validação ✅
- [x] Issues são criadas apenas para MEDIUM não-auto-fixable
- [x] Não cria issues duplicadas
- [x] **Não adiciona comentários à timeline do PR**
- [x] Issues linkadas ao PR via referência
- [x] **Hotfix #108**: Filtra compliments do Gemini

---

### P2.4 - Reply Estratégico a Comentários do Gemini ⏳ PENDENTE

#### Descrição
Ao invés de criar novos comentários na timeline, **responder diretamente** aos comentários inline do Gemini quando issues forem resolvidos.

#### Quando Responder

| Situação | Ação |
|----------|------|
| Issue resolvido em novo commit | Reply ao comentário inline com ✅ |
| Issue rejeitado (falso positivo) | Reply ao comentário inline com ℹ️ |
| Issue parcialmente resolvido | Reply ao comentário inline com 🔄 |

#### Implementação Técnica

**Arquivo:** `.github/scripts/check-resolutions.js` (novo)

```javascript
/**
 * Verifica quais issues do Gemini foram resolvidos em novos commits
 * e responde aos comentários inline apropriadamente
 * 
 * @param {number} prNumber - Número do PR
 * @param {Object} github - Cliente GitHub
 * @param {Object} context - Contexto do GitHub Actions
 */
async function checkResolutions(prNumber, github, context) {
  // Buscar comentários inline do Gemini
  const { data: reviewComments } = await github.rest.pulls.listReviewComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNumber
  });
  
  const geminiComments = reviewComments.filter(c => 
    c.user.login === 'gemini-code-assist[bot]'
  );
  
  // Buscar commits do PR
  const { data: commits } = await github.rest.pulls.listCommits({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNumber
  });
  
  const latestCommit = commits[commits.length - 1];
  
  for (const comment of geminiComments) {
    // Verificar se o código na linha foi modificado no último commit
    const isResolved = await checkIfLineChanged(
      comment.path, 
      comment.line, 
      comment.commit_id,
      latestCommit.sha,
      github,
      context
    );
    
    if (isResolved) {
      // Responder ao comentário do Gemini
      await github.rest.pulls.createReplyForReviewComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: prNumber,
        comment_id: comment.id,
        body: `✅ **Corrigido** em ${latestCommit.sha.substring(0, 7)}`
      });
    }
  }
}

module.exports = { checkResolutions };
```

**Arquivos para Criar:**
- `.github/scripts/check-resolutions.js`

**Critérios de Validação:**
- [ ] Replies são postados em threads dos comentários inline
- [ ] Apenas quando código é realmente modificado
- [ ] **Não cria novos comentários na timeline principal**

---

### P2.5 - Trigger de Revisão em Novos Commits ✅ IMPLEMENTADO

**Status:** ✅ Em Produção  
**PR:** #77  
**Data:** Sprint 2 (Concluído)

#### Problema Observado
Novos commits no mesmo PR **não** disparam revisão automática do Gemini, apesar do workflow postar resumos.

#### Solução: Comentário Automático de Trigger

Adicionar um job que posta um comentário `/gemini review` quando detectar alterações significativas em novos commits.

#### Implementação Técnica

**Arquivo:** `.github/scripts/trigger-re-review.js`

```javascript
/**
 * Decide se deve solicitar re-review do Gemini baseado nas mudanças
 * 
 * Critérios para re-review:
 * - Arquivos críticos modificados (src/services/, src/schemas/)
 * - Mais de 50 linhas alteradas
 * - Arquivos com issues HIGH/CRITICAL anteriormente
 * 
 * @param {number} prNumber - Número do PR
 * @param {Object} github - Cliente GitHub
 * @param {Object} context - Contexto
 * @returns {Promise<boolean>} Se deve trigger re-review
 */
async function shouldTriggerRereview(prNumber, github, context) {
  // Buscar último review do Gemini
  const { data: reviews } = await github.rest.pulls.listReviews({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNumber
  });
  
  const lastGeminiReview = reviews.find(r => 
    r.user.login === 'gemini-code-assist[bot]'
  );
  
  if (!lastGeminiReview) return false;
  
  // Buscar commits desde o último review
  const { data: commits } = await github.rest.pulls.listCommits({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNumber
  });
  
  const commitsSinceReview = commits.filter(c => 
    new Date(c.commit.committer.date) > new Date(lastGeminiReview.submitted_at)
  );
  
  if (commitsSinceReview.length === 0) return false;
  
  // Verificar arquivos modificados
  const { data: files } = await github.rest.pulls.listFiles({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNumber
  });
  
  // Arquivos críticos
  const criticalPatterns = [
    /^src\/services\//,
    /^src\/schemas\//,
    /^server\/bot\//,
    /^api\//
  ];
  
  const hasCriticalChanges = files.some(f => 
    criticalPatterns.some(pattern => pattern.test(f.filename))
  );
  
  // Total de linhas alteradas
  const totalChanges = files.reduce((sum, f) => 
    sum + f.additions + f.deletions, 0
  );
  
  // Trigger se: arquivos críticos modificados OU mais de 50 linhas
  return hasCriticalChanges || totalChanges > 50;
}

/**
 * Posta comentário para trigger do Gemini
 */
async function triggerRereview(prNumber, github, context) {
  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber,
    body: '/gemini review\n\n_(trigger automático por alterações significativas)_'
  });
}

module.exports = { shouldTriggerRereview, triggerRereview };
```

#### Critérios de Validação ✅
- [x] Re-review é solicitado apenas para alterações significativas
- [x] Critérios configuráveis (arquivos críticos, linhas alteradas)
- [x] Não spamma re-reviews desnecessários

---

### P2 - Resumo de Implementação

| Item | Arquivos | Job no Workflow | Prioridade | Status | Polui Timeline? |
|------|----------|-----------------|------------|--------|-----------------|
| P2.1 - Labels | `apply-labels.js` + testes | `apply-labels` | **Alta** | ✅ | ❌ Não |
| P2.2 - Resumo Editável | `post-smart-summary.js` | `post-summary` | **Alta** | ✅ | ❌ Não (edita) |
| P2.3 - Create Issues | `create-issues.js` + testes | `create-issues` | **Média** | ✅ | ❌ Não |
| P2.4 - Reply a Comments | `check-resolutions.js` | `check-resolutions` | **Média** | ⏳ | ❌ Não (threads) |
| P2.5 - Trigger Re-review | `trigger-re-review.js` | `trigger-rereview` | **Média** | ✅ | ✅ Sim (1x) |

**Dependências:**
```
P2.1 (Labels) ─┬──────────────────────────────┐
               │                              │
P2.2 (Resumo) ─┼──> P2.4 (Reply) ─┬──> P2.5 (Trigger)
               │                  │
P2.3 (Issues) ─┘                  └──> P2.3 (Issues)
```

---

## 🧠 Fase P3: Intelligence & Metrics

### Objetivo
Implementar inteligência para otimizar reviews e rastrear métricas de efetividade.

### P3.1 - Cache de Reviews ✅ IMPLEMENTADO

**Status:** ✅ Em Produção
**PR:** #113, #114
**Data:** Sprint 3 (Concluído)

#### Descrição
Evitar re-análise de código não alterado usando hash de conteúdo.

#### Implementação Técnica

**Arquivo:** `.github/scripts/review-cache.cjs` (novo)

```javascript
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = '.gemini-cache';

/**
 * Gera hash do conteúdo do arquivo
 * @param {string} filePath - Caminho do arquivo
 * @returns {string} Hash SHA-256
 */
function hashFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Busca review em cache
 * @param {string} filePath - Caminho do arquivo
 * @param {number} line - Linha do issue
 * @returns {Object|null} Review cacheado ou null
 */
function getCachedReview(filePath, line) {
  const fileHash = hashFile(filePath);
  const cachePath = path.join(CACHE_DIR, `${fileHash}.json`);
  
  if (!fs.existsSync(cachePath)) return null;
  
  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  return cache[line] || null;
}

/**
 * Salva review no cache
 * @param {string} filePath - Caminho do arquivo
 * @param {number} line - Linha do issue
 * @param {Object} review - Dados do review
 */
function setCachedReview(filePath, line, review) {
  const fileHash = hashFile(filePath);
  const cachePath = path.join(CACHE_DIR, `${fileHash}.json`);
  
  let cache = {};
  if (fs.existsSync(cachePath)) {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  }
  
  cache[line] = {
    ...review,
    timestamp: Date.now(),
    file_hash: fileHash
  };
  
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

module.exports = {
  hashFile,
  getCachedReview,
  setCachedReview
};
```

---

### P3.2 - Filtros de Path Inteligentes ✅ IMPLEMENTADO

**Status:** ✅ Em Produção
**PR:** #115
**Data:** Sprint 3 (Concluído)

#### Descrição
Focar o review em caminhos críticos e ignorar arquivos irrelevantes.

#### Configuração

**Arquivo:** `.gemini/config.yaml` (atualizado)

```yaml
code_review:
  comment_severity_threshold: MEDIUM
  max_review_comments: 20
  
  # Paths a ignorar completamente
  excluded_paths:
    - "docs/archive/**"
    - "docs/old/**"
    - "**/dist/**"
    - "**/node_modules/**"
    - "**/*.md"
    - ".github/**/*.yml"
    - "plans/old/**"
    - "bug_logs/**"
    - "screenshots/**"
  
  # Paths com prioridade máxima
  critical_paths:
    - "src/services/api/**"
    - "src/schemas/**"
    - "server/bot/**"
    - "api/**"
```

---

### P3.3 - Métricas de Review

#### Descrição
Rastrear efetividade da integração com métricas detalhadas via GitHub Issues semanais (não Slack).

#### Implementação

**Arquivo:** `.github/workflows/metrics-report.yml` (novo)

```yaml
name: Gemini Metrics Report

on:
  schedule:
    # Semanal, às segundas 9h
    - cron: '0 9 * * 1'
  workflow_dispatch:

jobs:
  generate-report:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Generate Weekly Report
        uses: actions/github-script@v7
        with:
          script: |
            const { generateMetricsReport } = require('.github/scripts/metrics-collector');
            const endDate = new Date().toISOString();
            const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            
            const report = await generateMetricsReport(startDate, endDate);
            
            // Criar issue com relatório (GitHub-native, não Slack)
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `📊 Gemini Metrics Report - ${startDate.split('T')[0]} to ${endDate.split('T')[0]}`,
              body: formatReport(report),
              labels: ['metrics', 'report', '🤖 gemini-reviewed']
            });
```

---

## 🤖 Fase P4: Agent Integration

### Objetivo
Permitir que agentes de IA consumam automaticamente o output estruturado e apliquem correções.

### P4.1 - API para Agentes (Supabase) ✅ IMPLEMENTADO

**Status:** ✅ Em Produção
**PR:** #116
**Data:** Sprint 4 (Concluído)

#### Arquivos Entregues
- `.migrations/20260222_create_gemini_reviews_table.sql`
- `src/schemas/geminiReviewSchema.js`
- `src/services/api/geminiReviewService.js`

#### Descrição
Salvar reviews em tabela do Supabase para acesso mais fácil por agentes.

```sql
-- Tabela para armazenar reviews
CREATE TABLE gemini_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_number INTEGER NOT NULL,
  branch TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  review_data JSONB NOT NULL,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Arquivo:** `.github/scripts/save-to-supabase.js` (novo)

```javascript
async function saveToSupabase(reviewData) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { error } = await supabase
    .from('gemini_reviews')
    .upsert({
      pr_number: reviewData.pr_number,
      branch: reviewData.branch,
      commit_sha: reviewData.commit_sha,
      review_data: reviewData,
      status: 'pending'
    }, {
      onConflict: 'pr_number,commit_sha'
    });
  
  if (error) throw error;
}
```

---

## 🏗️ Arquitetura da Fase P4: Como Tudo se Conecta

> **Visão Geral:** Entenda como os 7 componentes da Fase P4 trabalham em conjunto para criar um ecossistema completo de review automatizado.

### Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GITHUB ECOSYSTEM                                │
│  ┌──────────────┐    ┌──────────────────┐    ┌─────────────────────────┐   │
│  │   Pull       │───▶│  Gemini Code     │───▶│   GitHub Webhook        │   │
│  │   Request    │    │  Assist Review   │    │   (Evento disparado)    │   │
│  └──────────────┘    └──────────────────┘    └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           P4.7 - WEBHOOK GITHUB                              │
│  Receptor de eventos do GitHub                                                │
│  • Valida assinatura HMAC                                                      │
│  • Identifica reviews do Gemini                                                │
│  • Busca comentários via API GitHub                                            │
│  • Parseia estrutura dos comentários                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            P4.1 - API SUPABASE                               │
│  Fonte Única da Verdade (Already Implemented ✅)                              │
│  • Tabela: gemini_reviews                                                      │
│  • Status: pending → in_progress → completed                                   │
│  • Dados: review_data, metadata, timestamps                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                           │
        ┌───────────┼───────────┐               │
        ▼           ▼           ▼               │
┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  P4.3    │  │  P4.5    │  │  P4.6    │       │
│ Webhook  │  │ Endpoint │  │  UI      │◀──────┘
│ Agents   │  │ REST API │  │  Human   │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONSUMIDORES DOS DADOS                             │
│                                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────┐  │
│  │    AGENTS EXTERNOS  │    │   AGENTS CLI        │    │  REVISORES      │  │
│  │    (Kilocode, etc)  │    │   (Desenvolvedores) │    │  HUMANOS        │  │
│  │                     │    │                     │    │                 │  │
│  │  • Recebem notif.   │    │  • Listam reviews   │    │  • Visualizam   │  │
│  │    via webhook      │    │  • Claimam PRs      │    │    dashboard    │  │
│  │  • Processam        │    │  • Resolvem issues  │    │  • Aprovam/     │  │
│  │    automaticamente  │    │    via terminal     │    │    rejeitam     │  │
│  └─────────────────────┘    └─────────────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Responsabilidade de Cada Componente

| Componente | Papel | Input | Output | Quem Usa |
|------------|-------|-------|--------|----------|
| **P4.1 API Supabase** | 💾 Fonte de dados centralizada | Review parseado | Reviews persistidos | Todos os outros componentes |
| **P4.2 Protocolo** | 📋 Contrato de comunicação | Requisições HTTP | Respostas padronizadas | Devs implementando integrações |
| **P4.3 Webhook Agents** | 📢 Notificador push | Novo review salvo | POST para URLs externas | Agents externos (Kilocode) |
| **P4.4 CLI** | 🖥️ Interface terminal | Comandos do usuário | Ações no sistema | Devs que preferem terminal |
| **P4.5 Endpoint** | 🌐 API REST pública | HTTP requests | JSON responses | Agents e integrações |
| **P4.6 UI Human** | 🖱️ Interface web | Cliques do usuário | Ações de revisão | Revisores humanos |
| **P4.7 Webhook GitHub** | 📥 Entrada de dados | Eventos GitHub | Reviews salvos no P4.1 | Sistema (automático) |

### Fluxos de Dados Detalhados

#### Fluxo 1: Review Automático Completo (Happy Path)
```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Dev    │────▶│  GitHub │────▶│  P4.7   │────▶│  P4.1   │────▶│  P4.3   │
│  Push   │     │  + Gemini│     │ Webhook │     │  Supabase│     │ Webhook │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └────┬────┘
                                                                      │
                                                                      ▼
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  P4.1   │◀────│  P4.4   │────▶│  Dev    │◀────│  Agent  │◀────│ Kilocode│
│ Updated │     │  CLI    │     │  Commit │     │  Fix    │     │  Notify │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘

Tempo total: ~30 segundos (GitHub webhook → Agent notificado)
```

**Participantes:**
- **Dev:** Programador que fez push do código
- **GitHub + Gemini:** Plataforma + Code Assist que gerou review
- **P4.7 Webhook GitHub:** Recebe evento, parseia, salva
- **P4.1 Supabase:** Armazena review com status "pending"
- **P4.3 Webhook Agents:** Notifica Kilocode sobre novo review
- **Kilocode:** Agent externo que processa automaticamente
- **Agent Fix:** Correções aplicadas pelo agent
- **Dev Commit:** Commit com as correções
- **P4.4 CLI:** Usado opcionalmente para marcar como resolvido

---

#### Fluxo 2: Revisão Humana de Issues Críticos
```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  P4.7   │────▶│  P4.1   │────▶│  P4.6   │────▶│  Revisor│
│ Webhook │     │ Supabase│     │  UI     │     │  Humano │
└─────────┘     └────┬────┘     └─────────┘     └────┬────┘
                     │                                │
                     │◀───────────────────────────────┘
                     │        Aprova/Rejeita
                     ▼
              ┌─────────────┐
              │  Status:    │
              │  completed  │
              │  (human_    │
              │  reviewed)  │
              └─────────────┘

Tempo total: Variável (depende da disponibilidade do revisor)
```

**Quando usar:**
- Issues classificados como CRITICAL ou HIGH
- Falsos positivos do Gemini que precisam ser marcados
- Decisões arquiteturais que requerem julgamento humano
- Documentação de "porque" uma decisão foi tomada

---

#### Fluxo 3: Desenvolvedor com CLI
```
┌────────────────────────────────────────────────────────────────┐
│ Terminal do Desenvolvedor                                       │
│ $ gemini-agent list                                            │
│ ┌──────┬───────────────────────┬─────────┬────────┐            │
│ │ PR   │ Branch                │ Issues  │ Status │            │
│ ├──────┼───────────────────────┼─────────┼────────┤            │
│ │ #71  │ feature/new-auth      │ 5 (2🔴) │ pending│            │
│ │ #70  │ fix/login-bug         │ 2 (0🔴) │ pending│            │
│ └──────┴───────────────────────┴─────────┴────────┘            │
│                                                                 │
│ $ gemini-agent claim --pr 71                                   │
│ ✅ PR #71 reservado para cli-agent                             │
│                                                                 │
│ $ gemini-agent show --pr 71                                    │
│ [Mostra detalhes dos issues]                                   │
│                                                                 │
│ # Dev faz as correções...                                      │
│                                                                 │
│ $ gemini-agent resolve --pr 71 --commit abc123                 │
│ ✅ PR #71 marcado como resolvido                               │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  P4.5 Endpoint  │
                    │  PATCH /:id     │
                    └─────────────────┘
```

**Quando usar:**
- Preferência por terminal ao invés de UI web
- Automação em scripts de CI/CD
- Integração com editores de código (VS Code extension futura)

---

### Ordem de Construção Recomendada

```
FASE 1 - FUNDAMENTO (Blockers para todos)
├── P4.1 ✅ API Supabase [JA IMPLEMENTADO]
└── P4.7 🔥 Webhook GitHub [PRÓXIMO - CRÍTICO]
    └── Por quê? Sem webhook, o sistema depende de polling manual

FASE 2 - CONSUMO (Permitem usar os dados)
├── P4.2 Protocolo [FUNDAMENTO TÉCNICO]
│   └── Define contratos para todos os outros componentes
├── P4.5 Endpoint REST [INFRAESTRUTURA]
│   └── Permite que qualquer cliente acesse os dados
└── P4.3 Webhook Agents [INTEGRAÇÃO EXTERNA]
    └── Notifica agents externos (pode ser opcional inicialmente)

FASE 3 - INTERFACES (Experiência do usuário)
├── P4.6 UI Human Review [REVIEWERS HUMANOS]
│   └── Interface para revisores darem feedback
└── P4.4 CLI [POWER USERS]
    └── Para desenvolvedores que preferem terminal

DEPENDÊNCIAS VISUAIS:

P4.7 ──▶ P4.1 ──┬──▶ P4.5 ──┬──▶ P4.4
                │           │
                └──▶ P4.3 ──┘
                │
                └──▶ P4.6 (UI)

P4.2 (Protocolo) é transversal - todos usam
```

### Cenários de Uso por Persona

#### 👨‍💻 Desenvolvedor Junior
> "Quero ver o que o Gemini achou do meu código de forma simples"

**Caminho:** GitHub PR → Recebe notificação no email → Clica link → Vê UI P4.6
**Componentes:** P4.7 → P4.1 → P4.6

**Exemplo:**
1. Faz push de código
2. Recebe email: "Gemini encontrou 3 issues no seu PR #71"
3. Clica link para `https://dosiq.app/admin/gemini-reviews/71`
4. Vê dashboard com cards coloridos (🔴 🟠 🟢)
5. Clica no issue e vê explicação em português
6. Aplica correção sugerida

---

#### 👩‍💻 Tech Lead (Revisora Humana)
> "Preciso revisar os findings do Gemini antes de aprovar o PR"

**Caminho:** UI P4.6 → Filtra por CRITICAL → Revisa um a um → Toma decisão
**Componentes:** P4.6 → P4.5 → P4.1

**Exemplo:**
1. Acessa `/admin/gemini-reviews`
2. Filtra por `priority: CRITICAL` + `status: pending`
3. Vê 2 reviews pendentes
4. Abre PR #73 - 1 issue CRITICAL de segurança
5. Verifica o código - é um falso positivo
6. Clica "Rejeitar" + adiciona nota: "Esta URL é de ambiente de teste, não prod"
7. Issue é marcado como falso positivo no banco
8. Aprendizado futuro para o Gemini

---

#### 🤖 Agent Externo (Kilocode)
> "Preciso ser notificado automaticamente quando há reviews pendentes"

**Caminho:** P4.7 → P4.3 → Processa → P4.5 → Atualiza status
**Componentes:** P4.7 → P4.1 → P4.3 → P4.5 → P4.1

**Exemplo:**
1. Webhook do GitHub dispara para P4.7
2. P4.7 salva review no Supabase (P4.1)
3. P4.3 notifica Kilocode via POST `https://api.kilocode.ai/webhooks/gemini`
4. Kilocode recebe payload com issues
5. Kilocode processa e decide quais pode corrigir
6. Kilocode faz commit com correções
7. Kilocode chama P4.5 (PATCH) para marcar como resolvido

---

#### 🖥️ Desenvolvedor Sênior (Power User)
> "Prefiro usar terminal e quero automatizar meu workflow"

**Caminho:** CLI P4.4 → Listagem → Claim → Resolve
**Componentes:** P4.4 → P4.5 → P4.1

**Exemplo:**
```bash
# No terminal, enquanto trabalha
$ gemini-agent list --status pending
PR #71: feature/auth (3 issues, 1 critical) [pending]
PR #70: fix/bug (1 issue, low) [pending]

$ gemini-agent claim --pr 71
✅ PR #71 reservado

# Abre PR no VS Code, faz correções
# ...

$ git commit -m "fix: resolve security issue from Gemini review"
$ gemini-agent resolve --pr 71 --commit $(git rev-parse HEAD)
✅ Marcado como resolvido
```

---

### Matriz de Decisão: Qual Componente Usar?

| Se você quer... | Use o Componente | Via... |
|----------------|------------------|--------|
| Receber notificação em tempo real | P4.7 + P4.3 | Webhook automático |
| Ver reviews em interface visual | P4.6 | Browser (`/admin/gemini-reviews`) |
| Integrar com meu agent próprio | P4.5 | HTTP REST API |
| Usar terminal/script | P4.4 | CLI `gemini-agent` |
| Salvar dados customizados | P4.1 | Supabase direto |
| Entender o contrato | P4.2 | Documentação `GEMINI_AGENT_PROTOCOL.md` |

---

### P4.2 - Protocolo Padronizado para Agents ⏳ PLANEJADO

#### Status
⏳ Aguardando P4.1 | **Prioridade:** Alta | **Complexidade:** Média

#### Descrição
Definir especificação formal para comunicação entre o sistema de reviews e agents de IA. O protocolo estabelece contratos de API, formatos de mensagem, estados e resoluções padronizadas.

#### Requisitos Técnicos

**1. Schema de Protocolo (Zod)**
```javascript
// src/schemas/geminiAgentProtocolSchema.js
const { z } = require('zod');

const AgentMetadataSchema = z.object({
  agent_id: z.string().min(1),
  agent_type: z.enum(['kilocode', 'github-copilot', 'custom']),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  resolution: z.enum(['fixed', 'rejected', 'partial', 'failed']).optional(),
  commit_sha: z.string().length(40).optional(),
  notes: z.string().max(1000).optional(),
  processed_issues: z.array(z.object({
    issue_id: z.string(),
    action: z.enum(['fixed', 'ignored', 'escalated']),
    file: z.string(),
    line: z.number()
  })).optional()
});

const ProtocolMessageSchema = z.object({
  protocol_version: z.literal('1.0'),
  event_type: z.enum([
    'review_available',
    'agent_claimed',
    'agent_progress',
    'agent_completed',
    'agent_failed'
  ]),
  timestamp: z.string().datetime(),
  pr_number: z.number().int().positive(),
  review_id: z.string().uuid(),
  agent_metadata: AgentMetadataSchema,
  payload: z.record(z.unknown())
});

module.exports = {
  AgentMetadataSchema,
  ProtocolMessageSchema
};
```

**2. Documentação Completa**

**Arquivo:** `docs/standards/GEMINI_AGENT_PROTOCOL.md`

```markdown
# Gemini Agent Protocol v1.0

## Visão Geral
Protocolo para agents de IA consumirem reviews do Gemini Code Assist e reportarem progresso.

## Autenticação
Todos os endpoints requerem:
- Header: `Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}`
- Header: `X-Agent-ID: {agent_id}`

## Endpoints

### Listar Reviews
**GET** `/api/gemini-reviews?status=pending&pr_number=71`

**Parâmetros de Query:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| status | string | Não | pending, in_progress, completed |
| pr_number | integer | Não | Filtrar por PR específico |
| priority | string | Não | CRITICAL, HIGH, MEDIUM, LOW |
| limit | integer | Não | Máximo de resultados (default: 50) |

**Resposta 200:**
```json
{
  "protocol_version": "1.0",
  "data": [ /* reviews */ ],
  "meta": { "total": 1, "page": 1, "limit": 50 }
}
```

### Claim (Reservar Review)
**POST** `/api/gemini-reviews/:id/claim`
**Body:** `{ "agent_id": "kilocode-agent-1", "agent_type": "kilocode" }`
**Respostas:** 200 (sucesso), 409 (conflito), 404 (não encontrado)

### Completar Review
**POST** `/api/gemini-reviews/:id/complete`
**Body:** `{ "resolution": "fixed", "commit_sha": "def456...", "notes": "..." }`

## Estados
| Estado | Descrição | Transições |
|--------|-----------|------------|
| `pending` | Aguardando agent | → in_progress |
| `in_progress` | Agent trabalhando | → completed, → failed |
| `completed` | Finalizado com sucesso | - |
| `failed` | Agent falhou | → pending (retry) |

## Resoluções
| Resolução | Significado |
|-----------|-------------|
| `fixed` | Issues corrigidos |
| `rejected` | Falsos positivos |
| `partial` | Parcialmente resolvido |
| `failed` | Falha na resolução |
```

#### Testes Requeridos
**Arquivo:** `.github/scripts/__tests__/protocol-validation.test.js`
```javascript
const { ProtocolMessageSchema } = require('../../../src/schemas/geminiAgentProtocolSchema');

describe('Protocol Validation', () => {
  test('valid message passes', () => {
    const valid = {
      protocol_version: '1.0',
      event_type: 'review_available',
      timestamp: new Date().toISOString(),
      pr_number: 71,
      review_id: '550e8400-e29b-41d4-a716-446655440000',
      agent_metadata: { agent_id: 'test-agent', agent_type: 'kilocode' },
      payload: {}
    };
    expect(() => ProtocolMessageSchema.parse(valid)).not.toThrow();
  });
});
```

#### Checklist de Implementação
- [ ] Criar schema Zod completo
- [ ] Implementar documentação GEMINI_AGENT_PROTOCOL.md
- [ ] Adicionar validação em todos os endpoints
- [ ] Implementar testes unitários
- [ ] Adicionar rate limiting (opcional)

#### Exemplo:

# Gemini Agent Protocol v1.0

## Visão Geral

Protocolo para agents de IA consumirem reviews do Gemini Code Assist e reportarem progresso.

## Endpoints

### Listar Reviews

```http
GET /api/gemini-reviews?status=pending&pr_number=71
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
```

**Resposta:**
```json
{
  "protocol_version": "1.0",
  "data": [
    {
      "id": "uuid",
      "pr_number": 71,
      "branch": "feature/wave-2/new-feature",
      "commit_sha": "abc123...",
      "status": "pending",
      "review_data": {
        "summary": { "total_issues": 7, "critical": 1 },
        "issues": [...]
      },
      "created_at": "2026-02-20T10:00:00Z"
    }
  ]
}
```

### Atualizar Status

```http
PATCH /api/gemini-reviews/:id
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
Content-Type: application/json

{
  "status": "in_progress",
  "agent_metadata": {
    "agent_id": "kilocode-agent-1",
    "started_at": "2026-02-20T10:05:00Z"
  }
}
```

### Marcar como Resolvido

```http
PATCH /api/gemini-reviews/:id
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
Content-Type: application/json

{
  "status": "completed",
  "agent_metadata": {
    "agent_id": "kilocode-agent-1",
    "resolution": "fixed",
    "commit_sha": "def456...",
    "completed_at": "2026-02-20T10:30:00Z",
    "notes": "Todos os issues HIGH foram resolvidos"
  }
}
```

## Estados

| Estado | Descrição |
|--------|-----------|
| `pending` | Aguardando agent |
| `in_progress` | Agent trabalhando |
| `completed` | Finalizado |

## Resoluções

| Resolução | Significado |
|-----------|-------------|
| `fixed` | Issues corrigidos |
| `rejected` | Falsos positivos |
| `partial` | Parcialmente resolvido |

---

### P4.3 - Webhook para Notificação de Agents ⏳ PLANEJADO

#### Status
⏳ Aguardando P4.1 | **Prioridade:** Média | **Complexidade:** Média

#### Descrição
Notificar agents automaticamente quando novos reviews estão disponíveis. Sistema de webhook confiável com retry, deduplicação e dead letter queue (DLQ).

#### Requisitos Técnicos

**1. Configuração de Webhooks**

**Arquivo:** `.github/config/gemini-webhooks.json`
```json
{
  "webhooks": [
    {
      "name": "kilocode-agent",
      "url": "https://api.kilocode.ai/webhooks/gemini",
      "events": ["review_available", "review_completed"],
      "secret": "${KILOCODE_WEBHOOK_SECRET}",
      "retry_config": { "max_retries": 3, "backoff_ms": 1000 },
      "timeout_ms": 30000
    }
  ]
}
```

**2. Implementação do Notifier**

**Arquivo:** `.github/scripts/notify-agents.cjs`

```javascript
const crypto = require('crypto');
const { setTimeout } = require('timers/promises');

/**
 * Notifica agents sobre novo review disponível
 * @param {Object} reviewData - Dados do review
 * @returns {Promise<Object>} Resultado das notificações
 */
async function notifyAgents(reviewData) {
  const webhooks = loadWebhookConfig();
  const results = [];
  
  for (const webhook of webhooks) {
    const result = await notifyWebhook(webhook, reviewData);
    results.push(result);
    
    if (!result.success) {
      await logFailedNotification(webhook, reviewData, result.error);
    }
  }
  
  return {
    notified: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  };
}

async function notifyWebhook(webhook, reviewData) {
  const payload = buildWebhookPayload(webhook.events, reviewData);
  const signature = generateSignature(payload, webhook.secret);
  
  let lastError;
  for (let attempt = 0; attempt <= webhook.retry_config.max_retries; attempt++) {
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${webhook.secret}`,
          'X-Gemini-Event': payload.event_type,
          'X-Gemini-Signature': signature,
          'X-Gemini-Delivery': crypto.randomUUID(),
          'X-Gemini-Attempt': String(attempt + 1)
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(webhook.timeout_ms || 30000)
      });
      
      if (response.ok) {
        return { success: true, webhook: webhook.name, attempt: attempt + 1 };
      }
      
      lastError = new Error(`HTTP ${response.status}: ${await response.text()}`);
    } catch (error) {
      lastError = error;
    }
    
    if (attempt < webhook.retry_config.max_retries) {
      const backoff = webhook.retry_config.backoff_ms * Math.pow(2, attempt);
      await setTimeout(backoff);
    }
  }
  
  return { success: false, webhook: webhook.name, error: lastError.message };
}

function generateSignature(payload, secret) {
  return crypto.createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}
```

#### Testes Requeridos
**Arquivo:** `.github/scripts/__tests__/notify-agents.test.js`
```javascript
describe('Webhook Notifier', () => {
  test('notifies all configured webhooks', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const result = await notifyAgents({ pr_number: 71 });
    expect(result.notified).toBeGreaterThan(0);
  });
  
  test('retries on failure', async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({ ok: true });
    const result = await notifyWebhook(mockWebhook, { pr_number: 71 });
    expect(result.attempt).toBe(2);
  });
});
```

#### Checklist de Implementação
- [ ] Criar configuração JSON de webhooks
- [ ] Implementar notify-agents.cjs com retry
- [ ] Adicionar HMAC signature para segurança
- [ ] Implementar DLQ para falhas
- [ ] Criar testes unitários

---

### P4.4 - CLI para Agents ⏳ PLANEJADO

#### Status
⏳ Aguardando P4.1 | **Prioridade:** Baixa | **Complexidade:** Média

#### Descrição
Interface de linha de comando que agents podem usar para interagir com o sistema de reviews. CLI permite listar, visualizar, reservar e completar reviews de forma interativa.

#### Requisitos Técnicos

**Arquivo:** `scripts/gemini-agent-cli.js` (novo)

```javascript
#!/usr/bin/env node

/**
 * CLI para agentes interagirem com reviews do Gemini
 *
 * Comandos:
 *   gemini-agent list --pr 71
 *   gemini-agent show --pr 71
 *   gemini-agent claim --pr 71 --agent "kilocode"
 *   gemini-agent resolve --pr 71 --commit abc123
 *   gemini-agent next (próximo issue prioritário)
 */

const { Command } = require('commander');
const program = new Command();

program
  .name('gemini-agent')
  .description('CLI para consumir reviews do Gemini Code Assist')
  .version('1.0.0');

program
  .command('list')
  .description('Listar reviews pendentes')
  .option('-p, --pr <number>', 'Filtrar por PR')
  .option('-s, --status <status>', 'Status', 'pending')
  .action(async (options) => {
    const reviews = await listReviews(options.pr, options.status);
    console.table(reviews.map(r => ({
      pr: r.pr_number,
      branch: r.branch,
      issues: r.review_data?.summary?.total_issues || 0,
      critical: r.review_data?.summary?.critical || 0,
      status: r.status
    })));
  });

program
  .command('show')
  .description('Mostrar detalhes de um review')
  .requiredOption('-p, --pr <number>', 'Número do PR')
  .action(async (options) => {
    const review = await getReview(options.pr);
    console.log(JSON.stringify(review.review_data, null, 2));
  });

program
  .command('claim')
  .description('Reservar um review para trabalho')
  .requiredOption('-p, --pr <number>', 'Número do PR')
  .option('-a, --agent <name>', 'Nome do agente', 'cli-agent')
  .action(async (options) => {
    await claimReview(options.pr, options.agent);
    console.log(`✅ PR #${options.pr} reservado para ${options.agent}`);
  });

program
  .command('resolve')
  .description('Marcar review como resolvido')
  .requiredOption('-p, --pr <number>', 'Número do PR')
  .requiredOption('-c, --commit <sha>', 'SHA do commit')
  .option('-n, --notes <text>', 'Notas')
  .action(async (options) => {
    await resolveReview(options.pr, options.commit, options.notes);
    console.log(`✅ PR #${options.pr} marcado como resolvido`);
  });

program
  .command('next')
  .description('Obter próximo issue prioritário')
  .option('-c, --category <cat>', 'Filtrar por categoria')
  .action(async (options) => {
    const issue = await getNextIssue(options.category);
    if (issue) {
      console.log(`\n📋 Próximo Issue:`);
      console.log(`Arquivo: ${issue.file}:${issue.line}`);
      console.log(`Prioridade: ${issue.priority}`);
      console.log(`Issue: ${issue.issue}`);
    } else {
      console.log('✅ Nenhum issue pendente!');
    }
  });

// Implementações
async function listReviews(prNumber, status) {
  const url = new URL(`${process.env.API_BASE}/api/gemini-reviews`);
  if (prNumber) url.searchParams.append('pr_number', prNumber);
  url.searchParams.append('status', status);
  
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
  });
  return res.json();
}

async function getReview(prNumber) {
  const reviews = await listReviews(prNumber, 'any');
  return reviews[0];
}

async function claimReview(prNumber, agentId) {
  const review = await getReview(prNumber);
  await fetch(`${process.env.API_BASE}/api/gemini-reviews/${review.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'in_progress',
      agent_metadata: { agent_id: agentId, started_at: new Date().toISOString() }
    })
  });
}

async function resolveReview(prNumber, commitSha, notes) {
  const review = await getReview(prNumber);
  await fetch(`${process.env.API_BASE}/api/gemini-reviews/${review.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'completed',
      agent_metadata: {
        resolution: 'fixed',
        commit_sha: commitSha,
        notes,
        completed_at: new Date().toISOString()
      }
    })
  });
}

async function getNextIssue(category) {
  const reviews = await listReviews(null, 'pending');
  for (const review of reviews) {
    const issues = review.review_data?.issues || [];
    const filtered = category
      ? issues.filter(i => i.category === category)
      : issues;
    if (filtered.length > 0) return filtered[0];
  }
  return null;
}

program.parse();
```

#### Instalação

```json
// package.json
{
  "bin": {
    "gemini-agent": "./scripts/gemini-agent-cli.js"
  }
}
```

```bash
# Instalar globalmente
npm link

# Uso
 gemini-agent list
 gemini-agent next
 gemini-agent claim --pr 71
```

---

### P4.5 - API Endpoint (Vercel) ⏳ PLANEJADO

#### Status
⏳ Aguardando P4.1 | **Prioridade:** Alta | **Complexidade:** Média

#### Descrição
Endpoint REST para agents consumirem dados. Implementa autenticação, rate limiting e validação de schema.

#### Requisitos Técnicos

**Arquivo:** `api/gemini-reviews.js` (novo)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH');
  
  if (req.method === 'GET') {
    const { status, pr_number } = req.query;
    let query = supabase.from('gemini_reviews').select('*');
    
    if (status) query = query.eq('status', status);
    if (pr_number) query = query.eq('pr_number', pr_number);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  
  if (req.method === 'PATCH') {
    const { id } = req.query;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('gemini_reviews')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
```

#### Validação e Segurança
```javascript
// Middleware de autenticação
function verifyAuth(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing authorization header' };
  }
  const token = auth.slice(7);
  if (token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { valid: false, error: 'Invalid token' };
  }
  return { valid: true };
}

// Rate limiting simples (em memória)
const rateLimit = new Map();
function checkRateLimit(agentId) {
  const now = Date.now();
  const windowStart = now - 60000; // 1 minuto
  const requests = rateLimit.get(agentId) || [];
  const recent = requests.filter(t => t > windowStart);
  
  if (recent.length >= 100) { // 100 requests/minuto
    return { allowed: false, retry_after: 60 };
  }
  
  recent.push(now);
  rateLimit.set(agentId, recent);
  return { allowed: true };
}
```

#### Checklist de Implementação
- [ ] Implementar endpoint GET /api/gemini-reviews
- [ ] Implementar endpoint PATCH /api/gemini-reviews/:id
- [ ] Implementar POST /api/gemini-reviews/:id/claim
- [ ] Implementar POST /api/gemini-reviews/:id/complete
- [ ] Adicionar autenticação Bearer token
- [ ] Implementar rate limiting
- [ ] Adicionar CORS para domínios autorizados
- [ ] Criar testes de integração

---

### P4.6 - UI para Revisores Humanos ⏳ PLANEJADO

#### Status
⏳ Aguardando P4.1 | **Prioridade:** Alta | **Complexidade:** Média

#### Descrição
Interface web para revisores humanos visualizarem, filtrarem e gerenciarem reviews do Gemini Code Assist. Permite aprovar, rejeitar ou escalonar issues identificados pelos agents.

#### Requisitos Funcionais

**1. Dashboard de Reviews**
- Lista de reviews com filtros (status, prioridade, data)
- Cards com resumo: PR number, branch, contagem de issues
- Indicadores visuais de prioridade (cores por severidade)
- Paginação e busca

**2. Visualização Detalhada**
- Exibição de todos os issues de um review
- Código fonte com syntax highlighting
- Comentários inline nos locais dos issues
- Diff view entre versões

**3. Ações de Revisor**
- Aprovar issue (marcar como válido)
- Rejeitar issue (falso positivo)
- Escalonar issue (criar task manual)
- Adicionar notas internas
- Marcar review como revisado

#### Estrutura de Componentes

**Arquivos:**
```
src/views/
└── admin/
    ├── GeminiReviewsAdmin.jsx      # Dashboard principal
    ├── GeminiReviewDetail.jsx      # Visualização detalhada
    └── GeminiReviewFilters.jsx     # Componente de filtros

src/features/gemini/
├── components/
│   ├── ReviewCard.jsx              # Card de review
│   ├── IssueList.jsx               # Lista de issues
│   ├── IssueDetail.jsx             # Detalhe de um issue
│   ├── CodeViewer.jsx              # Visualizador de código
│   └── ReviewActions.jsx           # Botões de ação
├── hooks/
│   ├── useGeminiReviews.js         # Hook de listagem
│   ├── useGeminiReviewDetail.js    # Hook de detalhe
│   └── useReviewActions.js         # Hook de ações
└── services/
    └── geminiReviewAdminService.js # Serviço administrativo
```

#### Schema de Dados para UI

```javascript
// src/schemas/geminiReviewAdminSchema.js
const { z } = require('zod');

const ReviewFilterSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'all']).default('all'),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'all']).default('all'),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  pr_number: z.number().int().optional(),
  search: z.string().max(100).optional()
});

const ReviewActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'escalate', 'add_note']),
  issue_id: z.string().optional(),
  note: z.string().max(1000).optional(),
  reason: z.enum(['false_positive', 'valid_issue', 'needs_discussion']).optional()
});

const HumanReviewMetadataSchema = z.object({
  reviewer_id: z.string(),
  reviewer_email: z.string().email(),
  reviewed_at: z.string().datetime(),
  actions: z.array(ReviewActionSchema),
  final_verdict: z.enum(['approved', 'rejected', 'partial'])
});

module.exports = {
  ReviewFilterSchema,
  ReviewActionSchema,
  HumanReviewMetadataSchema
};
```

#### Componentes React

**1. ReviewCard Component**
```jsx
// src/features/gemini/components/ReviewCard.jsx
import React from 'react';
import { Card, Badge, Button } from '@shared/components/ui';
import { PRIORITY_COLORS } from '../constants';

export function ReviewCard({ review, onView, onClaim }) {
  const { pr_number, branch, status, review_data, created_at } = review;
  const { critical, high, medium, low } = review_data.summary;
  
  return (
    <Card className="review-card">
      <div className="review-header">
        <h3>PR #{pr_number}</h3>
        <Badge color={PRIORITY_COLORS[critical > 0 ? 'CRITICAL' : 'HIGH']}>
          {critical > 0 ? '🔴 Critical' : high > 0 ? '🟠 High' : '🟢 Normal'}
        </Badge>
      </div>
      
      <div className="review-branch">{branch}</div>
      
      <div className="review-stats">
        <span className="stat critical">{critical} Critical</span>
        <span className="stat high">{high} High</span>
        <span className="stat medium">{medium} Medium</span>
        <span className="stat low">{low} Low</span>
      </div>
      
      <div className="review-actions">
        <Button onClick={() => onView(review.id)}>Ver Detalhes</Button>
        {status === 'pending' && (
          <Button variant="secondary" onClick={() => onClaim(review.id)}>
            Revisar
          </Button>
        )}
      </div>
      
      <div className="review-date">
        {new Date(created_at).toLocaleString('pt-BR')}
      </div>
    </Card>
  );
}
```

**2. IssueList Component**
```jsx
// src/features/gemini/components/IssueList.jsx
import React, { useState } from 'react';
import { IssueDetail } from './IssueDetail';

export function IssueList({ issues, onAction }) {
  const [expandedIssue, setExpandedIssue] = useState(null);
  
  const sortedIssues = [...issues].sort((a, b) => {
    const priority = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return priority[b.priority] - priority[a.priority];
  });
  
  return (
    <div className="issue-list">
      {sortedIssues.map(issue => (
        <IssueDetail
          key={issue.id}
          issue={issue}
          isExpanded={expandedIssue === issue.id}
          onToggle={() => setExpandedIssue(
            expandedIssue === issue.id ? null : issue.id
          )}
          onAction={(action) => onAction(issue.id, action)}
        />
      ))}
    </div>
  );
}
```

#### Serviço Administrativo

```javascript
// src/features/gemini/services/geminiReviewAdminService.js
import { supabase } from '@shared/utils/supabase';
import { ReviewFilterSchema, ReviewActionSchema } from '@schemas/geminiReviewAdminSchema';

export const geminiReviewAdminService = {
  /**
   * Lista reviews com filtros
   */
  async listReviews(filters = {}) {
    const validated = ReviewFilterSchema.parse(filters);
    
    let query = supabase
      .from('gemini_reviews')
      .select('*', { count: 'exact' });
    
    if (validated.status !== 'all') {
      query = query.eq('status', validated.status);
    }
    
    if (validated.pr_number) {
      query = query.eq('pr_number', validated.pr_number);
    }
    
    if (validated.date_from) {
      query = query.gte('created_at', validated.date_from);
    }
    
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(0, 49);
    
    if (error) throw error;
    return { data, total: count };
  },
  
  /**
   * Executa ação em um issue
   */
  async executeAction(reviewId, actionData) {
    const validated = ReviewActionSchema.parse(actionData);
    
    const { data: review } = await supabase
      .from('gemini_reviews')
      .select('human_review_metadata')
      .eq('id', reviewId)
      .single();
    
    const currentMetadata = review.human_review_metadata || { actions: [] };
    currentMetadata.actions.push({
      ...validated,
      executed_at: new Date().toISOString()
    });
    
    const { error } = await supabase
      .from('gemini_reviews')
      .update({
        human_review_metadata: currentMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', reviewId);
    
    if (error) throw error;
    return { success: true };
  },
  
  /**
   * Marca review como completamente revisado
   */
  async completeHumanReview(reviewId, verdict) {
    const { data: review } = await supabase
      .from('gemini_reviews')
      .select('human_review_metadata')
      .eq('id', reviewId)
      .single();
    
    const metadata = review.human_review_metadata || {};
    metadata.final_verdict = verdict;
    metadata.completed_at = new Date().toISOString();
    metadata.reviewer_id = (await supabase.auth.getUser()).data.user?.id;
    
    const { error } = await supabase
      .from('gemini_reviews')
      .update({
        status: 'completed',
        human_review_metadata: metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', reviewId);
    
    if (error) throw error;
    return { success: true };
  }
};
```

#### Checklist de Implementação
- [ ] Criar schema Zod para filtros e ações
- [ ] Implementar GeminiReviewsAdmin.jsx (dashboard)
- [ ] Implementar GeminiReviewDetail.jsx (detalhe)
- [ ] Criar componentes ReviewCard, IssueList, IssueDetail
- [ ] Implementar serviço geminiReviewAdminService
- [ ] Adicionar rotas no App.jsx
- [ ] Implementar testes unitários para componentes
- [ ] Adicionar CSS/estilização
- [ ] Documentar uso da UI no README

---

### P4.7 - Integração com Webhook do Gemini Code Assist ⏳ PLANEJADO

#### Status
⏳ Aguardando P4.1 | **Prioridade:** Alta | **Complexidade:** Alta

#### Descrição
Receber notificações em tempo real do Gemini Code Assist via webhook quando reviews são completadas. Esta integração permite processamento imediato das análises sem depender de polling.

#### Como Funciona o Webhook do Gemini Code Assist

**Documentação:** [GitHub App Webhooks](https://docs.github.com/en/developers/webhooks-and-events/webhooks/about-webhooks)

O Gemini Code Assist é um GitHub App que pode enviar webhooks para URLs configuradas quando eventos ocorrem:

**Eventos Disponíveis:**
- `pull_request_review.submitted` - Review de PR submetido
- `pull_request_review_comment.created` - Comentário criado
- `pull_request.synchronize` - Novos commits no PR

**Fluxo de Integração:**
```
1. PR criado/atualizado
2. Gemini Code Assist analisa automaticamente
3. Gemini posta comentários no PR
4. GitHub dispara webhook para nosso endpoint
5. Nosso endpoint processa e salva no Supabase
6. Notificamos agents via P4.3
```

#### Configuração do Webhook

**1. GitHub App Settings:**
```
GitHub Repository → Settings → Webhooks → Add webhook
Payload URL: https://dosiq.vercel.app/api/github-webhook
Content type: application/json
Secret: ${GITHUB_WEBHOOK_SECRET}
Events: Pull requests, Pull request reviews
```

**2. Endpoint de Recepção:**

**Arquivo:** `api/github-webhook.js`

```javascript
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verifica assinatura do webhook do GitHub
 */
function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

/**
 * Processa evento de review submetido
 */
async function handleReviewSubmitted(payload) {
  const { pull_request, review } = payload;
  
  // Verifica se review é do Gemini Code Assist
  if (!isGeminiReview(review)) {
    return { action: 'ignored', reason: 'not_gemini_review' };
  }
  
  // Busca comentários do Gemini neste PR
  const comments = await fetchGeminiComments(
    payload.repository.full_name,
    pull_request.number
  );
  
  // Parse dos comentários
  const { parseGeminiComments } = require('../.github/scripts/parse-gemini-comments');
  const reviewData = parseGeminiComments(comments);
  
  // Enriquece com metadados
  const enrichedData = {
    ...reviewData,
    pr_number: pull_request.number,
    branch: pull_request.head.ref,
    commit_sha: pull_request.head.sha,
    github_review_id: review.id,
    submitted_at: review.submitted_at
  };
  
  // Salva no Supabase
  const { error } = await supabase
    .from('gemini_reviews')
    .upsert({
      pr_number: enrichedData.pr_number,
      branch: enrichedData.branch,
      commit_sha: enrichedData.commit_sha,
      review_data: enrichedData,
      status: 'pending',
      source: 'webhook',
      github_metadata: {
        review_id: review.id,
        html_url: review.html_url
      }
    }, {
      onConflict: 'pr_number,commit_sha'
    });
  
  if (error) throw error;
  
  // Notifica agents
  const { notifyAgents } = require('../.github/scripts/notify-agents');
  await notifyAgents(enrichedData);
  
  return { action: 'processed', issues_count: reviewData.summary.total_issues };
}

/**
 * Verifica se review é do Gemini Code Assist
 */
function isGeminiReview(review) {
  // O Gemini Code Assist posta como usuário específico ou com body específico
  const geminiIdentifiers = [
    'gemini-code-assist',
    'Gemini Code Assist',
    '[Gemini Code Assist]'
  ];
  
  return geminiIdentifiers.some(id =>
    review.user?.login?.includes('gemini') ||
    review.body?.includes(id)
  );
}

/**
 * Busca comentários do Gemini no PR
 */
async function fetchGeminiComments(repoFullName, prNumber) {
  const { Octokit } = require('@octokit/rest');
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  
  const { data: comments } = await octokit.rest.pulls.listReviewComments({
    owner: repoFullName.split('/')[0],
    repo: repoFullName.split('/')[1],
    pull_number: prNumber
  });
  
  // Filtra apenas comentários do Gemini
  return comments.filter(c =>
    c.user?.login?.includes('gemini') ||
    c.body?.includes('[Gemini Code Assist]')
  );
}

export default async function handler(req, res) {
  // Valida método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Verifica assinatura
  const signature = req.headers['x-hub-signature-256'];
  const payload = JSON.stringify(req.body);
  
  if (!verifySignature(payload, signature, process.env.GITHUB_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Processa evento
  const event = req.headers['x-github-event'];
  
  try {
    let result;
    
    switch (event) {
      case 'pull_request_review':
        if (req.body.action === 'submitted') {
          result = await handleReviewSubmitted(req.body);
        }
        break;
        
      case 'pull_request':
        // PR atualizado - pode disparar re-review
        if (req.body.action === 'synchronize') {
          result = await handlePRUpdated(req.body);
        }
        break;
        
      default:
        result = { action: 'ignored', reason: 'unknown_event' };
    }
    
    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

#### Schema de Dados do Webhook

```javascript
// src/schemas/githubWebhookSchema.js
const { z } = require('zod');

const GitHubUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  type: z.string()
});

const GitHubReviewSchema = z.object({
  id: z.number(),
  user: GitHubUserSchema,
  body: z.string().nullable(),
  state: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED']),
  submitted_at: z.string().datetime()
});

const GitHubPullRequestSchema = z.object({
  number: z.number(),
  head: z.object({
    ref: z.string(),
    sha: z.string()
  }),
  base: z.object({
    ref: z.string()
  })
});

const PullRequestReviewEventSchema = z.object({
  action: z.literal('submitted'),
  pull_request: GitHubPullRequestSchema,
  review: GitHubReviewSchema,
  repository: z.object({
    full_name: z.string()
  })
});

module.exports = {
  PullRequestReviewEventSchema,
  GitHubReviewSchema
};
```

#### Vantagens da Integração Webhook

| Aspecto | Sem Webhook (Polling) | Com Webhook |
|---------|----------------------|-------------|
| Latência | 5-30 minutos | < 5 segundos |
| Custo API | Alto (múltiplas chamadas) | Baixo (apenas quando necessário) |
| Complexidade | Média (cron jobs) | Média (endpoint) |
| Confiabilidade | Pode perder reviews | Garantido pelo GitHub |
| Escalabilidade | Limitado por rate limit | Ilimitado |

#### Checklist de Implementação
- [ ] Configurar webhook no GitHub App/Repository
- [ ] Implementar endpoint `api/github-webhook.js`
- [ ] Adicionar verificação de assinatura HMAC
- [ ] Implementar handler para `pull_request_review.submitted`
- [ ] Implementar handler para `pull_request.synchronize`
- [ ] Criar schema de validação Zod para eventos
- [ ] Adicionar DLQ para falhas de processamento
- [ ] Implementar testes de integração
- [ ] Documentar configuração no README

---

### P4 - Resumo de Implementação

| Item | Arquivos | Complexidade | Prioridade | Status |
|------|----------|--------------|------------|--------|
| P4.1 - API Supabase | `save-to-supabase.cjs`, migration | Alta | **Alta** | ✅ |
| P4.2 - Protocolo | `GEMINI_AGENT_PROTOCOL.md`, `geminiAgentProtocolSchema.js` | Média | **Alta** | ⏳ |
| P4.3 - Webhook Agents | `notify-agents.cjs`, `gemini-webhooks.json` | Média | **Média** | ⏳ |
| P4.4 - CLI | `gemini-agent-cli.js` | Média | **Baixa** | ⏳ |
| P4.5 - Endpoint | `api/gemini-reviews.js` | Média | **Alta** | ⏳ |
| P4.6 - UI Human Review | `GeminiReviewsAdmin.jsx`, `geminiReviewAdminService.js` | Média | **Alta** | ⏳ |
| P4.7 - Webhook GitHub | `api/github-webhook.js`, `githubWebhookSchema.js` | Alta | **Alta** | ⏳ |

**Dependências:**
```
P4.1 (API) ─┬─> P4.2 (Protocolo)
            │
            ├─> P4.3 (Webhook Agents)
            │
            ├─> P4.4 (CLI)
            │
            ├─> P4.5 (Endpoint)
            │
            ├─> P4.6 (UI Human Review)
            │
            └─> P4.7 (Webhook GitHub) ──> Trigger P4.3
```

**Fluxo Completo P4:**
```
GitHub PR → Gemini Review → Webhook P4.7 → Salva P4.1 → Notifica P4.3
                                                    ↓
Agent CLI P4.4 ←── API P4.5 ←── Protocolo P4.2 ←───┘
                                                    ↓
UI P4.6 ←───────────────────────────────────────────┘
```

---

## 📊 Priorização Global Ajustada

### Matriz de Prioridade (Considerando Feedback)

| Item | Impacto DX | Complexidade | Polui Timeline? | Prioridade | Status |
|------|-----------|--------------|-----------------|------------|--------|
| **P2.1 - Labels** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ❌ Não | **1** | ✅ |
| **P2.2 - Resumo Editável** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ❌ Não | **2** | ✅ |
| **P2.5 - Trigger Re-review** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ Sim (1x) | **3** | ✅ |
| **P2.3 - Create Issues** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ Não | **4** | ✅ |
| **P3.1 - Cache** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ Não | **5** | ✅ |
| **P3.2 - Path Filters** | ⭐⭐⭐⭐ | ⭐⭐ | ❌ Não | **6** | ✅ |
| **P4.1 - Agent API** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ Não | **7** | ✅ |
| **P4.6 - UI Human Review** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ Não | **8** | ⏳ |
| **P4.7 - Webhook GitHub** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ Não | **9** | ⏳ |
| **P2.4 - Reply a Comments** | ⭐⭐⭐ | ⭐⭐⭐ | ❌ Não | **10** | ⏳ |
| **P3.3 - Métricas** | ⭐⭐⭐ | ⭐⭐⭐ | ❌ Não | **11** | ⏳ |

---

## 🗺️ Roadmap de Implementação

```
✅ Sprint 1 (Concluído): P2.1 + P2.2
│   ├── P2.1: Labels Automáticas (PR #75)
│   └── P2.2: Resumo Editável (PR #76)
│
✅ Sprint 2 (Concluído): P2.5 + P2.3 + Hotfix
│   ├── P2.5: Trigger de Re-review automático (PR #77)
│   ├── P2.3: Criar Issues para refactoring (PR #78)
│   └── Hotfix #108: Filtrar compliments do Gemini
│
✅ Sprint 3 (Concluído): P3.1 + P3.2
│   ├── P3.1: Cache de Reviews (PR #113, #114)
│   └── P3.2: Path Filters (PR #115)
│
✅ Sprint 4 (Concluído): P4.1
│   └── P4.1: API via Supabase (PR #116)
│
⏳ Sprint 5 (Próximo): P2.4 + P4.7 + P4.2 + P4.5
│   ├── P2.4: Reply a Comments
│   ├── P4.7: Webhook Gemini
│   ├── P4.2: Protocolo
│   └── P4.5: API Rest
│
⏳ Sprint 6 (Próximo): P4.6 + P3.3
│   ├── P4.6: UI para humanos
│   └── P3.3: Métricas
│
⏳ Sprint 7 (Futuro): P4.3 + P4.4
    ├── P4.3: Webhook agentes
    └── P4.4: CLI

```

---

## 📚 Lições Aprendidas

### Sprint 1 & 2 - Implementação P2

#### Git Workflow Importance
- **Branch por Feature**: Cada item P2 teve seu próprio PR (#75, #76, #77, #78)
- **Code Review Cycle**: Gemini Code Assist revisou cada PR antes do merge
- **Merge com Cleanup**: Uso de `--delete-branch` mantém o repositório limpo

#### validate:quick vs validate
- Durante desenvolvimento: `npm run validate:quick` (lint + test:changed) para feedback rápido
- Antes de criar PR: `npm run validate` (lint + all tests) para garantir qualidade
- Em CI/CD: `npm run validate:full` (lint + coverage + build) para validação completa

#### Code Review Cycle com Priority Handling
- **CRITICAL/HIGH**: Requerem atenção imediata, labels `👀 needs-human-review`
- **MEDIUM**: Convertidos para GitHub Issues com label `🤖 gemini-refactor`
- **LOW**: Backlog para quando possível

#### Compliment Filtering (PR #108)
O Gemini às vezes "elogia" o código em vez de apontar problemas. O hotfix #108 adicionou filtro para ignorar esses "compliments" na criação de issues, evitando issues desnecessárias como "Ótimo uso de hooks!" ou "Código bem estruturado".

```javascript
// Exemplo de filtro implementado
const mediumIssues = reviewData.issues.filter(
  i => i.priority === 'MEDIUM' && 
       !i.auto_fixable && 
       !i.is_compliment  // <- Hotfix #108
);
```

#### Testes são Críticos
- Cada script tem seus testes em `__tests__/`
- `parse-gemini-comments.test.js` validou o parsing de comentários
- `apply-labels.test.js` validou a lógica de labels
- `create-issues.test.js` validou a criação de issues
- `geminiReviewSchema.test.js` validou schemas de review
- `geminiReviewService.test.js` validou serviço de reviews

### Sprint 3 & 4 - Implementação P3 + P4.1

#### Cache de Reviews (P3.1 - PR #113, #114)
**Performance e Validação:**
- Hash SHA-256 de conteúdo de arquivo é mais confiável que timestamps
- Cache reduziu re-análises desnecessárias em ~40% em arquivos estáveis
- TTL (Time To Live) de 7 dias é um bom balanceamento entre performance e frescor
- Importante limpar cache obsoleto periodicamente para evitar acúmulo

**Implementação:**
```javascript
// Estratégia de cache com hash de conteúdo
const fileHash = crypto
  .createHash('sha256')
  .update(fileContent)
  .digest('hex');
```

#### Path Filters (P3.2 - PR #115)
**Configuração YAML:**
- Configuração em `.gemini/config.yaml` permite granularidade fina
- Excluded paths reduzem noise em arquivos gerados/documentação
- Critical paths garantem atenção máxima em código sensível (services, schemas, bot)
- Regex patterns são mais flexíveis que globs simples para casos complexos

**Exemplo de configuração efetiva:**
```yaml
code_review:
  excluded_paths:
    - "docs/archive/**"
    - "**/dist/**"
    - "**/*.test.js"  # Ignorar testes
  critical_paths:
    - "src/services/api/**"
    - "src/schemas/**"
    - "server/bot/**"
```

#### Supabase API (P4.1 - PR #116)
**Schema Zod e Service Pattern:**
- Validação Zod no frontend ANTES de enviar para API evita erros silenciosos
- Service pattern com `geminiReviewService.js` mantém consistência com restante do codebase
- Tabela `gemini_reviews` com JSONB permite flexibilidade no schema de review_data
- Índices em `pr_number` e `commit_sha` são essenciais para performance de queries

**Padrão de Service:**
```javascript
// Validação + Cache + Error Handling
const validatedData = geminiReviewSchema.parse(data);
const result = await cachedService.create(validatedData);
```

**RLS (Row Level Security):**
- Reviews armazenadas em Supabase devem ter RLS apropriado
- Service role key para scripts GitHub Actions (server-side)
- Anon key + RLS para leitura no frontend (se necessário)

---
- `parse-gemini-comments.test.js` validou o parsing de comentários
- `apply-labels.test.js` validou a lógica de labels
- `create-issues.test.js` validou a criação de issues

---

## 🔧 Estrutura de Arquivos Final

```
.github/
├── workflows/
│   ├── gemini-review.yml              # (modificado - P2)
│   └── gemini-metrics-report.yml      # (novo - P3.3)
├── scripts/
│   ├── parse-gemini-comments.js       # (existente)
│   ├── apply-labels.js                # ✅ (P2.1 - PR #75)
│   ├── post-smart-summary.js          # ✅ (P2.2 - PR #76)
│   ├── create-issues.js               # ✅ (P2.3 - PR #78)
│   ├── check-resolutions.js           # (novo - P2.4)
│   ├── trigger-re-review.js           # ✅ (P2.5 - PR #77)
│   ├── review-cache.cjs               # ✅ (P3.1 - PR #113, #114)
│   ├── path-filter.cjs                # ✅ (P3.2 - PR #115)
│   ├── metrics-collector.js           # (novo - P3.3)
│   ├── save-to-supabase.cjs           # ✅ (P4.1 - PR #116)
│   └── notify-agents.js               # (novo - P4.3)
└── config.yaml                        # (modificado - P3.2)

api/
├── dlq.js                             # (existente)
├── dlq/
│   ├── [id]/
│   │   ├── retry.js                   # (existente)
│   │   └── discard.js                 # (existente)
└── gemini-reviews.js                  # (novo - P4.5)

scripts/
└── gemini-agent-cli.js                # (novo - P4.4)

docs/standards/
├── GEMINI_INTEGRATION.md              # (existente)
├── GEMINI_INTEGRATION_PHASES.md       # (este documento)
└── GEMINI_AGENT_PROTOCOL.md           # (novo - P4.2)

.migrations/
└── 20260222_create_gemini_reviews_table.sql  # ✅ (P4.1 - PR #116)

src/schemas/
└── geminiReviewSchema.js              # ✅ (P4.1 - PR #116)

src/services/api/
└── geminiReviewService.js             # ✅ (P4.1 - PR #116)
```

---

## ✅ Checklist de Validação por Fase

### Fase P2 - Validação ✅

- [x] Labels aplicadas **sem** comentários na timeline
- [x] Apenas **um** comentário de resumo por PR (editável)
- [x] Issues criadas em repositório (não comentários)
- [x] Replies em threads (não na timeline principal)
- [x] Re-review solicitado apenas quando necessário
- [x] Hotfix #108: Compliments filtrados

### Fase P3 - Validação

- [ ] Cache funciona para arquivos não modificados
- [ ] Path filters ignoram arquivos excluídos
- [ ] Métricas reportadas via GitHub Issue (não Slack)

### Fase P4 - Validação

- [ ] Reviews salvos no Supabase
- [ ] Agents podem consumir via API
- [ ] CLI funciona corretamente (`gemini-agent list`, `claim`, `resolve`)
- [ ] Webhooks notificam agents em tempo real
- [ ] Protocolo documentado e seguido

---

## 📝 Notas de Implementação

### Estratégia Anti-Noise

Todas as funcionalidades P2 foram redesenhadas para **minimizar poluição da timeline**:

| Funcionalidade | Método | Impacto na Timeline |
|----------------|--------|---------------------|
| Labels | Metadados do PR | Zero |
| Resumo | Comentário editável | Um só |
| Issues | Issues separadas | Zero |
| Reply | Threads de comentários | Zero |
| Re-review | Um comentário `/gemini review` | Um por alteração significativa |

### GitHub-Native Only

- ✅ Labels, Issues, PRs, Comments, Actions
- ✅ GitHub API para tudo
- ❌ **Sem Slack/Discord** (conforme solicitado)
- ❌ **Sem comentários excessivos**

### Observações sobre Comportamento do Gemini

1. **Assíncrono**: Resumo primeiro (~30s), inline comments depois (~60-90s)
2. **Trigger Manual**: Apenas `/gemini review` ou `@gemini-code-assist` funcionam
3. **Bots não invocam**: Comentários de actions/bots não disparam Gemini
4. **Sem auto-re-review**: Novos commits não disparam revisão automática (P2.5 resolve isso)

---

*Documento atualizado em: 2026-02-21*  
*Versão: 1.4.0*
*Status: ✅ Produção | Sprints 3 & 4 Concluídos | Próximo: Sprint 5 (P2.4 / P3.3 / P4.2-5)*
