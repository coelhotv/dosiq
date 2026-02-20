# Plano de Evolução: Gemini Code Assist Integration

> **Fases P2 → P3 → P4 da integração GitHub Actions + Gemini Code Assist**  
> **Versão:** 1.1.0 | Última atualização: 2026-02-20  
> **Status:** 📋 Planejado | **Próxima Fase:** P2

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

### Estado Atual (P1 - Implementado ✅)

| Componente | Status | Arquivo |
|------------|--------|---------|
| Workflow de parsing | ✅ | `.github/workflows/gemini-review.yml` |
| Parser de comentários | ✅ | `.github/scripts/parse-gemini-comments.js` |
| Testes unitários | ✅ | `.github/scripts/__tests__/parse-gemini-comments.test.js` |
| Output estruturado | ✅ | `.gemini-output/review-{pr_number}.json` |
| Documentação | ✅ | `docs/standards/GEMINI_INTEGRATION.md` |

### Próximas Fases Resumidas

| Fase | Nome | Objetivo Principal | Complexidade |
|------|------|-------------------|--------------|
| **P2** | GitHub-Native Automation | Labels, Issues, Reply to Comments (sem poluir timeline) | Média |
| **P3** | Intelligence & Metrics | Cache, Path Filters, Analytics | Alta |
| **P4** | Agent Integration | AI Agents consumindo output | Alta |

---

## 🎯 Fase P2: GitHub-Native Automation

### Objetivo
Aprofundar a integração com recursos nativos do GitHub para automação de workflow, rastreamento de issues e comunicação em PRs - **sem poluir a timeline do PR com comentários repetidos**.

### P2.1 - Labels Automáticas

#### Descrição
Aplicar labels automaticamente aos PRs baseado nos issues encontrados pelo Gemini. Esta abordagem **não adiciona comentários à timeline**, apenas atualiza metadados do PR.

#### Labels Propostas

| Label | Condição | Cor |
|-------|----------|-----|
| `🤖 gemini-reviewed` | Sempre que review completo | `#5319E7` (roxo) |
| `🔧 auto-fix-applied` | Quando auto-fix é aplicado | `#0E8A16` (verde) |
| `👀 needs-human-review` | Issues HIGH/CRITICAL encontrados | `#B60205` (vermelho) |
| `🔒 security-issue` | Issues de segurança detectados | `#D93F0B` (laranja) |
| `⚡ performance-issue` | Issues de performance detectados | `#FBCA04` (amarelo) |
| `📚 needs-docs-update` | Issues relacionados a documentação | `#0075CA` (azul) |

#### Implementação Técnica

**Arquivo:** `.github/scripts/apply-labels.js` (novo)

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

**Modificação:** Adicionar job ao `gemini-review.yml`:

```yaml
# Job 7: Aplicar Labels
apply-labels:
  name: Apply Labels
  needs: [detect, parse]
  if: always() && needs.detect.outputs.should_run == 'true'
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Apply Labels
      uses: actions/github-script@v7
      with:
        script: |
          const { applyLabels } = require('.github/scripts/apply-labels.js');
          const reviewData = require('.gemini-output/review-${{ needs.detect.outputs.pr_number }}.json');
          const labels = await applyLabels(reviewData, ${{ needs.detect.outputs.pr_number }});
          
          await github.rest.issues.addLabels({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: ${{ needs.detect.outputs.pr_number }},
            labels: labels
          });
```

**Arquivos para Criar:**
- `.github/scripts/apply-labels.js`
- `.github/scripts/__tests__/apply-labels.test.js`

**Critérios de Validação:**
- [ ] Labels são aplicadas automaticamente após review
- [ ] Labels removidas quando issues são resolvidos
- [ ] Não duplica labels já existentes
- [ ] **Não adiciona comentários à timeline**

---

### P2.2 - Resumos Inteligentes (Sem Poluir Timeline)

#### Problema Atual
O workflow atual posta um **resumo estruturado** em comentário a cada execução, poluindo a timeline do PR.

#### Solução Proposta: Resumo Único Editável

Postar **apenas um comentário** por PR e **editá-lo** em execuções subsequentes, em vez de criar novos comentários.

#### Implementação Técnica

**Arquivo:** `.github/scripts/post-smart-summary.js` (novo)

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

function generateSummaryBody(reviewData, marker) {
  const timestamp = new Date().toLocaleString('pt-BR');
  
  return `${marker}
## 🤖 Gemini Code Review - Resumo

*Última atualização: ${timestamp}*

### 📊 Estatísticas

| Categoria | Quantidade |
|-----------|------------|
| Total de Issues | ${reviewData.summary.total_issues} |
| Auto-fixable | ${reviewData.summary.auto_fixable} |
| Requer Agente | ${reviewData.summary.needs_agent} |
| Críticos | ${reviewData.summary.critical} |

### 📋 Issues Principais

| Arquivo | Linha | Severidade | Categoria |
|---------|-------|------------|-----------|
${reviewData.issues.slice(0, 10).map(i => 
  `| ${i.file.split('/').pop()} | ${i.line} | ${i.priority} | ${i.category || 'geral'} |`
).join('\n')}

${reviewData.issues.length > 10 ? `*...e mais ${reviewData.issues.length - 10} issues*` : ''}

### 📁 Output Estruturado

O arquivo \`.gemini-output/review-${reviewData.pr_number}.json\` foi gerado com todos os issues parseados.

---
💡 *Este comentário é atualizado automaticamente a cada review.*
`;
}

module.exports = { postOrUpdateSummary };
```

**Modificação no Workflow:**

```yaml
# Job 6: Postar Resumo (ATUALIZADO - edição ao invés de novo comentário)
post-summary:
  name: Post/Update Summary
  needs: [detect, parse, validate]
  if: always() && needs.detect.outputs.should_run == 'true'
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Post or Update Summary
      uses: actions/github-script@v7
      with:
        script: |
          const { postOrUpdateSummary } = require('.github/scripts/post-smart-summary.js');
          const reviewData = require('.gemini-output/review-${{ needs.detect.outputs.pr_number }}.json');
          await postOrUpdateSummary(reviewData, ${{ needs.detect.outputs.pr_number }}, github, context);
```

**Critérios de Validação:**
- [ ] Apenas **um** comentário de resumo por PR
- [ ] Comentário é **editado** em execuções subsequentes
- [ ] Timestamp mostra última atualização
- [ ] Timeline do PR não é poluída

---

### P2.3 - Criação de GitHub Issues (Para Issues Não-Críticos)

#### Descrição
Criar GitHub Issues automaticamente para issues MEDIUM que não podem ser auto-fixados. Esta abordagem move discussões de refactoring para fora da timeline do PR.

#### Estratégia de Prioridade

| Prioridade | Ação | Timeline |
|------------|------|----------|
| CRITICAL | Label no PR + notificação | Imediato |
| HIGH | Label no PR + destaque no resumo | Imediato |
| MEDIUM | **GitHub Issue** + Label no PR | Sprint |
| LOW | GitHub Issue (backlog) | Quando possível |

#### Implementação Técnica

**Arquivo:** `.github/scripts/create-issues.js` (novo)

```javascript
/**
 * Cria GitHub Issues para issues não-críticos
 * @param {Object} reviewData - Dados do review
 * @param {number} prNumber - Número do PR
 * @returns {Promise<number[]>} IDs das issues criadas
 */
async function createIssuesFromReview(reviewData, prNumber, github, context) {
  const createdIssues = [];
  
  // Filtrar apenas MEDIUM que não são auto-fixable
  const mediumIssues = reviewData.issues.filter(
    i => i.priority === 'MEDIUM' && !i.auto_fixable
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

function generateIssueBody(issue, prNumber) {
  return `## 🤖 Identificado pelo Gemini Code Assist

### Issue
${issue.issue}

### Arquivo
[${issue.file}](${issue.url}) (linha ${issue.line})

### Sugestão
\`\`\`${issue.language || 'javascript'}
${issue.suggestion}
\`\`\`

### Contexto
- **PR:** #${prNumber}
- **Prioridade:** ${issue.priority}
- **Categoria:** ${issue.category || 'geral'}

### Checklist
- [ ] Avaliar se a sugestão faz sentido para o projeto
- [ ] Implementar alteração se aprovada
- [ ] Atualizar testes se necessário
- [ ] Marcar como concluída

---
*Issue criada automaticamente pelo Gemini Code Assist Integration*
`;
}

/**
 * Verifica se existe issue similar já criada
 */
async function findSimilarIssue(issue, github, context) {
  const { data: issues } = await github.rest.issues.listForRepo({
    owner: context.repo.owner,
    repo: context.repo.repo,
    labels: '🤖 gemini-refactor',
    state: 'open'
  });
  
  // Verificar se alguma issue menciona o mesmo arquivo + linha similar
  return issues.find(i => 
    i.body.includes(issue.file) && 
    i.body.includes(`linha ${issue.line}`)
  );
}

module.exports = { createIssuesFromReview };
```

**Modificação no Workflow:**

```yaml
# Job 8: Criar Issues para Refactoring
# Só executa se houver issues MEDIUM não-auto-fixable
create-issues:
  name: Create GitHub Issues
  needs: [detect, parse]
  if: always() && needs.detect.outputs.should_run == 'true'
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Create Issues
      uses: actions/github-script@v7
      with:
        script: |
          const { createIssuesFromReview } = require('.github/scripts/create-issues.js');
          const reviewData = require('.gemini-output/review-${{ needs.detect.outputs.pr_number }}.json');
          
          // Só criar issues se houver MEDIUM não-auto-fixable
          const mediumIssues = reviewData.issues.filter(i => 
            i.priority === 'MEDIUM' && !i.auto_fixable
          );
          
          if (mediumIssues.length === 0) {
            console.log('Nenhum issue MEDIUM para criar');
            return;
          }
          
          const issues = await createIssuesFromReview(
            reviewData, 
            ${{ needs.detect.outputs.pr_number }},
            github,
            context
          );
          
          if (issues.length > 0) {
            console.log(`Criadas ${issues.length} issues: ${issues.map(i => '#' + i).join(', ')}`);
          }
```

**Arquivos para Criar:**
- `.github/scripts/create-issues.js`
- `.github/scripts/__tests__/create-issues.test.js`

**Critérios de Validação:**
- [ ] Issues são criadas apenas para MEDIUM não-auto-fixable
- [ ] Não cria issues duplicadas
- [ ] **Não adiciona comentários à timeline do PR**
- [ ] Issues linkadas ao PR via referência

---

### P2.4 - Reply Estratégico a Comentários do Gemini

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

/**
 * Verifica se uma linha específica foi modificada entre dois commits
 */
async function checkIfLineChanged(filePath, line, oldCommit, newCommit, github, context) {
  try {
    const { data: diff } = await github.rest.repos.compareCommits({
      owner: context.repo.owner,
      repo: context.repo.repo,
      base: oldCommit,
      head: newCommit
    });
    
    // Verificar se o arquivo foi modificado
    const fileDiff = diff.files.find(f => f.filename === filePath);
    if (!fileDiff) return false;
    
    // Analisar patch para ver se a linha foi modificada
    // Simplificação: assumimos resolvido se o arquivo foi tocado
    return true;
  } catch (error) {
    console.error('Erro ao comparar commits:', error);
    return false;
  }
}

module.exports = { checkResolutions };
```

**Novo Trigger no Workflow:**

```yaml
on:
  # ... triggers existentes ...
  
  # NOVO: Verificar resoluções quando PR é atualizado
  pull_request:
    types: [synchronize]

jobs:
  # NOVO: Job para verificar resoluções de issues
  check-resolutions:
    name: Check Issue Resolutions
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request' && github.event.action == 'synchronize'
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Check Resolved Issues
        uses: actions/github-script@v7
        with:
          script: |
            const { checkResolutions } = require('.github/scripts/check-resolutions.js');
            await checkResolutions(
              context.payload.pull_request.number,
              github,
              context
            );
```

**Arquivos para Criar:**
- `.github/scripts/check-resolutions.js`

**Critérios de Validação:**
- [ ] Replies são postados em threads dos comentários inline
- [ ] Apenas quando código é realmente modificado
- [ ] **Não cria novos comentários na timeline principal**

---

### P2.5 - Trigger de Revisão em Novos Commits

#### Problema Observado
Novos commits no mesmo PR **não** disparam revisão automática do Gemini, apesar do workflow postar resumos.

#### Solução: Comentário Automático de Trigger

Adicionar um job que posta um comentário `/gemini review` quando detectar alterações significativas em novos commits.

#### Implementação Técnica

**Arquivo:** `.github/scripts/trigger-re-review.js` (novo)

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

**Modificação no Workflow:**

```yaml
  # NOVO: Job para trigger de re-review
  trigger-rereview:
    name: Trigger Re-review
    runs-on: ubuntu-latest
    needs: detect
    if: github.event_name == 'pull_request' && github.event.action == 'synchronize'
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Check and Trigger Re-review
        uses: actions/github-script@v7
        with:
          script: |
            const { shouldTriggerRereview, triggerRereview } = require('.github/scripts/trigger-re-review.js');
            
            const shouldTrigger = await shouldTriggerRereview(
              ${{ needs.detect.outputs.pr_number }},
              github,
              context
            );
            
            if (shouldTrigger) {
              console.log('Alterações significativas detectadas, solicitando re-review...');
              await triggerRereview(
                ${{ needs.detect.outputs.pr_number }},
                github,
                context
              );
            } else {
              console.log('Alterações menores, sem necessidade de re-review');
            }
```

**Arquivos para Criar:**
- `.github/scripts/trigger-re-review.js`

**Critérios de Validação:**
- [ ] Re-review é solicitado apenas para alterações significativas
- [ ] Critérios configuráveis (arquivos críticos, linhas alteradas)
- [ ] Não spamma re-reviews desnecessários

---

### P2 - Resumo de Implementação

| Item | Arquivos | Job no Workflow | Prioridade | Polui Timeline? |
|------|----------|-----------------|------------|-----------------|
| P2.1 - Labels | `apply-labels.js` + testes | `apply-labels` | **Alta** | ❌ Não |
| P2.2 - Resumo Editável | `post-smart-summary.js` | `post-summary` | **Alta** | ❌ Não (edita) |
| P2.3 - Create Issues | `create-issues.js` + testes | `create-issues` | **Média** | ❌ Não |
| P2.4 - Reply a Comments | `check-resolutions.js` | `check-resolutions` | **Média** | ❌ Não (threads) |
| P2.5 - Trigger Re-review | `trigger-re-review.js` | `trigger-rereview` | **Média** | ✅ Sim (1x) |

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

### P3.1 - Cache de Reviews

#### Descrição
Evitar re-análise de código não alterado usando hash de conteúdo.

#### Implementação Técnica

**Arquivo:** `.github/scripts/review-cache.js` (novo)

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

### P3.2 - Filtros de Path Inteligentes

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

### P4.1 - API para Agentes (Supabase)

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

### P4.2 - Protocolo Padronizado para Agents

#### Descrição
Definir especificação formal para comunicação entre o sistema de reviews e agents de IA.

#### Documentação

**Arquivo:** `docs/standards/GEMINI_AGENT_PROTOCOL.md` (novo)

```markdown
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

### P4.3 - Webhook para Notificação de Agents

#### Descrição
Notificar agents automaticamente quando novos reviews estão disponíveis.

#### Implementação

**Arquivo:** `.github/scripts/notify-agents.js` (novo)

```javascript
/**
 * Notifica agents sobre novo review disponível
 * @param {Object} reviewData - Dados do review
 */
async function notifyAgents(reviewData) {
  const AGENT_WEBHOOKS = [
    process.env.KILOCODE_WEBHOOK_URL,
    // Adicionar mais agents conforme necessário
  ].filter(Boolean);
  
  for (const webhook of AGENT_WEBHOOKS) {
    try {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AGENT_WEBHOOK_SECRET}`,
          'X-Gemini-Event': 'review_available'
        },
        body: JSON.stringify({
          event: 'gemini_review_available',
          pr_number: reviewData.pr_number,
          branch: reviewData.branch,
          issue_count: reviewData.summary.total_issues,
          critical_count: reviewData.summary.critical,
          api_endpoint: `${process.env.API_BASE}/api/gemini-reviews?pr_number=${reviewData.pr_number}`
        })
      });
      
      if (!response.ok) {
        console.error(`Webhook falhou: ${webhook} - ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to notify agent:`, error);
    }
  }
}

module.exports = { notifyAgents };
```

---

### P4.4 - CLI para Agents

#### Descrição
Interface de linha de comando que agents podem usar para interagir com o sistema de reviews.

#### Implementação

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

### P4.5 - API Endpoint (Vercel)

#### Descrição
Endpoint REST para agents consumirem dados.

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

---

### P4 - Resumo de Implementação

| Item | Arquivos | Complexidade | Prioridade |
|------|----------|--------------|------------|
| P4.1 - API Supabase | `save-to-supabase.js`, migration | Alta | **Alta** |
| P4.2 - Protocolo | `GEMINI_AGENT_PROTOCOL.md` | Média | **Alta** |
| P4.3 - Webhook | `notify-agents.js` | Média | **Média** |
| P4.4 - CLI | `gemini-agent-cli.js` | Média | **Baixa** |
| P4.5 - Endpoint | `api/gemini-reviews.js` | Média | **Alta** |

**Dependências:**
```
P4.1 (API) ─┬─> P4.2 (Protocolo)
            │
            ├─> P4.3 (Webhook)
            │
            ├─> P4.4 (CLI)
            │
            └─> P4.5 (Endpoint)
```

---

## 📊 Priorização Global Ajustada

### Matriz de Prioridade (Considerando Feedback)

| Item | Impacto DX | Complexidade | Polui Timeline? | Prioridade |
|------|-----------|--------------|-----------------|------------|
| **P2.1 - Labels** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ❌ Não | **1** |
| **P2.2 - Resumo Editável** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ❌ Não | **2** |
| **P2.5 - Trigger Re-review** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ Sim (1x) | **3** |
| **P2.3 - Create Issues** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ Não | **4** |
| **P3.1 - Cache** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ Não | **5** |
| **P3.2 - Path Filters** | ⭐⭐⭐⭐ | ⭐⭐ | ❌ Não | **6** |
| **P4.1 - Agent API** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ Não | **7** |
| **P2.4 - Reply a Comments** | ⭐⭐⭐ | ⭐⭐⭐ | ❌ Não | **8** |
| **P3.3 - Métricas** | ⭐⭐⭐ | ⭐⭐⭐ | ❌ Não | **9** |

### Roadmap de Implementação Ajustado

```
Sprint 1 (Reduzir Noise + Automatizar)
├── P2.1: Labels Automáticas (sem comentários)
└── P2.2: Resumo Editável (um comentário só)

Sprint 2 (Melhorar Workflow)
├── P2.5: Trigger de Re-review automático
└── P2.3: Criar Issues para refactoring
└── P2.4: Reply a Comments

Sprint 3 (Otimização)
├── P3.1: Cache de Reviews
└── P3.2: Path Filters

Sprint 4 (Agent Integration)
└── P4.1: API via Supabase
```

---

## 🔧 Estrutura de Arquivos Final

```
.github/
├── workflows/
│   ├── gemini-review.yml              # (modificado)
│   └── gemini-metrics-report.yml      # (novo - P3.3)
├── scripts/
│   ├── parse-gemini-comments.js       # (existente)
│   ├── apply-labels.js                # (novo - P2.1)
│   ├── post-smart-summary.js          # (novo - P2.2)
│   ├── create-issues.js               # (novo - P2.3)
│   ├── check-resolutions.js           # (novo - P2.4)
│   ├── trigger-re-review.js           # (novo - P2.5)
│   ├── review-cache.js                # (novo - P3.1)
│   ├── path-filter.js                 # (novo - P3.2)
│   ├── metrics-collector.js           # (novo - P3.3)
│   ├── save-to-supabase.js            # (novo - P4.1)
│   └── notify-agents.js               # (novo - P4.3)
└── config.yaml                        # (modificado - P3.2)

api/
└── gemini-reviews.js                  # (novo - P4.5)

scripts/
└── gemini-agent-cli.js                # (novo - P4.4)

docs/standards/
├── GEMINI_INTEGRATION.md              # (existente)
└── GEMINI_AGENT_PROTOCOL.md           # (novo - P4.2)

supabase/migrations/
└── 00X_create_gemini_reviews_table.sql  # (novo - P4.1)
```

---

## ✅ Checklist de Validação por Fase

### Fase P2 - Validação

- [ ] Labels aplicadas **sem** comentários na timeline
- [ ] Apenas **um** comentário de resumo por PR (editável)
- [ ] Issues criadas em repositório (não comentários)
- [ ] Replies em threads (não na timeline principal)
- [ ] Re-review solicitado apenas quando necessário

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
4. **Sem auto-re-review**: Novos commits não disparam revisão automática (precisamos de P2.5)

---

*Documento atualizado em: 2026-02-20*
*Versão: 1.2.0*
*Status: 📋 Planejado | Próximo: Implementação P2.1 + P2.2*