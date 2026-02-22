# Workflow Intelligence Refactor

> **Documento de Especificação Técnica**
> **Versão:** 1.0.0 | **Data:** 2026-02-22
> **Status:** 🔄 Em Implementação
> **Prioridade:** CRITICAL

---

## 📋 Sumário Executivo

Este documento especifica a refatoração do sistema de integração com o Gemini Code Assist para resolver problemas de **loops circulares**, **duplicação de issues** e **re-trigger sem memória** identificados no PR #120 e nas issues #121, #122 e #123.

### Problemas Identificados

| Issue | Descrição | Severidade |
|-------|-----------|------------|
| #121 | Valor do campo `resolved_by` não está de acordo com o schema UUID | MEDIUM |
| #122 | Falta validação de JSON Schema nos testes | MEDIUM |
| #123 | Duplicação de issues quando PR é reavaliado | HIGH |
| PR #120 | Loops circulares no workflow de re-review | CRITICAL |

---

## 🔍 Diagnóstico do Problema

### Caso PR #120: Loops Circulares

**Sintoma:** Workflow entra em loop infinito quando novo commit é pushado ao PR.

**Causa Raiz:**
1. Novo commit dispara webhook do GitHub
2. Workflow detecta alterações significativas
3. Workflow posta comentário `/gemini review`
4. Gemini completa review
5. Workflow salva review no Supabase
6. Workflow detecta "novas" alterações (mesmo commit)
7. **LOOP:** Volta ao passo 3

**Fator Agravante:** Ausência de mecanismo de deduplicação baseado em hash do conteúdo.

### Issues #121, #122, #123: Duplicatas

**Issue #121:** Inconsistência de Schema
- Campo `resolved_by` nos exemplos usa `"agent-123"` (string arbitrária)
- Schema define formato UUID (`550e8400-e29b-41d4-a716-446655440001`)
- Impacto: Validação falha quando agents tentam usar exemplos como referência

**Issue #122:** Validação Insuficiente
- Testes verificam sintaxe JSON mas não conformidade com schema
- Falta biblioteca `ajv` ou similar para validação de schema
- Impacto: Inconsistências não são detectadas em CI

**Issue #123:** Duplicação de Issues
- Mesmo issue é criado múltiplas vezes quando PR é reavaliado
- Ausência de `issue_hash` para identificação única
- Impacto: Poluição do backlog com issues duplicadas

### Causas Fundamentais

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAUSAS FUNDAMENTAIS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. DEDUPLICAÇÃO INCOMPLETA                                     │
│     ├── Sem hash de conteúdo para identificar issues únicos    │
│     ├── Sem verificação de duplicatas antes de criar issue     │
│     └── Cache por arquivo, não por issue específico            │
│                                                                 │
│  2. SEPARAÇÃO DE ESTADOS                                        │
│     ├── Workflow não conhece estado de issues já criadas       │
│     ├── Supabase não armazena referência a GitHub Issue        │
│     └── Sem rastreamento de resolução por issue                │
│                                                                 │
│  3. RE-TRIGGER SEM MEMÓRIA                                      │
│     ├── Workflow não registra qual commit já foi processado    │
│     ├── Sem checkpoint de estado entre execuções               │
│     └── Cada execução é "stateless"                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Integração com GEMINI_INTEGRATION_PHASES.md

### Mapeamento do Que Continua Válido

| Componente | Status | Justificativa |
|------------|--------|---------------|
| P4.1 - API Supabase | ✅ Mantido | Base para novo sistema de estados |
| P4.2 - Protocolo | 🔄 Ajustado | Corrigir schema UUID (Issue #121) |
| P4.3 - Webhook Agents | ✅ Mantido | Necessário para notificação |
| P4.4 - CLI | ✅ Mantido | Interface power-user |
| P4.5 - Endpoint REST | ✅ Mantido | API pública para agents |
| P4.6 - UI Human | ✅ Mantido | Interface revisores |
| P4.7 - Webhook GitHub | 🔄 Ajustado | Adicionar deduplicação |

### O Que Precisa Ser Ajustado

#### 1. Schema de Dados (P4.1)

**Atual:** Tabela `gemini_reviews` armazena review completo como JSONB

**Problema:** Não permite rastreamento individual de issues

**Ajuste:** Expandir schema com campos de controle

```sql
-- Campos a adicionar:
- issue_hash (TEXT UNIQUE)          -- Hash SHA-256 do conteúdo
- github_issue_number (INTEGER)     -- Referência à Issue criada
- resolution_type (ENUM)            -- Tipo de resolução
- status (ENUM expandido)           -- Estados detalhados
```

#### 2. Protocolo (P4.2)

**Atual:** Exemplos com `resolved_by: "agent-123"`

**Problema:** Inconsistência com schema UUID (Issue #121)

**Ajuste:** Atualizar todos os exemplos para usar UUID válidos

```javascript
// Antes (INCORRETO)
"resolved_by": "agent-123"

// Depois (CORRETO)
"resolved_by": "550e8400-e29b-41d4-a716-446655440001"
```

#### 3. Validação de Testes (Issue #122)

**Atual:** Testes verificam apenas sintaxe JSON

**Ajuste:** Adicionar validação de schema com `ajv`

```javascript
// Novo teste a adicionar
const Ajv = require('ajv');
const ajv = new Ajv();
const schema = extractSchemaFromMarkdown();
const validate = ajv.compile(schema);

// Validar cada exemplo JSON
examples.forEach(example => {
  const valid = validate(example);
  expect(valid).toBe(true);
});
```

#### 4. Webhook Handler (P4.7)

**Atual:** Processa todo evento sem verificar se já foi processado

**Problema:** Re-trigger sem memória causa loops

**Ajuste:** Adicionar deduplicação baseada em hash

```javascript
// Verificar se já processado
const issueHash = calculateHash(fileContent + line + issue);
const existing = await supabase
  .from('gemini_reviews')
  .select('id')
  .eq('issue_hash', issueHash)
  .single();

if (existing) {
  console.log(`Issue ${issueHash} já existe, ignorando...`);
  return;
}
```

### O Que Deve Ser Cancelado/Removido

| Item | Ação | Motivo |
|------|------|--------|
| Cache de arquivo (P3.1) | Remover | Substituído por hash de issue |
| `create-issues.js` atual | Refatorar | Usar novo sistema de hash |
| `trigger-re-review.js` | Ajustar | Adicionar checkpoint de commit |

---

## 🏗️ Proposta Arquitetural

### Sistema de Hash (SHA-256)

#### Cálculo do `issue_hash`

```javascript
const crypto = require('crypto');

/**
 * Calcula hash único para uma issue do Gemini
 * @param {Object} issue - Dados da issue
 * @returns {string} Hash SHA-256 (64 caracteres hex)
 */
function calculateIssueHash(issue) {
  const content = JSON.stringify({
    file_path: issue.file_path,
    line_start: issue.line_start,
    line_end: issue.line_end,
    title: issue.title,
    description: issue.description,
    // NÃO incluir campos variáveis:
    // - created_at
    // - updated_at
    // - status
    // - resolved_by
  });
  
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');
}
```

#### Uso do Hash

```javascript
// Ao processar review do Gemini
for (const issue of reviewData.issues) {
  const issueHash = calculateIssueHash(issue);
  
  // Verificar duplicata
  const { data: existing } = await supabase
    .from('gemini_reviews')
    .select('id, status, github_issue_number')
    .eq('issue_hash', issueHash)
    .single();
  
  if (existing) {
    // Issue já existe - verificar se precisa atualizar
    if (existing.status === 'descartado') {
      // Issue foi marcada como falso positivo, ignorar
      continue;
    }
    
    // Atualizar referências se necessário
    await updateExistingIssue(existing.id, issue);
  } else {
    // Criar nova issue
    await createNewIssue(issue, issueHash);
  }
}
```

### Estados Expandidos na Tabela `gemini_reviews`

#### Estados Anteriores (Simplificado)

```
pending → in_progress → completed
```

#### Estados Novos (Expandido)

```
┌─────────────────────────────────────────────────────────────────┐
│                     DIAGRAMA DE ESTADOS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [*] ──▶ detected                                              │
│              │                                                  │
│              ▼                                                  │
│         reported ──▶ github_issue_number atribuído              │
│              │                                                  │
│              ├──▶ assigned (agent inicia trabalho)              │
│              │       │                                          │
│              │       ├──▶ resolved (fixed)                      │
│              │       │       │                                  │
│              │       │       └──▶ [*]                           │
│              │       │                                          │
│              │       ├──▶ wontfix (rejected)                    │
│              │       │       │                                  │
│              │       │       └──▶ [*]                           │
│              │       │                                          │
│              │       └──▶ duplicate (já existe)                 │
│              │               │                                  │
│              │               └──▶ [*]                           │
│              │                                                  │
│              └──▶ partial (parcialmente resolvido)              │
│                      │                                          │
│                      └──▶ reported (reativado)                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Tabela de Estados

| Estado | Descrição | Transições Permitidas |
|--------|-----------|----------------------|
| `detected` | Issue detectada pelo Gemini, ainda não processada | reported |
| `reported` | Issue reportada ao GitHub (issue criada) | assigned, duplicate |
| `assigned` | Issue atribuída a um agent | resolved, partial, wontfix |
| `resolved` | Issue completamente resolvida | - (final) |
| `partial` | Parcialmente resolvida (alguns pontos pendentes) | reported (reativar) |
| `wontfix` | Será ignorada (falso positivo ou não aplicável) | - (final) |
| `duplicate` | Duplicata de outra issue | - (final) |

### Script `persist-reviews.cjs`

Novo script responsável por persistir reviews do Gemini no Supabase com deduplicação.

```javascript
#!/usr/bin/env node
// scripts/persist-reviews.cjs

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Persiste reviews do Gemini com deduplicação por hash
 * @param {Object} reviewData - Dados do review parseado
 * @param {number} prNumber - Número do PR
 * @returns {Promise<Object>} Resultado da persistência
 */
async function persistReviews(reviewData, prNumber) {
  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    duplicates: 0,
    errors: []
  };

  for (const issue of reviewData.issues) {
    try {
      const issueHash = calculateIssueHash(issue);
      
      // Verificar se issue já existe
      const { data: existing } = await supabase
        .from('gemini_reviews')
        .select('id, status, github_issue_number, issue_hash')
        .eq('issue_hash', issueHash)
        .maybeSingle();

      if (existing) {
        // Issue existe - verificar se precisa atualizar
        if (shouldUpdateIssue(existing, issue)) {
          await updateExistingIssue(existing.id, issue, prNumber);
          results.updated++;
        } else {
          results.skipped++;
        }
        continue;
      }

      // Criar nova issue
      await createNewIssue(issue, issueHash, prNumber);
      results.created++;
      
    } catch (error) {
      console.error(`Erro ao processar issue: ${error.message}`);
      results.errors.push({ issue: issue.title, error: error.message });
    }
  }

  return results;
}

/**
 * Calcula hash SHA-256 para uma issue
 */
function calculateIssueHash(issue) {
  const content = JSON.stringify({
    file_path: issue.file_path,
    line_start: issue.line_start,
    line_end: issue.line_end,
    title: issue.title,
    description: issue.description
  });
  
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Determina se uma issue existente precisa ser atualizada
 */
function shouldUpdateIssue(existing, newIssue) {
  // Atualizar se status é 'detected' ou 'reported'
  // Não atualizar se já está 'assigned', 'resolved', etc.
  const updatableStatuses = ['detected', 'reported'];
  return updatableStatuses.includes(existing.status);
}

/**
 * Cria nova issue no Supabase
 */
async function createNewIssue(issue, issueHash, prNumber) {
  const { error } = await supabase
    .from('gemini_reviews')
    .insert({
      pr_number: prNumber,
      commit_sha: issue.commit_sha,
      file_path: issue.file_path,
      line_start: issue.line_start,
      line_end: issue.line_end,
      issue_hash: issueHash,
      status: 'detected',
      priority: mapPriority(issue.priority),
      category: mapCategory(issue.category),
      title: issue.title,
      description: issue.description,
      suggestion: issue.suggestion,
      review_data: issue
    });

  if (error) throw error;
}

/**
 * Atualiza issue existente
 */
async function updateExistingIssue(id, issue, prNumber) {
  const { error } = await supabase
    .from('gemini_reviews')
    .update({
      pr_number: prNumber,
      commit_sha: issue.commit_sha,
      updated_at: new Date().toISOString(),
      review_data: issue
    })
    .eq('id', id);

  if (error) throw error;
}

// Mapeamento de prioridades
function mapPriority(priority) {
  const map = {
    'CRITICAL': 'critica',
    'HIGH': 'alta',
    'MEDIUM': 'media',
    'LOW': 'baixa'
  };
  return map[priority] || 'media';
}

// Mapeamento de categorias
function mapCategory(category) {
  const map = {
    'style': 'estilo',
    'bug': 'bug',
    'security': 'seguranca',
    'performance': 'performance',
    'maintainability': 'manutenibilidade'
  };
  return map[category] || 'geral';
}

module.exports = { persistReviews, calculateIssueHash };

// Execução direta (CLI)
if (require.main === module) {
  const reviewFile = process.argv[2];
  if (!reviewFile) {
    console.error('Uso: node persist-reviews.cjs <review-json-file>');
    process.exit(1);
  }
  
  const reviewData = require(`../${reviewFile}`);
  persistReviews(reviewData, reviewData.pr_number)
    .then(results => {
      console.log('Persistência concluída:', results);
      process.exit(0);
    })
    .catch(error => {
      console.error('Erro:', error);
      process.exit(1);
    });
}
```

### Refatoração de `create-issues.cjs`

Script existente deve ser refatorado para usar o novo sistema de hash.

```javascript
// .github/scripts/create-issues.cjs (refatorado)

const { persistReviews } = require('../../scripts/persist-reviews.cjs');

/**
 * Cria GitHub Issues para reviews MEDIUM não-auto-fixable
 * COM deduplicação via hash
 */
async function createIssuesFromReview(reviewData, prNumber, github, context) {
  // 1. Persistir reviews no Supabase (com deduplicação)
  const persistResult = await persistReviews(reviewData, prNumber);
  console.log('Persistência:', persistResult);

  // 2. Buscar issues que precisam ser criadas no GitHub
  const { data: pendingIssues } = await supabase
    .from('gemini_reviews')
    .select('*')
    .eq('pr_number', prNumber)
    .eq('status', 'detected')
    .eq('priority', 'media');

  // 3. Criar issues no GitHub
  const createdIssues = [];
  for (const issue of pendingIssues) {
    const githubIssue = await createGitHubIssue(issue, prNumber, github, context);
    
    // 4. Atualizar Supabase com referência
    await supabase
      .from('gemini_reviews')
      .update({
        status: 'reported',
        github_issue_number: githubIssue.number,
        updated_at: new Date().toISOString()
      })
      .eq('id', issue.id);
    
    createdIssues.push(githubIssue.number);
  }

  return createdIssues;
}
```

---

## 🗄️ Schema Atualizado

### Migration SQL

```sql
-- .migrations/20260222_add_workflow_intelligence_fields.sql

-- ============================================
-- Workflow Intelligence Refactor Migration
-- Adiciona campos para deduplicação e tracking
-- ============================================

-- Adicionar novos campos à tabela gemini_reviews
ALTER TABLE gemini_reviews
  -- Hash único para deduplicação
  ADD COLUMN IF NOT EXISTS issue_hash TEXT UNIQUE,
  
  -- Referência à issue do GitHub
  ADD COLUMN IF NOT EXISTS github_issue_number INTEGER,
  
  -- Tipo de resolução (quando completado)
  ADD COLUMN IF NOT EXISTS resolution_type TEXT CHECK (
    resolution_type IN ('fixed', 'rejected', 'partial', null)
  ),
  
  -- Estado expandido
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'detected' CHECK (
    status IN (
      'detected',      -- Detectado pelo Gemini
      'reported',      -- Reportado ao GitHub (issue criada)
      'assigned',      -- Atribuído a agent
      'resolved',      -- Completamente resolvido
      'partial',       -- Parcialmente resolvido
      'wontfix',       -- Ignorado/falso positivo
      'duplicate'      -- Duplicata
    )
  );

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_gemini_reviews_issue_hash 
  ON gemini_reviews(issue_hash);

CREATE INDEX IF NOT EXISTS idx_gemini_reviews_github_issue 
  ON gemini_reviews(github_issue_number);

CREATE INDEX IF NOT EXISTS idx_gemini_reviews_status 
  ON gemini_reviews(status);

CREATE INDEX IF NOT EXISTS idx_gemini_reviews_pr_status 
  ON gemini_reviews(pr_number, status);

-- Atualizar RLS policies para novos campos
CREATE POLICY "Enable read access for authenticated users" 
  ON gemini_reviews FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for service role" 
  ON gemini_reviews FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable update for service role" 
  ON gemini_reviews FOR UPDATE 
  USING (auth.role() = 'service_role');

-- Comentários documentando os campos
COMMENT ON COLUMN gemini_reviews.issue_hash IS 
  'SHA-256 hash do conteúdo da issue para deduplicação';

COMMENT ON COLUMN gemini_reviews.github_issue_number IS 
  'Número da issue correspondente no GitHub';

COMMENT ON COLUMN gemini_reviews.resolution_type IS 
  'Tipo de resolução: fixed, rejected, partial';

COMMENT ON COLUMN gemini_reviews.status IS 
  'Estado expandido: detected, reported, assigned, resolved, partial, wontfix, duplicate';
```

### Schema Zod Atualizado

```javascript
// src/schemas/geminiReviewSchema.js (atualizado)

const { z } = require('zod');

// Estados expandidos
const ReviewStatusEnum = z.enum([
  'detected',
  'reported', 
  'assigned',
  'resolved',
  'partial',
  'wontfix',
  'duplicate'
]);

// Tipos de resolução
const ResolutionTypeEnum = z.enum([
  'fixed',
  'rejected', 
  'partial'
]);

// Schema de review atualizado
const GeminiReviewSchema = z.object({
  id: z.string().uuid(),
  pr_number: z.number().int().positive(),
  commit_sha: z.string().length(40),
  file_path: z.string(),
  line_start: z.number().int().positive(),
  line_end: z.number().int().positive(),
  
  // NOVOS CAMPOS
  issue_hash: z.string().length(64).optional(), // SHA-256 = 64 chars hex
  github_issue_number: z.number().int().positive().optional(),
  resolution_type: ResolutionTypeEnum.optional(),
  status: ReviewStatusEnum.default('detected'),
  
  priority: z.enum(['critica', 'alta', 'media', 'baixa']),
  category: z.enum(['estilo', 'bug', 'seguranca', 'performance', 'manutenibilidade', 'geral']),
  title: z.string().max(200),
  description: z.string().max(2000),
  suggestion: z.string().max(1000).optional(),
  review_data: z.record(z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

// Schema para criação
const GeminiReviewCreateSchema = GeminiReviewSchema.omit({
  id: true,
  created_at: true, 
  updated_at: true
});

// Schema para atualização
const GeminiReviewUpdateSchema = GeminiReviewSchema.partial().omit({
  id: true,
  created_at: true
});

// Função de validação
function validateGeminiReview(data) {
  const result = GeminiReviewSchema.safeParse(data);
  return {
    success: result.success,
    data: result.success ? result.data : null,
    errors: result.success ? [] : result.error.errors
  };
}

module.exports = {
  ReviewStatusEnum,
  ResolutionTypeEnum,
  GeminiReviewSchema,
  GeminiReviewCreateSchema,
  GeminiReviewUpdateSchema,
  validateGeminiReview
};
```

---

## 📅 Plano de Implementação

### Sprint 6: Workflow Intelligence Foundation

**Semana 1-2 (2026-02-24 a 2026-03-07)**

| Dia | Tarefa | Responsável |
|-----|--------|-------------|
| 1-2 | Criar migration SQL com novos campos | Architect |
| 3-4 | Implementar `persist-reviews.cjs` | Code |
| 5-6 | Atualizar schema Zod | Code |
| 7 | Testes unitários para hash e deduplicação | Code |
| 8-10 | Refatorar `create-issues.cjs` | Code |
| 11-12 | Integrar com workflow existente | Code |
| 13-14 | Testes E2E e validação | Architect |

**Entregáveis:**
- ✅ Migration SQL aplicada
- ✅ Script `persist-reviews.cjs` funcionando
- ✅ Sistema de hash SHA-256 operacional
- ✅ Deduplicação funcionando em staging

---

### Sprint 7: Integração e Refatoração

**Semana 3-4 (2026-03-10 a 2026-03-21)**

| Dia | Tarefa | Responsável |
|-----|--------|-------------|
| 15-16 | Corrigir exemplos no GEMINI_AGENT_PROTOCOL.md (Issue #121) | Code |
| 17-18 | Adicionar validação de schema nos testes (Issue #122) | Code |
| 19-20 | Implementar checkpoint de commit no trigger-re-review | Code |
| 21-22 | Resolver loop circular no workflow (Issue #123) | Code |
| 23-24 | Testes de integração completos | Architect |
| 25-26 | Code review e ajustes | Architect |
| 27-28 | Deploy para produção | DevOps |

**Entregáveis:**
- ✅ Issue #121 resolvida (UUID nos exemplos)
- ✅ Issue #122 resolvida (validação de schema)
- ✅ Issue #123 resolvida (sem duplicatas)
- ✅ Loop circular eliminado

---

### Sprint 8: Webhooks e Notificação

**Semana 5-6 (2026-03-24 a 2026-04-04)**

| Dia | Tarefa | Responsável |
|-----|--------|-------------|
| 29-30 | Implementar webhook handler atualizado | Code |
| 31-32 | Adicionar notificação de agents (P4.3) | Code |
| 33-34 | Sistema de retry com backoff exponencial | Code |
| 35-36 | DLQ (Dead Letter Queue) para falhas | Code |
| 37-38 | Testes de carga e resiliência | Architect |
| 39-40 | Documentação técnica atualizada | Documentation |
| 41-42 | Deploy e monitoramento | DevOps |

**Entregáveis:**
- ✅ Webhook handler com deduplicação
- ✅ Sistema de notificação de agents
- ✅ Retry automático com backoff
- ✅ DLQ para falhas persistentes

---

### Sprint 9: UI e CLI

**Semana 7-8 (2026-04-07 a 2026-04-18)**

| Dia | Tarefa | Responsável |
|-----|--------|-------------|
| 43-44 | Implementar UI de reviews (P4.6) | Code |
| 45-46 | Componentes de filtro e busca | Code |
| 47-48 | Dashboard de métricas | Code |
| 49-50 | CLI para agents (P4.4) | Code |
| 51-52 | Comandos: list, show, claim, resolve | Code |
| 53-54 | Testes de usabilidade | Architect |
| 55-56 | Ajustes e polimento | Code |

**Entregáveis:**
- ✅ UI de reviews funcionando
- ✅ Dashboard com filtros
- ✅ CLI `gemini-agent` instalável
- ✅ Documentação de uso

---

### Sprint 10: Métricas e Polimento

**Semana 9-10 (2026-04-21 a 2026-05-02)**

| Dia | Tarefa | Responsável |
|-----|--------|-------------|
| 57-58 | Implementar coleta de métricas | Code |
| 59-60 | Relatório semanal automático (P3.3) | Code |
| 61-62 | Otimizações de performance | Architect |
| 63-64 | Cache de queries frequentes | Code |
| 65-66 | Documentação final | Documentation |
| 67-68 | Treinamento da equipe | Team |
| 69-70 | Retrospectiva e lições aprendidas | All |

**Entregáveis:**
- ✅ Métricas de efetividade
- ✅ Relatórios automáticos
- ✅ Performance otimizada
- ✅ Documentação completa

---

## 📊 Diagramas

### Fluxo de Dados Integrado

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DE DADOS INTEGRADO                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────────────┐   │
│  │  GitHub  │────▶│  Gemini  │────▶│ Webhook  │────▶│  persist-reviews │   │
│  │   PR     │     │  Review  │     │  Handler │     │     .cjs         │   │
│  └──────────┘     └──────────┘     └──────────┘     └────────┬─────────┘   │
│                                                              │             │
│                                                              ▼             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      SUPABASE - gemini_reviews                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │  │
│  │  │ issue_hash  │  │   status    │  │  github_    │  │  review_   │ │  │
│  │  │  (SHA-256)  │  │  (enum)     │  │  issue_num  │  │   data     │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                              │             │
│                    ┌─────────────────────────────────────────┼─────────┐   │
│                    │                                         │         │   │
│                    ▼                                         ▼         │   │
│  ┌───────────────────┐     ┌──────────────────┐     ┌────────────────┐  │   │
│  │   create-issues   │     │  Webhook Agents  │     │   UI Human     │  │   │
│  │      .cjs         │     │     (P4.3)       │     │   (P4.6)       │  │   │
│  └─────────┬─────────┘     └────────┬─────────┘     └───────┬────────┘  │   │
│            │                        │                       │           │   │
│            ▼                        ▼                       ▼           │   │
│  ┌───────────────────┐     ┌──────────────────┐     ┌────────────────┐  │   │
│  │   GitHub Issues   │     │  External Agents │     │  Human Review  │  │   │
│  │   (#121, #122)    │     │  (Kilocode, etc) │     │  (Aprove/Reject)│  │   │
│  └───────────────────┘     └──────────────────┘     └────────────────┘  │   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Estados da Sugestão (Detalhado)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MÁQUINA DE ESTADOS DETALHADA                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐                                                              │
│   │   [*]    │───(Gemini detecta issue)───▶┌──────────┐                    │
│   │ (início) │                              │ detected │                    │
│   └──────────┘                              │  (novo)  │                    │
│                                             └────┬─────┘                    │
│                                                  │                          │
│                          (calcular issue_hash)   │                          │
│                                                  ▼                          │
│                                             ┌──────────┐                    │
│                                    ┌───────│  Hash    │                    │
│                                    │       │  existe? │                    │
│                                    │       └────┬─────┘                    │
│                                    │            │                          │
│                            (não)   │    (sim)   │                          │
│                                    │            ▼                          │
│                                    │    ┌──────────┐                       │
│                                    │    │duplicate │───▶[*]               │
│                                    │    │(fim)     │                       │
│                                    │    └──────────┘                       │
│                                    │                                       │
│                                    ▼                                       │
│                             ┌──────────┐                                   │
│                    (criar   │ reported │                                   │
│                  GitHub     │(issue    │                                   │
│                    Issue)   │ criada)  │                                   │
│                             └────┬─────┘                                   │
│                                  │                                         │
│                    (atribuir a   │  (ignorar)                              │
│                       agent)     │                                         │
│                                  ▼                                         │
│                             ┌──────────┐                                   │
│                             │ wontfix  │───▶[*]                           │
│                             │(falso    │                                   │
│                             │positivo) │                                   │
│                             └──────────┘                                   │
│                                  │                                         │
│                                  ▼                                         │
│                             ┌──────────┐                                   │
│                             │ assigned │                                   │
│                             │(agent    │                                   │
│                             │trabalhando)│                                 │
│                             └────┬─────┘                                   │
│                                  │                                         │
│           ┌──────────────────────┼──────────────────────┐                  │
│           │                      │                      │                  │
│    (todos │              (alguns │               (nenhum│                 │
│  corrigidos)              parcial)              aplicável)                 │
│           │                      │                      │                  │
│           ▼                      ▼                      ▼                  │
│     ┌──────────┐          ┌──────────┐          ┌──────────┐               │
│     │ resolved │          │ partial  │          │ wontfix  │               │
│     │  (fixed) │          │(parcial) │          │(rejected)│               │
│     └────┬─────┘          └────┬─────┘          └────┬─────┘               │
│          │                     │                     │                      │
│          ▼                     ▼                     ▼                      │
│        [*]                   │                   [*]                       │
│                              │                                             │
│                              │(reativar)                                   │
│                              ▼                                             │
│                         ┌──────────┐                                       │
│                         │ reported │(loop)                                  │
│                         └──────────┘                                       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Sequência de Resolução de Issues

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SEQUÊNCIA: RESOLUÇÃO DE ISSUE #121                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Developer          GitHub Actions           Supabase          GitHub       │
│      │                    │                     │                │          │
│      │  Push PR #120      │                     │                │          │
│      │───────────────────▶│                     │                │          │
│      │                    │                     │                │          │
│      │                    │  Gemini Review      │                │          │
│      │                    │◀────────────────────│                │          │
│      │                    │                     │                │          │
│      │                    │  Parse Comments     │                │          │
│      │                    │────────────────────▶│                │          │
│      │                    │                     │                │          │
│      │                    │  Calcular Hashes    │                │          │
│      │                    │────────────────────▶│                │          │
│      │                    │                     │                │          │
│      │                    │  Verificar Duplicatas                  │          │
│      │                    │────────────────────▶│                │          │
│      │                    │                     │                │          │
│      │                    │  Nova Issue         │                │          │
│      │                    │────────────────────▶│                │          │
│      │                    │                     │                │          │
│      │                    │  Criar GitHub Issue │                │          │
│      │                    │─────────────────────────────────────▶│          │
│      │                    │                     │                │          │
│      │                    │  Atualizar          │                │          │
│      │                    │  github_issue_number│                │          │
│      │                    │────────────────────▶│                │          │
│      │                    │                     │                │          │
│      │                    │                     │    Issue #121  │          │
│      │◀──────────────────────────────────────────────────────────│          │
│      │                    │                     │                │          │
│      │  Corrige UUID      │                     │                │          │
│      │  nos exemplos      │                     │                │          │
│      │───────────────────▶│                     │                │          │
│      │                    │                     │                │          │
│      │                    │  Update Status      │                │          │
│      │                    │  ─▶ resolved        │                │          │
│      │                    │────────────────────▶│                │          │
│      │                    │                     │                │          │
│      │                    │                     │  Close Issue   │          │
│      │                    │─────────────────────────────────────▶│          │
│      │                    │                     │                │          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist de Implementação

### Sprint 6
- [ ] Migration SQL criada e testada
- [ ] Script `persist-reviews.cjs` implementado
- [ ] Sistema de hash SHA-256 funcionando
- [ ] Schema Zod atualizado
- [ ] Testes unitários passando

### Sprint 7
- [ ] Issue #121 corrigida (UUID nos exemplos)
- [ ] Issue #122 corrigida (validação de schema)
- [ ] Issue #123 corrigida (sem duplicatas)
- [ ] Loop circular resolvido
- [ ] Deploy em produção

### Sprint 8
- [ ] Webhook handler atualizado
- [ ] Notificação de agents implementada
- [ ] Sistema de retry com backoff
- [ ] DLQ configurada

### Sprint 9
- [ ] UI de reviews implementada
- [ ] Dashboard com filtros
- [ ] CLI funcionando
- [ ] Documentação atualizada

### Sprint 10
- [ ] Métricas coletando dados
- [ ] Relatórios automáticos
- [ ] Performance otimizada
- [ ] Treinamento realizado

---

## 📚 Referências

- [GEMINI_INTEGRATION_PHASES.md](./GEMINI_INTEGRATION_PHASES.md) - Plano original de integração
- [GEMINI_AGENT_PROTOCOL.md](../docs/standards/GEMINI_AGENT_PROTOCOL.md) - Protocolo padronizado
- [Issue #121](https://github.com/coelhotv/meus-remedios/issues/121) - Schema UUID
- [Issue #122](https://github.com/coelhotv/meus-remedios/issues/122) - Validação JSON Schema
- [Issue #123](https://github.com/coelhotv/meus-remedios/issues/123) - Duplicação
- [PR #120](https://github.com/coelhotv/meus-remedios/pull/120) - Protocolo P4.2

---

## 📝 Changelog

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-02-22 | Architect | Documento inicial criado |

---

*Documento mantido pela equipe de Arquitetura Meus Remédios*  
*Para dúvidas, consultar Tech Lead*