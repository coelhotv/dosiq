# Gemini Integration Fixes - Technical Specification

> **Version:** 1.0.0  
> **Created:** 2026-02-25  
> **Status:** Draft for Review

---

## Executive Summary

This specification addresses five critical issues in the Gemini Code Assist integration that are causing noise, incorrect issue creation, and suboptimal developer experience. The fixes are designed to be implemented incrementally with minimal risk to existing functionality.

### Problems Summary

| # | Problem | Impact | Priority |
|---|---------|--------|----------|
| 1 | All Gemini comments become issues regardless of priority | CRITICAL/HIGH issues should block workflow, not create issues | **HIGH** |
| 2 | Wrong prefix `[Refactor]` in issue titles | Loses priority context, misleads developers | **MEDIUM** |
| 3 | Ghost issues from compliments | Creates unnecessary issues from praise comments | **MEDIUM** |
| 4 | Timeline comments instead of inline replies | Pollutes PR timeline, doesn't notify Gemini | **MEDIUM** |
| 5 | Duplicate issues in summary on re-reviews | Noise in summary, incorrect counts | **LOW** |

### Proposed Solutions Overview

```
Problem 1: Priority-based workflow control
  - CRITICAL/HIGH: Block workflow, alert developer, NO issue creation
  - MEDIUM/LOW: Create GitHub issues (current behavior)

Problem 2: Dynamic prefix based on Gemini classification
  - Use original priority: [High], [Medium], [Low]
  - CRITICAL never creates issues (handled by Problem 1)

Problem 3: Compliment detection filter
  - Add sentiment analysis before issue creation
  - Filter out "Good catch!", "Nice fix!", etc.

Problem 4: Inline reply to Gemini comments
  - Use GitHub reply API instead of timeline comment
  - Start with @gemini-code-assist for notification

Problem 5: Deduplication in summary generation
  - Track reported comment IDs in summary marker
  - Only count new issues since last report
```

---

## Problem Analysis

### Problem 1: All Gemini Comments Become Issues

#### Current Behavior

The [`create-issues.js`](api/gemini-reviews/create-issues.js) endpoint creates GitHub issues for ALL pending reviews with `status='detected'` and `priority='media'`. The workflow in [`gemini-review.yml`](.github/workflows/gemini-review.yml) (lines 960-1075) calls this endpoint without checking priority.

**Root Cause:** The `fetchPendingIssues()` function (lines 302-332) only filters by `priority='media'`, but the workflow doesn't distinguish between priorities before calling the endpoint.

**Current Flow:**
```
Gemini Review (any priority) 
  -> persist.js (stores all)
  -> create-issues.js (creates issues for media only)
  -> No blocking for CRITICAL/HIGH
```

#### Expected Behavior

```
Gemini Review (CRITICAL/HIGH)
  -> persist.js (stores all)
  -> Block workflow
  -> Alert developer via PR comment
  -> Wait for fix before proceeding

Gemini Review (MEDIUM/LOW)
  -> persist.js (stores all)
  -> create-issues.js (creates issues)
  -> Continue workflow
```

#### Technical Changes Required

**File: `.github/workflows/gemini-review.yml`**

Add a new job `check-critical` after `parse` job:

```yaml
# ==========================================
# JOB 3.6: Check for Critical/High Issues
# ==========================================
# CRITICAL/HIGH issues should block the workflow
# and alert the developer instead of creating issues
# ==========================================
check-critical:
  name: Check Critical/High Issues
  runs-on: ubuntu-latest
  needs: [detect, parse]
  if: always() && needs.parse.result == 'success'
  outputs:
    has_blocking_issues: ${{ steps.check.outputs.has_blocking_issues }}
  
  steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Download Output
      uses: actions/download-artifact@v4
      with:
        name: gemini-review-output
        path: .gemini-output/
      continue-on-error: true
    
    - name: Check for Blocking Issues
      id: check
      uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs');
          
          let reviewData;
          try {
            reviewData = JSON.parse(fs.readFileSync(`.gemini-output/review-${{ needs.detect.outputs.pr_number }}.json`, 'utf8'));
          } catch (e) {
            console.log('No review data found');
            core.setOutput('has_blocking_issues', 'false');
            return;
          }
          
          const criticalIssues = reviewData.issues.filter(i => i.severity === 'CRITICAL');
          const highIssues = reviewData.issues.filter(i => i.severity === 'HIGH');
          const securityIssues = reviewData.issues.filter(i => i.category === 'security');
          
          const blockingIssues = [...criticalIssues, ...highIssues, ...securityIssues];
          
          if (blockingIssues.length > 0) {
            console.log(`Found ${blockingIssues.length} blocking issues`);
            core.setOutput('has_blocking_issues', 'true');
            
            // Post blocking comment on PR
            const body = `## \u26a0\ufe0f Workflow Blocked - Critical Issues Found
            
The Gemini Code Assist review found **${blockingIssues.length}** issue(s) that require immediate attention:

| Priority | File | Line | Issue |
|----------|------|------|-------|
${blockingIssues.map(i => `| ${i.severity} | ${i.file} | ${i.line || '-'} | ${i.issue?.substring(0, 50)}... |`).join('\n')}

**Action Required:** Please fix these issues before proceeding. The workflow will remain blocked until all CRITICAL/HIGH issues are resolved.

After fixing, push a new commit to trigger a re-review.`;

            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: ${{ needs.detect.outputs.pr_number }},
              body: body
            });
          } else {
            console.log('No blocking issues found');
            core.setOutput('has_blocking_issues', 'false');
          }
```

**Modify `create-issues` job condition:**

```yaml
create-issues:
  name: Create GitHub Issues via Vercel API
  runs-on: ubuntu-latest
  needs: [detect, parse, upload-to-blob, check-critical]
  # Only create issues if NO blocking issues exist
  if: always() && needs.detect.outputs.should_run == 'true' && needs.upload-to-blob.result == 'success' && needs.check-critical.outputs.has_blocking_issues == 'false'
```

---

### Problem 2: Wrong Prefix in Issue Titles

#### Current Behavior

In [`create-issues.js`](api/gemini-reviews/create-issues.js) line 178:

```javascript
title: `[Refactor] ${issue.title}`,
```

All issues get `[Refactor]` prefix regardless of actual priority.

#### Expected Behavior

Issues should use the original Gemini classification as prefix:
- `[High]` for HIGH priority
- `[Medium]` for MEDIUM priority
- `[Low]` for LOW priority
- CRITICAL should not create issues (handled by Problem 1)

#### Technical Changes Required

**File: `api/gemini-reviews/create-issues.js`**

Modify `createGitHubIssue()` function (lines 157-207):

```javascript
async function createGitHubIssue(issue, prNumber, owner, repo, token) {
  const body = buildIssueBody(issue, prNumber)
  
  // Map priority to prefix
  const priorityPrefix = {
    'critica': 'Critical',
    'alta': 'High',
    'media': 'Medium',
    'baixa': 'Low'
  };
  const prefix = priorityPrefix[issue.priority] || 'Medium';
  
  logGitHub(ENDPOINT, 'createIssue', {
    owner,
    repo,
    issueTitle: issue.title?.substring(0, 50),
    prNumber,
    priority: issue.priority,
    prefix
  })

  const response = await fetchWithRetry(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `[${prefix}] ${issue.title}`,  // Dynamic prefix
        body: body,
        labels: [
          REFACTOR_LABELS.GEMINI_REFACTOR,
          REFACTOR_LABELS.REFACTORING,
          `priority:${issue.priority}`,
        ],
      }),
    },
    3 // maxRetries
  )
  // ... rest of function
}
```

---

### Problem 3: Ghost Issues from Compliments

#### Current Behavior

The parser in [`parse-gemini-comments.cjs`](.github/scripts/parse-gemini-comments.cjs) extracts all comments without filtering out compliments. Comments like "Good catch!" or "Nice fix!" are treated as issues.

**Real-World Examples from PR #168:**

| Issue # | Gemini Comment Body | Problem |
|---------|---------------------|---------|
| #171 | "Fico feliz em saber que a correção foi aplicada. Ótimo trabalho em garantir que os logs não sejam mais versionados..." | Compliment created as issue |
| #172 | "Excelente! A adição da condição `if (expected === 0) return 'sem_doses'` no início é uma melhoria muito boa... Ótimo trabalho!" | Compliment created as issue |

**Key Observation:** Compliment comments from Gemini do NOT have priority badges (`![medium](...)`), while actual issues DO have badges. This is a reliable differentiator.

**Root Cause:** No sentiment detection or compliment filtering in the parsing pipeline. The parser treats all Gemini comments equally.

#### Expected Behavior

Filter out comments that are:
- Compliments ("Good catch!", "Nice fix!", "Well done!", "Ótimo trabalho!", "Excelente!")
- Acknowledgments ("I see you've fixed this", "Thanks for the update", "Fico feliz em saber...")
- Non-actionable feedback
- Comments WITHOUT priority badges (these are typically acknowledgments)

#### Technical Changes Required

**File: `.github/scripts/parse-gemini-comments.cjs`**

Add compliment detection function. Based on real-world analysis, compliments from Gemini:
1. Do NOT have priority badges (no `![medium](...)` image)
2. Contain positive sentiment words in Portuguese: "Ótimo trabalho", "Excelente", "Fico feliz"

```javascript
/**
 * Padrões de comentários que NÃO são problemas
 * Inclui elogios, reconhecimentos de correção e feedback não-acionável
 * 
 * IMPORTANTE: Gemini usa badges de prioridade para issues reais.
 * Comentários sem badge são tipicamente acknowledgments/compliments.
 */
const COMPLIMENT_PATTERNS = [
  // Elogios gerais (Português)
  /ótimo\s*(trabalho|job|trabalho)/i,
  /excelente/i,
  /fico\s*feliz/i,
  /bom\s*trabalho/i,
  /muito\s*bom/i,
  /boa\s*(implementação|correção|solução)/i,
  
  // Elogios gerais (Inglês)
  /good\s*(catch|job|work|point|find)/i,
  /nice\s*(fix|work|job|catch|solution)/i,
  /well\s*(done|spotted|found)/i,
  /great\s*(job|work|fix|solution)/i,
  /thanks?\s*(for|to)/i,
  /thank\s*you/i,
  
  // Reconhecimento de correção
  /correção\s*(foi|aplicada|aplicada)/i,
  /i\s*see\s*(you|this|that)\s*(have|has|'ve)\s*(fixed|corrected|addressed)/i,
  /this\s*(has\s*been|is)\s*(fixed|corrected|addressed|resolved)/i,
  /already\s*(fixed|corrected|addressed)/i,
  /looks\s*(good|better|correct)/i,
  /properly\s*(fixed|handled|implemented)/i,
  
  // Confirmação não-acionável
  /^correct$/i,
  /^agreed$/i,
  /makes\s*sense/i,
  /reasonable/i,
  /acceptable/i,
  
  // Marcadores de aprovação
  /^lgtm$/i,
  /^sgtm$/i,
  /^looks good to me$/i,
  /^seems good to me$/i,
  /^approved$/i,
];

/**
 * Verifica se um comentário é um elogio ou reconhecimento
 * e não deve ser transformado em issue
 * 
 * @param {string} body - Corpo do comentário
 * @returns {boolean} True se é um comentário não-acionável
 */
function isCompliment(body) {
  if (!body) return false;
  
  // KEY INSIGHT: Gemini issues reais SEMPRE têm badge de prioridade
  // ![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)
  // Comentários sem badge são tipicamente compliments/acknowledgments
  const hasPriorityBadge = /!\[(critical|high|medium)\]\([^)]+\)/i.test(body);
  
  if (!hasPriorityBadge) {
    console.log(`[FILTER] No priority badge - likely compliment: "${body.substring(0, 50)}..."`);
    return true;
  }
  
  const normalizedBody = body
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove badges
    .replace(/```[\s\S]*?```/g, '')   // Remove code blocks
    .trim();
  
  // Se o corpo está vazio após limpeza, não é elogio
  if (!normalizedBody) return false;
  
  // Verificar padrões de elogio
  for (const pattern of COMPLIMENT_PATTERNS) {
    if (pattern.test(normalizedBody)) {
      console.log(`[FILTER] Compliment detected: "${normalizedBody.substring(0, 50)}..."`);
      return true;
    }
  }
  
  // Verificar se o comentário é muito curto (< 20 chars) e positivo
  if (normalizedBody.length < 20) {
    const positiveWords = ['good', 'nice', 'ok', 'done', 'fixed', 'correct', 'bom', 'ótimo'];
    const hasPositive = positiveWords.some(w => normalizedBody.toLowerCase().includes(w));
    if (hasPositive) {
      console.log(`[FILTER] Short positive comment: "${normalizedBody}"`);
      return true;
    }
  }
  
  return false;
}

/**
 * Filtra comentários que são elogios ou não-acionáveis
 * 
 * @param {Array<Object>} comments - Comentários parseados
 * @returns {Array<Object>} Comentários filtrados
 */
function filterCompliments(comments) {
  const filtered = comments.filter(c => !isCompliment(c.raw || c.issue));
  
  const removed = comments.length - filtered.length;
  if (removed > 0) {
    console.log(`[FILTER] Removed ${removed} compliment(s) from ${comments.length} total comments`);
  }
  
  return filtered;
}
```

Modify `generateStructuredOutput()` function:

```javascript
function generateStructuredOutput(prNumber, reviewId, parsedComments) {
  // Filter out compliments BEFORE categorization
  const filteredComments = filterCompliments(parsedComments);
  
  const categorized = categorizeIssues(filteredComments);
  
  return {
    pr_number: prNumber,
    review_id: reviewId,
    timestamp: new Date().toISOString(),
    summary: {
      total_issues: filteredComments.length,
      auto_fixable: categorized.autoFixable.length,
      needs_agent: categorized.needsAgent.length,
      critical: categorized.critical.length,
      filtered_compliments: parsedComments.length - filteredComments.length
    },
    issues: filteredComments.map(c => ({
      // ... existing mapping
    })),
    // ... rest of output
  };
}
```

Update exports:

```javascript
module.exports = {
  parseGeminiComment,
  categorizeIssues,
  normalizePriority,
  isAutoFixable,
  isSecurityIssue,
  generateStructuredOutput,
  categorizeIssue,
  generateAutoFixCommands,
  // New exports
  isCompliment,
  filterCompliments,
  COMPLIMENT_PATTERNS
};
```

---

### Problem 4: Timeline Comments Instead of Inline Replies

#### Current Behavior

In [`create-issues.js`](api/gemini-reviews/create-issues.js) lines 217-256, the `commentOnPR()` function posts a timeline comment:

```javascript
await github.rest.issues.createComment({
  owner: context.repo.owner,
  repo: context.repo.repo,
  issue_number: prNumber,
  body: `...`
});
```

**Real-World Example from PR #168:**

The workflow posted this timeline comment:
```
## 🤖 Issues de Refactoring Criadas

Foram criadas as seguintes issues para acompanhamento de refactoring:

- #169
- #170

Estas issues podem ser implementadas em um PR futuro.
```

This creates a comment on the PR timeline, not a reply to the specific Gemini comment. The Gemini bot is NOT notified.

#### Expected Behavior

Reply inline to the specific Gemini comment with:
1. Reference to the created issue
2. Start with `@gemini-code-assist` for notification

#### Technical Changes Required

**File: `api/gemini-reviews/create-issues.js`**

The endpoint needs access to the original Gemini comment ID. This requires:

1. **Store comment ID in Supabase** (modify `persist.js`)
2. **Pass comment ID to create-issues** (modify workflow)
3. **Reply to comment instead of timeline** (modify `create-issues.js`)

**Step 1: Modify `persist.js` to store comment_id**

Add `comment_id` to the issue schema and insert data:

```javascript
// In issueSchema (line 63)
const issueSchema = z.object({
  // ... existing fields
  id: z.number().int().optional(),        // GitHub comment ID
  comment_id: z.number().int().optional(), // Alias for clarity
  url: z.string().url().optional(),        // Comment URL
});

// In createNewIssue() function (line 317)
const insertData = {
  // ... existing fields
  comment_id: issue.id || issue.comment_id || null,
  comment_url: issue.url || null,
};
```

**Step 2: Modify `create-issues.js` to reply inline**

Replace `commentOnPR()` function:

```javascript
/**
 * Responde inline ao comentário do Gemini com referência à issue
 * @param {number} commentId - ID do comentário do Gemini
 * @param {number} issueNumber - Número da issue criada
 * @param {string} owner - Owner do repositório
 * @param {string} repo - Nome do repositório
 * @param {string} token - Token GitHub
 * @param {number} prNumber - Número do PR
 */
async function replyToGeminiComment(commentId, issueNumber, owner, repo, token, prNumber) {
  logGitHub(ENDPOINT, 'replyToGeminiComment', {
    commentId,
    issueNumber,
    prNumber,
  });

  // Se não temos o comment_id, fallback para timeline comment
  if (!commentId) {
    console.log('No comment_id provided, falling back to timeline comment');
    return commentOnPR(prNumber, issueNumber, owner, repo, token);
  }

  try {
    // GitHub API para responder a um review comment
    // Nota: pulls.createReplyForReviewComment requer in_reply_to
    // Usamos creates a new discussion comment instead
    
    const response = await fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments/${commentId}/replies`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: `@gemini-code-assist **Issue de Refactoring Criada**

Issue #${issueNumber} foi criada para acompanhamento desta sugestão.

Acesse: https://github.com/${owner}/${repo}/issues/${issueNumber}`,
        }),
      },
      3 // maxRetries
    );

    if (!response.ok) {
      // Se falhar (ex: não é um review comment), fallback para timeline
      console.log(`Inline reply failed (${response.status}), falling back to timeline comment`);
      return commentOnPR(prNumber, issueNumber, owner, repo, token);
    }

    logGitHub(ENDPOINT, 'inlineReplyCreated', { commentId, issueNumber });
  } catch (error) {
    logError(ENDPOINT, 'Exception in inline reply', error, { commentId, issueNumber });
    // Fallback para timeline comment
    return commentOnPR(prNumber, issueNumber, owner, repo, token);
  }
}
```

**Step 3: Update `createIssuesFromReview()` to use inline reply**

```javascript
// In the loop (around line 476)
// Replace:
await commentOnPR(pr_number, githubIssue.number, owner, repo, githubToken);

// With:
await replyToGeminiComment(
  issue.comment_id,  // From Supabase
  githubIssue.number,
  owner,
  repo,
  githubToken,
  pr_number
);
```

**Step 4: Update `pendingIssueSchema` to include comment_id**

```javascript
const pendingIssueSchema = z.object({
  // ... existing fields
  comment_id: z.number().int().nullable().optional(),
  comment_url: z.string().url().nullable().optional(),
});
```

---

### Problem 5: Duplicate Issues in Summary on Re-reviews

#### Current Behavior

In [`post-smart-summary.cjs`](.github/scripts/post-smart-summary.cjs), the `generateSummaryBody()` function counts ALL issues in the review data, not just new ones since the last report.

**Real-World Example from PR #168:**

The summary shows duplicate entries:
```
| Arquivo | Linha | Severidade | Categoria |
|---------|-------|------------|-----------|
| installhook\-bugs\.txt | 1 | MEDIUM | general |
| doseCalendarService\.js | 211 | MEDIUM | general |
| installhook\-bugs\.txt | 1 | MEDIUM | general |      <- DUPLICATE
| doseCalendarService\.js | 211 | MEDIUM | general |  <- DUPLICATE
```

The same issues appear multiple times because each re-review re-counts all issues without deduplication.

**Root Cause:** No tracking of which issues have been reported in previous summaries.

#### Expected Behavior

1. Track which comment IDs have been reported in the summary marker
2. Only count NEW issues (not previously reported)
3. Show "X new issues since last report"

#### Technical Changes Required

**File: `.github/scripts/post-smart-summary.cjs`**

Modify the summary marker to include reported comment IDs:

```javascript
// New marker format with tracking
function generateSummaryMarker(reportedIds, timestamp) {
  return `<!-- GEMINI_REVIEW_SUMMARY
reported_ids: ${reportedIds.join(',')}
last_update: ${timestamp}
-->`;
}

function parseSummaryMarker(markerContent) {
  const reportedMatch = markerContent.match(/reported_ids: ([^\n]*)/);
  const timestampMatch = markerContent.match(/last_update: ([^\n]*)/);
  
  return {
    reportedIds: reportedMatch ? reportedMatch[1].split(',').filter(Boolean) : [],
    lastUpdate: timestampMatch ? timestampMatch[1] : null
  };
}

/**
 * Posta ou atualiza o resumo de review no PR
 * Com tracking de issues já reportados
 */
async function postOrUpdateSummary(reviewData, prNumber, github, context) {
  const { data: comments } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber,
    per_page: 100
  });

  // Encontrar comentário de resumo existente
  const existingComment = comments.find(
    (comment) =>
      comment.body &&
      comment.body.includes('<!-- GEMINI_REVIEW_SUMMARY') &&
      comment.user.login === 'github-actions[bot]'
  );

  // Parse IDs já reportados
  let previouslyReportedIds = [];
  if (existingComment) {
    const parsed = parseSummaryMarker(existingComment.body);
    previouslyReportedIds = parsed.reportedIds;
    console.log(`Found ${previouslyReportedIds.length} previously reported issues`);
  }

  // Extrair IDs atuais
  const currentIds = (reviewData.issues || []).map(i => String(i.id)).filter(Boolean);
  
  // Calcular novos IDs
  const newIds = currentIds.filter(id => !previouslyReportedIds.includes(id));
  const newCount = newIds.length;
  
  // Atualizar lista de reportados
  const allReportedIds = [...new Set([...previouslyReportedIds, ...newIds])];
  
  // Gerar corpo com tracking
  const summaryBody = generateSummaryBody(reviewData, prNumber, newCount, allReportedIds);

  if (existingComment) {
    const { data: updatedComment } = await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existingComment.id,
      body: summaryBody
    });

    console.log(`Resumo atualizado: ${newCount} novos issues`);
    return {
      action: 'updated',
      commentId: updatedComment.id,
      url: updatedComment.html_url,
      newIssues: newCount
    };
  } else {
    const { data: newComment } = await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body: summaryBody
    });

    console.log(`Resumo criado: ${newCount} issues`);
    return {
      action: 'created',
      commentId: newComment.id,
      url: newComment.html_url,
      newIssues: newCount
    };
  }
}

/**
 * Gera o corpo do resumo com tracking de novos issues
 */
function generateSummaryBody(reviewData, prNumber, newIssuesCount, allReportedIds) {
  const summary = reviewData.summary || {};
  const issues = reviewData.issues || [];
  const timestamp = new Date().toISOString();

  // Estatísticas
  const totalIssues = summary.total_issues || 0;
  const autoFixable = summary.auto_fixable || 0;
  const needsAgent = summary.needs_agent || 0;
  const critical = summary.critical || 0;
  const filteredCompliments = summary.filtered_compliments || 0;

  // Top 10 issues (apenas novos se houver tracking)
  const topIssues = issues
    .slice(0, 10)
    .map(
      (issue) =>
        `| ${escapeMarkdown(issue.file ? issue.file.split('/').pop() : 'N/A')} | ${issue.line || '-'} | ${escapeMarkdown(issue.severity)} | ${escapeMarkdown(issue.category || issue.priority || 'N/A')} |`
    )
    .join('\n');

  const marker = generateSummaryMarker(allReportedIds, timestamp);

  const body = `${marker}
## \u{1F916} Gemini Code Review - Resumo

*\u{00DA}ltima atualiza\u{00E7}\u{00E3}o: ${timestamp}*

### \u{1F4CA} Estat\u{00ED}sticas

| Categoria | Quantidade |
|-----------|------------|
| Total de Issues | ${totalIssues} |
| **Novos desde \u{00FAltimo report** | **${newIssuesCount}** |
| Auto-fixable | ${autoFixable} |
| Requer Agente | ${needsAgent} |
| Cr\u{00ED}ticos | ${critical} |
| Compliments Filtrados | ${filteredCompliments} |

### \u{1F4CB} Issues Principais

| Arquivo | Linha | Severidade | Categoria |
|---------|-------|------------|-----------|
${topIssues || '| Nenhum issue encontrado | - | - | - |'}

### \u{1F4C1} Output Estruturado

O arquivo \`.gemini-output/review-${prNumber}.json\` foi gerado com todos os issues parseados.

---
\u{1F4A1} *Este coment\u{00E1}rio \u{00E9} atualizado automaticamente a cada review.*
`;
  return body;
}
```

---

## Dependency Matrix

The fixes should be implemented in the following order to minimize risk:

```
Order | Problem | Dependencies | Risk Level
------|---------|--------------|------------
1     | P3: Compliment Filter | None | LOW (additive only)
2     | P2: Dynamic Prefix | None | LOW (simple string change)
3     | P5: Summary Dedup | None | LOW (additive only)
4     | P1: Critical Blocking | P3 (filter first) | MEDIUM (workflow change)
5     | P4: Inline Replies | P1 (needs comment_id) | MEDIUM (API change)
```

### Implementation Phases

**Phase 1: Low-Risk Additions (P2, P3, P5)**
- Add compliment filtering to parser
- Change prefix logic in create-issues.js
- Add tracking to summary generation
- **Validation:** Run existing tests, verify no regression

**Phase 2: Workflow Changes (P1)**
- Add check-critical job to workflow
- Modify create-issues job condition
- **Validation:** Test with PR that has CRITICAL issues

**Phase 3: API Changes (P4)**
- Add comment_id to persist.js schema
- Add inline reply logic to create-issues.js
- **Validation:** Test inline reply functionality

---

## Validation Plan

### Test Cases for Each Fix

#### Problem 1: Critical Blocking

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| TC-1.1 | Review with CRITICAL issue | Workflow blocked, alert comment posted |
| TC-1.2 | Review with HIGH issue | Workflow blocked, alert comment posted |
| TC-1.3 | Review with security issue | Workflow blocked, alert comment posted |
| TC-1.4 | Review with only MEDIUM issues | Issues created, workflow continues |
| TC-1.5 | Review with CRITICAL + MEDIUM | Blocked, no issues created |

**Test Command:**
```bash
# Create test PR with intentional security issue
# Verify workflow blocks and posts alert
```

#### Problem 2: Dynamic Prefix

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| TC-2.1 | Issue with priority='alta' | Title: `[High] ...` |
| TC-2.2 | Issue with priority='media' | Title: `[Medium] ...` |
| TC-2.3 | Issue with priority='baixa' | Title: `[Low] ...` |
| TC-2.4 | Issue with unknown priority | Title: `[Medium] ...` (default) |

**Test Command:**
```bash
# Run unit tests for createGitHubIssue function
npm run test -- --grep "createGitHubIssue"
```

#### Problem 3: Compliment Filter

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| TC-3.1 | "Good catch!" | Filtered out, no issue |
| TC-3.2 | "Nice fix, thanks!" | Filtered out, no issue |
| TC-3.3 | "I see you've fixed this" | Filtered out, no issue |
| TC-3.4 | "Missing error handling" | NOT filtered, issue created |
| TC-3.5 | "LGTM" | Filtered out, no issue |

**Test Command:**
```bash
# Run parser tests
node .github/scripts/__tests__/parse-gemini-comments.test.js
```

#### Problem 4: Inline Replies

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| TC-4.1 | Issue with comment_id | Inline reply to Gemini |
| TC-4.2 | Issue without comment_id | Fallback to timeline comment |
| TC-4.3 | API error on inline reply | Fallback to timeline comment |

**Test Command:**
```bash
# Integration test with real PR
# Verify reply appears under Gemini comment
```

#### Problem 5: Summary Dedup

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| TC-5.1 | First review | All issues counted as new |
| TC-5.2 | Re-review with same issues | 0 new issues reported |
| TC-5.3 | Re-review with 2 new issues | 2 new issues reported |
| TC-5.4 | Re-review with resolved + new | Only new counted |

**Test Command:**
```bash
# Push multiple commits to same PR
# Verify summary shows correct new count
```

---

## Database Schema Changes

### Supabase: `gemini_reviews` table

Add columns for inline reply support:

```sql
-- Add comment tracking columns
ALTER TABLE gemini_reviews 
ADD COLUMN IF NOT EXISTS comment_id BIGINT,
ADD COLUMN IF NOT EXISTS comment_url TEXT;

-- Add index for comment_id lookups
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_comment_id 
ON gemini_reviews(comment_id);
```

---

## Rollback Plan

Each fix can be rolled back independently:

| Fix | Rollback Action |
|-----|-----------------|
| P1: Critical Blocking | Remove `check-critical` job, restore original `create-issues` condition |
| P2: Dynamic Prefix | Revert to hardcoded `[Refactor]` prefix |
| P3: Compliment Filter | Remove `filterCompliments()` call from pipeline |
| P4: Inline Replies | Revert to `commentOnPR()` function |
| P5: Summary Dedup | Remove tracking from summary marker |

---

## Files to Modify

| File | Changes | Lines Affected |
|------|---------|----------------|
| `.github/workflows/gemini-review.yml` | Add `check-critical` job, modify `create-issues` condition | ~50 new lines |
| `.github/scripts/parse-gemini-comments.cjs` | Add `isCompliment()`, `filterCompliments()` | ~60 new lines |
| `.github/scripts/post-smart-summary.cjs` | Add tracking, modify `generateSummaryBody()` | ~40 modified |
| `api/gemini-reviews/create-issues.js` | Dynamic prefix, inline reply logic | ~30 modified |
| `api/gemini-reviews/persist.js` | Add `comment_id`, `comment_url` columns | ~10 modified |

---

## Estimated Complexity

| Fix | Complexity | Effort | Risk |
|-----|------------|--------|------|
| P1: Critical Blocking | Medium | 2-3 hours | Medium |
| P2: Dynamic Prefix | Low | 30 min | Low |
| P3: Compliment Filter | Medium | 2 hours | Low |
| P4: Inline Replies | Medium-High | 3-4 hours | Medium |
| P5: Summary Dedup | Low-Medium | 1-2 hours | Low |

**Total Estimated Effort:** 8-12 hours

---

## References

- Problem Documentation: [`plans/issues-gemini.md`](plans/issues-gemini.md)
- Integration Docs: [`docs/standards/GEMINI_INTEGRATION.md`](docs/standards/GEMINI_INTEGRATION.md)
- Workflow: [`.github/workflows/gemini-review.yml`](.github/workflows/gemini-review.yml)
- Parser: [`.github/scripts/parse-gemini-comments.cjs`](.github/scripts/parse-gemini-comments.cjs)
- Create Issues: [`api/gemini-reviews/create-issues.js`](api/gemini-reviews/create-issues.js)
- Persist: [`api/gemini-reviews/persist.js`](api/gemini-reviews/persist.js)
- Summary: [`.github/scripts/post-smart-summary.cjs`](.github/scripts/post-smart-summary.cjs)
- Rules: [`.memory/rules.md`](.memory/rules.md)
- Anti-Patterns: [`.memory/anti-patterns.md`](.memory/anti-patterns.md)

---

## Logging Requirements

Based on the [Post-Mortem](docs/archive/GEMINI_INTEGRATION_POST_MORTEM.md), inadequate logging caused debugging delays (45 min vs 5 min with proper logging). Each fix must include comprehensive logging:

### Required Logging Patterns

Use the existing `api/gemini-reviews/shared/logger.js`:

```javascript
import {
  logInfo,
  logError,
  logRequest,
  logResult
} from './shared/logger.js'
```

### Per-Fix Logging Requirements

| Fix | Required Logs |
|-----|---------------|
| **P1: Critical Blocking** | Log blocking decisions, alert posts, issue severity counts |
| **P2: Dynamic Prefix** | Log priority mapping, final prefix chosen |
| **P3: Compliment Filter** | Log filtered compliments (with reason), badge detection |
| **P4: Inline Replies** | Log comment_id, reply success/failure, fallback triggers |
| **P5: Summary Dedup** | Log tracked IDs, new vs total counts, dedup decisions |

### Critical Log Entries

#### Example for P1 (Critical Blocking):
```javascript
logInfo('check-critical', 'evaluating_issues', {
  prNumber,
  criticalCount: criticalIssues.length,
  highCount: highIssues.length,
  securityCount: securityIssues.length,
  willBlock: blockingIssues.length > 0
})

if (blockingIssues.length > 0) {
  logInfo('check-critical', 'blocking_workflow', {
    prNumber,
    reasons: blockingIssues.map(i => i.severity)
  })
}
```

#### Example for P3 (Compliment Filter):
```javascript
logInfo('parse-gemini', 'compliment_filtered', {
  commentId: comment.id,
  reason: 'no_priority_badge',
  preview: comment.body?.substring(0, 50)
})
```

#### Example for P4 (Inline Replies):
```javascript
logInfo('create-issues', 'inline_reply_attempt', {
  commentId: issue.comment_id,
  issueNumber: githubIssue.number
})

if (!response.ok) {
  logError('create-issues', 'inline_reply_failed', new Error(`HTTP ${response.status}`), {
    commentId: issue.comment_id,
    fallingBack: true
  })
}
```

---

*Last updated: 2026-02-25*
*Version: 1.1.0* (Added logging requirements based on post-mortem)