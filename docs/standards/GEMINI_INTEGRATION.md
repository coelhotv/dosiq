# Gemini Code Assist Integration

> **Documentação oficial da integração GitHub Actions + Gemini Code Assist (Arquitetura 100% Local)**  
> **Versão:** 2.0.0 | Última atualização: 2026-05-29

---

## 📋 Visão Geral

O projeto **Dosiq** utiliza o [Gemini Code Assist](https://cloud.google.com/gemini/docs/codeassist) para revisão automática de código em Pull Requests. Esta integração foi projetada para:

- **Automatizar** a revisão de código com feedback em tempo real diretamente no GitHub Actions.
- **Estruturar** e parsear localmente os comentários do Gemini para consumo por desenvolvedores e agentes.
- **Auditar** de forma estrita e 100% local a resolução de issues apontadas em commits passados.
- **Garantir** qualidade total antes do merge (bloqueando PRs com issues críticas/altas pendentes).

---

## 🏗️ Arquitetura

Toda a infraestrutura de parsing, resumo, classificação de segurança e auditoria de resoluções de PR opera de forma **100% local e offline**, rodando inteiramente em containers GitHub Actions, sem comunicação com endpoints externos, Supabase ou dependências de transporte como Vercel Blob.

### Fluxo de Dados e Integração Local

```
┌──────────────────┐      ┌─────────────────────────┐      ┌─────────────────┐
│  PR Events/      │─────▶│  GitHub Actions         │─────▶│  PR Inline      │
│  Gemini Review   │      │  Workflow               │      │  Comments /     │
└──────────────────┘      │                         │      │  Smart Summary  │
                          │ • parse & classification│      └─────────────────┘
                          │ • check-critical        │
                          │ • check-resolutions     │
                          └─────────────────────────┘
```

### Componentes Ativos

| Componente | Arquivo | Função |
|------------|---------|--------|
| **Workflow** | `.github/workflows/gemini-review.yml` | Orquestra toda a integração e jobs de auditoria local |
| **Parser** | `.github/scripts/parse-gemini-comments.cjs` | Extrai e categoriza comentários e prioridades do Gemini |
| **Resolutions** | `.github/scripts/check-resolutions.cjs` | Analisa commits recentes para verificar resolução de threads no PR |
| **Testes** | `.github/scripts/__tests__/parse-gemini-comments.test.js` | Validação do parser local |
| **Config** | `.gemini/config.yaml` | Configuração do comportamento do Gemini Code Assist |

---

## ⚙️ Workflow: `gemini-review.yml`

### Triggers

```yaml
on:
  pull_request_review:
    types: [submitted]
  pull_request:
    types: [synchronize]
  issue_comment:
    types: [created]
```

| Evento | Condição | Descrição |
|--------|----------|-----------|
| `pull_request_review` | `submitted` | Dispara quando Gemini posta uma review |
| `issue_comment` | Contém `/gemini review` | Trigger manual via comentário no PR |
| `pull_request` | `synchronize` | Disparado a cada novo commit pushado no PR (inicia validação) |

### Jobs Principais

#### 1. Detect Gemini Review (`detect`)
Detecta se o PR deve ser processado e extrai o número do PR, branch e SHA do commit.

#### 2. Poll for Gemini Review (`poll-review`)
Apenas executa se o evento não é um review direto do bot. Aguarda a publicação do review inicial do bot com timeout de 10 minutos.

#### 3. Parse Gemini Comments (`parse`)
Restaura o cache de reviews para otimizar execuções futuras, parseia todos os comentários inline do bot que não foram resolvidos ainda, e gera o output estruturado em `.gemini-output/review-{pr_number}.json` (salvo como artefato).

#### 4. Apply Auto-Fixes (`auto-fix`)
Executa `npm run lint -- --fix` e prettier automaticamente se o parser sinalizar issues puramente de estilo auto-fixables.

#### 5. Validate Build (`validate`)
Executa linter, smoke tests e build de produção para assegurar conformidade estrutural.

#### 6. Apply Labels (`apply-labels`)
Aplica dinamicamente labels no PR como `🤖 gemini-reviewed` baseadas na presença de issues.

#### 7. Post Summary (`summary`)
Cria ou atualiza um único comentário de resumo inteligente (com marcadores GEMINI_REVIEW_SUMMARY) no PR contendo as estatísticas e tabela de issues detectados.

#### 8. Check Critical/High Issues (`check-critical`)
Verifica a presença de issues classificados como `CRITICAL` ou `HIGH` (segurança ou crash). Se houver alguma issue bloqueante ativa, falha o pipeline para impedir o merge do PR.

#### 9. Check Resolutions Locally (`check-resolutions`)
Roda localmente a verificação de resoluções. Compara a árvore de commits e arquivos modificados para identificar se as sugestões inline do Gemini foram implementadas e responde de forma automatizada e inline nas threads dos comentários.

---

## 📝 Parser & Regras de Priorização

### Badges de Severidade do Gemini

O Gemini Code Assist indica a severidade utilizando badges em SVG no início dos comentários. O parser identifica essas severidades utilizando regex:

```
Critical:  badges/critical-priority.svg, security, vulnerability, injection, hardcoded secret
High:      badges/high-priority.svg, error handling, missing validation, breaking change
Medium:    badges/medium-priority.svg, consider, refactor, extract, missing test
Low:       nit, nitpick, style, Prefer, rename, Cosmetic
```

---

## 📁 Output Estruturado Local

### Localização do Artefato

```
.gemini-output/
└── review-{pr_number}.json
```

### Exemplo de Formato

```json
{
  "pr_number": 608,
  "timestamp": "2026-05-29T06:46:00Z",
  "summary": {
    "total_issues": 1,
    "auto_fixable": 0,
    "needs_agent": 1,
    "critical": 0
  },
  "issues": [
    {
      "id": 3322635657,
      "file": "packages/core/src/schemas/index.js",
      "line": 76,
      "issue": "O barrel export de geminiReviewSchema foi removido...",
      "suggestion": "export { geminiReviewSchema } from './geminiReviewSchema.js'",
      "priority": "HIGH",
      "auto_fixable": false,
      "url": "https://github.com/coelhotv/dosiq/pull/608#discussion_r..."
    }
  ]
}
```

---

## 🔧 Configuração

### `.gemini/config.yaml`

```yaml
code_review:
  comment_severity_threshold: MEDIUM
  max_review_comments: 20
  
  pull_request_opened:
    help: true
    summary: true
    code_review: true
    
  pull_request_synchronize:
    code_review: true
```

---

## 🧪 Testes

### Executar Testes do Parser

Os testes validam a lógica local de extração de severidades, ignorar threads resolvidas e parsing estruturado:

```bash
rtk npm run test:critical
```

---

## 🤝 Protocolo de Resolução de PR (Review Gates)

Para desenvolvedores e agentes trabalhando no repositório:

1. **High e Critical são Mandatórios**: Issues críticas ou de segurança não são opcionais e devem ser corrigidas no PR antes do merge.
2. **Decline com Justificativa**: Caso uma issue seja falso positivo, responda na thread justificando tecnicamente para auditoria local.
3. **Não Auto-Merge (R-060)**: Mesmo com pipeline verde e correções aplicadas, o merge final deve sempre passar por aprovação humana.

---

*Mantenedor: Dosiq Core Team*  
*Status: ✅ Implementado Localmente e Ativo*
