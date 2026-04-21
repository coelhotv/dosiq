# EXEC SPEC FASE 5: Documentação, Devflow & Specs

> **Branch:** `refactor/dosiq-migration-fase-5`
> **Pré-requisito:** Fases 1, 2, 3 e 4 todas merged em `main`
> **Duração estimada:** 30–45 min
> **Impacto:** Memória persistente dos agentes, manuais e documentação do repositório

---

## 0. Bootstrap Obrigatório

```bash
git checkout main && git pull   # Garantir TODAS as fases anteriores incorporadas
git checkout -b refactor/dosiq-migration-fase-5

# Confirmar que nenhuma referência legada de código restou das fases anteriores:
grep -rn "meusremedios\|@meus-remedios" \
  --include="*.js" --include="*.jsx" --include="*.json" \
  apps/ packages/ server/ api/ \
  | grep -v node_modules | grep -v dist/ | grep -v ios/Pods
# Se retornar algo, PARE — alguma fase anterior ficou incompleta

npm run lint    # Baseline limpo
```

---

## 1. Arquivos a Modificar

### 1.1 Documentos Root do Repositório

**Arquivo: `README.md`**
```bash
grep -n "Meus Rem\|meus-remedios\|meusremedios" README.md
# Corrigir:
# - Título do projeto
# - Descrição do produto
# - Comandos de clone/setup que mencionem o nome do repo
# - Links de badge/CI que mencionem o nome do repo (atenção: após rename no GitHub, os links mudarão)
```

**Arquivo: `CLAUDE.md`**
```bash
grep -n "Meus Rem\|meus-remedios\|meusremedios" CLAUDE.md
# Corrigir:
# - Linha de produto: "Meus Remédios é um PWA..." → "Dosiq é um PWA..."
# - Versão e nome do projeto no cabeçalho
# - Quaisquer referências ao workspace ou path do repositório
```

**Arquivo: `GEMINI.md`**
```bash
grep -n "Meus Rem\|meus-remedios\|meusremedios" GEMINI.md
# Corrigir:
# - Linha de produto: "Meus Remédios é um PWA..." → "Dosiq é um PWA..."
# - Referências ao nome da plataforma
```

**Arquivo: `AGENTS.md`**
```bash
grep -n "Meus Rem\|meus-remedios\|meusremedios" AGENTS.md
# Arquivo tem cabeçalho "Meus Remédios - AI Agent Guide"
# Corrigir: cabeçalho, corpo, exemplos, versão do produto
# CUIDADO: NÃO alterar os R-NNN, K-NNN ou AP-NNN referenciados — apenas o nome do produto
```

**Arquivo: `CHANGELOG.md`**
```bash
grep -n "Meus Rem\|meus-remedios\|meusremedios" CHANGELOG.md
# Corrigir referências ao nome do produto no contexto de novas features/versões
# Entradas históricas PODEM ser mantidas como estão (registro histórico)
```

**Arquivo: `RELEASE_NOTES.md`**
```bash
grep -n "Meus Rem\|meus-remedios\|meusremedios" RELEASE_NOTES.md
# Corrigir cabeçalho e contexto do produto
```

### 1.2 Arquivo do Workspace VSCode

**Arquivo:** `meus-remedios.code-workspace`

> [!WARNING]
> Este arquivo provavelmente precisa ser renomeado após o rename do repositório. No entanto, **não alterar o conteúdo interno agora** (manter os paths relativos atuais, que continuarão funcionando). O arquivo em si pode ser renomeado para `dosiq.code-workspace` apenas quando o usuário fizer o clone do novo repositório.

Verificar se o conteúdo contém referências hardcodadas:
```bash
cat meus-remedios.code-workspace
# Se contiver referências ao nome, corrigir; se for apenas configuração de paths relativos, deixar
```

### 1.3 Memória DEVFLOW — `.agent/memory/`

> [!CAUTION]
> Os arquivos de memória são JSONs estruturados. Qualquer edição incorreta pode corromper toda a memória do agente. O agente DEVE fazer backup antes e validar o JSON após edições.

```bash
# Fazer backup dos arquivos de memória antes de editar
cp .agent/memory/rules.json .agent/memory/rules.json.bak
cp .agent/memory/knowledge.json .agent/memory/knowledge.json.bak
```

**Arquivo: `.agent/memory/knowledge.json`**
- Buscar strings `"Meus Remédios"` e `"meus-remedios"` dentro dos campos `description`, `context` ou `content` dos knowledge items
- Substituir por `"Dosiq"` preservando a estrutura JSON
- **NÃO alterar** campos `id` (K-NNN), `tags` ou estrutura do schema

**Arquivo: `.agent/memory/rules.json`**
- Buscar strings `"Meus Remédios"` e `"meus-remedios"` dentro dos campos de texto das regras
- Substituir por `"Dosiq"` preservando a estrutura JSON
- **NÃO alterar** campos `id` (R-NNN), `severity`, `status` ou estrutura do schema

**Validação obrigatória após edição:**
```bash
node -e "JSON.parse(require('fs').readFileSync('.agent/memory/rules.json', 'utf8')); console.log('rules.json: OK')"
node -e "JSON.parse(require('fs').readFileSync('.agent/memory/knowledge.json', 'utf8')); console.log('knowledge.json: OK')"
# Ambos devem imprimir "OK" sem erros de parse
```

### 1.4 Atualização do `.agent/state.json`

Adicionar a migração ao sprint atual registrado no state:
```bash
# Verificar o estado atual:
cat .agent/state.json | head -20
```

No campo adequado do sprint ou `recent_context`, adicionar nota:
```json
// Exemplo de campo a atualizar:
"recent_activity": "Migração de branding: Meus Remédios → Dosiq (Fases 1-5 concluídas)"
```

### 1.5 Plans e Specs — Varredura

```bash
grep -rn "Meus Rem\|meus-remedios\|meusremedios" \
  --include="*.md" \
  plans/ \
  | grep -v "archive_old" \
  | grep -v "dosiq-migration"
# Corrigir nos specs ativos (backlog-native_app, backlog-roadmap_v4, etc.)
# EXCLUIR da correção: plans/archive_old/ (histórico) e plans/dosiq-migration/ (já correto)
```

**Arquivos de plans com risco confirmado pela auditoria:**
- `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
- `plans/backlog-native_app/GUIA_ASO_E_CONTEUDOS_PLAY_STORE.md` (parcialmente já editado pelo usuário)
- `plans/backlog-roadmap_v4/EXEC_SPEC_FASE_8.md`
- `plans/backlog-roadmap_v4/ROADMAP_v4.md`
- `plans/native_app_ux_revamp/EXEC_SPEC_NATIVE_APP_UX_SPRINT_PLAN.md`

### 1.6 Journal do DEVFLOW — Registrar a Migração

**Arquivo:** `.agent/memory/journal/` (encontrar o arquivo JSONL do sprint atual)

```bash
ls .agent/memory/journal/
# Identificar o arquivo do período atual (ex: 2026-W16.jsonl)
```

Adicionar entrada ao arquivo JSONL (append-only — NÃO reescrever):
```jsonl
{"date": "2026-04-21", "type": "refactor", "scope": "monorepo", "summary": "Migração completa de branding: Meus Remédios → Dosiq. 140 ocorrências corrigidas em 5 fases. Fases: Fase1 (npm packages), Fase2 (Expo/Mobile), Fase3 (Web/SEO), Fase4 (Bot/API/deep-links), Fase5 (Docs/Devflow)."}
```

---

## 2. O Que NÃO Alterar Nesta Fase

- ❌ `plans/archive_old/` — histórico preservado como está
- ❌ IDs estruturais do Devflow: R-NNN, K-NNN, AP-NNN, CON-NNN
- ❌ Estrutura dos schemas JSON do Devflow
- ❌ `SKILLS` (symlink) e `.roo` / `.roomodes` — configurações do IDE

---

## 3. Quality Gates

### Gate 1: Verificar JSON do Devflow
```bash
node -e "JSON.parse(require('fs').readFileSync('.agent/memory/rules.json', 'utf8')); console.log('rules.json: OK')"
node -e "JSON.parse(require('fs').readFileSync('.agent/memory/knowledge.json', 'utf8')); console.log('knowledge.json: OK')"
node -e "JSON.parse(require('fs').readFileSync('.agent/state.json', 'utf8')); console.log('state.json: OK')"
```

### Gate 2: Varredura de Resíduos em Docs
```bash
grep -rn "Meus Rem\|meus-remedios\|meusremedios" \
  --include="*.md" \
  README.md CLAUDE.md GEMINI.md AGENTS.md CHANGELOG.md RELEASE_NOTES.md plans/ \
  | grep -v "archive_old" \
  | grep -v "dosiq-migration"
# Resultado esperado: 0 linhas (ou apenas referências históricas intencionais)
```

### Gate Final da Fase
```bash
npm run lint
npm run validate:agent   # Confirmação final de que nada quebrou

# Verificação global final:
grep -rn "meus.remedios\|meusremedios\|Meus Rem\|@meus-remedios" \
  --include="*.js" --include="*.jsx" --include="*.json" --include="*.html" --include="*.md" \
  . | grep -v node_modules | grep -v dist/ | grep -v ios/Pods | grep -v plans/archive_old | grep -v ".bak"
# Resultado esperado: 0 linhas

git add -A
git commit -m "docs(devflow): atualizar documentação e memória DEVFLOW para marca Dosiq

- README, CLAUDE.md, GEMINI.md, AGENTS.md: produto renomeado
- .agent/memory: referências de branding atualizadas
- plans/: specs ativos atualizados
- Journal: migração registrada"
```

---

## 4. Critérios de Aceitação do PR

- [ ] `README.md` sem referências ao nome legado no contexto atual
- [ ] `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` com produto nomeado como "Dosiq"
- [ ] `.agent/memory/rules.json` e `knowledge.json`: JSON válido após edições
- [ ] `.agent/state.json`: sprint atualizado
- [ ] Journal DEVFLOW: entrada de migração registrada
- [ ] `plans/` ativos (exceto archive_old) sem referências legadas
- [ ] `npm run validate:agent` passando
- [ ] Verificação global final retornando 0 linhas


## 1. Escopo de Arquivos Modificados
- `README.md`, `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`
- `.agent/memory/rules.json` e `.agent/memory/knowledge.json`
- `plans/backlog-native_app/GUIA_ASO_E_CONTEUDOS_PLAY_STORE.md` (Adequar o que for dependente dessa nova onda).

## 2. Tarefas de Execução

### 2.1. Contexto Global de Memória
- Modificar os arquivos `.md` na root. Todos eles declaram intensivamente: "Meus Remédios é um PWA...". Refatorar tudo para "Dosiq é um PWA...".
- Atualizar URLs de Github declaradas de forma hardcoded nos manuais se pertinentes (e marcar as anotações alertando o clone path futuro).

### 2.2. Core Memory Files do Devflow
- O Agente (ou script em python se não puder ser direto via Node) deve abrir o `.agent/memory/knowledge.json` e realizar as modificações (strings contendo as identidades). O mesmo com `rules.json`.
- Adicionar ou formatar os logs no `.agent/state.json` para adicionar esse update ao sprint list que estiver ativo neste momento.

## 3. Validation Gate do Agente
- Rodar o `/devflow` ou as tools de agent verification de documentação local para garantir que a taxonomia Json não se afogou com erros de Parse com os replaces.
- O Agente deve esperar Aprovação do Usuário para unificar todo e qualquer Diff aberto na PR Oficial de Rebranding, terminando enfim a "Migração Local".
