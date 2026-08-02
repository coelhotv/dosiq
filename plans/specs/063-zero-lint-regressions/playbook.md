# Playbook de Orquestração Multi-Agente — Épico 063

> **MetaSwarm + Cavecrew + DEVFLOW Execution Guide**  
> **Objetivo:** Fatiamento em Etapas, Paralelização com Agentes e Garantia de Zero Regressão  

---

## 🌿 0. Estratégia de Git Branching

- **Branch Mãe de Integração**: `feat/063-zero-lint-regressions` (originada da `main`).
- **Branches Secundárias de Fase**:
  - `feat/063-phase-1-core-and-gates` ➔ PR ➔ `feat/063-zero-lint-regressions`
  - `feat/063-phase-2-shared-ui-and-hooks` ➔ PR ➔ `feat/063-zero-lint-regressions`
  - `feat/063-phase-3a-mobile-color-tokens` ➔ PR ➔ `feat/063-zero-lint-regressions`
  - `feat/063-phase-3b-mobile-complexity` ➔ PR ➔ `feat/063-zero-lint-regressions`
  - `feat/063-phase-4-server-and-api` ➔ PR ➔ `feat/063-zero-lint-regressions`
- **PR Final de Consolidação**: `feat/063-zero-lint-regressions` ➔ PR ➔ `main` (Aprovação Humana R-060).

---

## 🏗️ 1. Fatiamento do Projeto em Etapas (Phased Slicing)

Para evitar conflitos de merge e garantir isolamento, a limpeza de lint é dividida em 4 Etapas sequenciais:

```
[Etapa 1: Core & Gates] ──► [Etapa 2: Shared UI & Hooks] ──► [Etapa 3: Apps Mobile & Web] ──► [Etapa 4: Server & API]
```

---

## 🐝 2. Paralelização com Multi-Agentes (MetaSwarm + Cavecrew)

Dentro de cada etapa, múltiplos subagentes são instanciados simultaneamente para atuar em domínios não sobrepostos:

### Etapa 1: Core & Gates (Prioridade Alta)
- **Swarm Agent A1 (Gate Fixer)**: Corrige `MedicineFormScreen.tsx` usando o formatador `doseUnit.ts` para zerar `lint:unit-label`.
- **Swarm Agent A2 (Core Cleanup)**: Limpa diretivas `eslint-disable` obsoletas e tipos em `@dosiq/core` e `packages/shared-data`.

### Etapa 2: Shared UI & Hooks
- **Swarm Agent B1 (Hooks Refactor)**: Corrige dependências do `useMemo`/`useEffect` em `src/features/measures/components/ScatterTrend.tsx` e hooks compartilhados.
- **Swarm Agent B2 (Complexity Reduction)**: Refatora funções com complexidade > 20 em componentes compartilhados em subfunções puras e isoladas.

### Etapa 3: Apps Mobile & Web (Fatiado em 2 Slices pelo Baseline)
- **Slice 3A — Design System Tokens & Cores Literais (Mobile)**:
  - **Swarm Agent C1**: Corrige 28 ocorrências de `react-native/no-color-literals` e inline styles extraindo para `styles` / design system tokens em `apps/mobile/src/features/dashboard/` e `medications/`.
  - **Swarm Agent C2**: Corrige cores literais em `apps/mobile/src/features/notification/` e `profile/`.
- **Slice 3B — Decomposição de Telas Extensas & Complexidade (Mobile & Web)**:
  - **Swarm Agent C3**: Decompõe funções extensas (`max-lines-per-function > 150`) em `DevHubScreen.tsx`, `ExportSheet.tsx` e `NotificationInboxScreen.tsx`.
  - **Swarm Agent C4**: Refatora complexidade ciclomática (`complexity > 20`) em `HeroDoseCard.tsx` e `TodayScreen.tsx`.

### Etapa 4: Server & API
- **Swarm Agent D1 (Serverless & Bot)**: Ajusta imports com extensão `.js` (R-282) e limpa lintings nos diretórios `server/` e `api/`.

---

## ⚡ 3. Protocolo Cavecrew para Economia de Contexto

Para que os subagentes não saturem a memória do modelo durante o paralelismo:
1. **Comunicação Compacta**: Os subagentes utilizam respostas no padrão *caveman* (apenas diffs, linha afetada e confirmação de teste).
2. **Resultados Sintéticos**: O líder do MetaSwarm recebe apenas a confirmação dos testes (`PASS` / `FAIL`), mantendo a thread principal limpa.

---

## 🛡️ 4. Pipeline de Garantia de Zero Regressão (Quality Gate Pipeline)

Após cada alteração realizada por qualquer subagente, o seguinte pipeline de verificação DEVE ser executado sequencialmente:

```bash
# 1. Checagem de Linter e Gates Específicos
rtk npm run lint

# 2. Testes Unitários Críticos (Garantia de Comportamento)
rtk npm run test:critical

# 3. Ratchet de TypeScript (Garantia de que nenhum tipo piorou)
./scripts/strict-island.sh

# 4. Suite Completa de Segurança de Agente
rtk bash .metaswarm/shims/run-swarm-check.sh
```

---

## 🔄 5. Protocolo de Finalização (DEVFLOW C5)

Ao concluir todas as etapas:
1. Executar a auto-revisão **RC5** e a revisão independente **RC6** (`ai-review.sh`).
2. Atualizar a versão e changelog conforme **R-221 SQP**.
3. Registrar a memória em `.agent/memory/journal/YYYY-WWW.jsonl` e atualizar `.agent/state.json`.
4. Submeter o PR ao usuário para aprovação e merge manual (**R-060**).
