# Épico 063: Zero Lint Regressions & Quality Assurance

> **Status:** Draft / Specification Phase  
> **Workflow:** DEVFLOW Specifying (`/devflow specifying`)  
> **Orchestration:** MetaSwarm Multi-Agent Swarm + Cavecrew + RTK  
> **Target:** 0 ESLint errors, 0 unit-label gate violations, zero regressions  

---

## 🎯 1. Objetivo Principal

Erradicar 100% das advertências (warnings), erros de linter e violações de scripts de gate (incluindo `lint:unit-label`) existentes em todo o monorepo (`apps/`, `packages/`, `server/`, `api/`), garantindo estabilidade absoluta, zero alteração comportamental (zero breaking changes) nas aplicações atuais e preservação dos testes críticos.

---

## 🚫 2. Escopo & Non-Goals

### Escopo Incluído (In-Scope)
1. **Resolução de Violações do ESLint 9**:
   - Complexidade ciclomática excessiva (`complexity > 20`).
   - Tamanho excessivo de funções (`max-lines-per-function > 150`).
   - Cores literais hardcoded em componentes mobile (`react-native/no-color-literals`).
   - Inline styles desnecessários (`react-native/no-inline-styles`).
   - Exports secundários em componentes (`react-refresh/only-export-components`).
   - Dependências ausentes ou instáveis em hooks (`react-hooks/exhaustive-deps`).
   - Diretivas `eslint-disable` obsoletas ou não utilizadas.
2. **Correção de Gate Específico**:
   - Eliminar concatenações diretas de string/unidade fora do core em `MedicineFormScreen.tsx` e demais telas (`scripts/unit-label-gate.sh`).
3. **Manutenção do TypeScript Ratchet**:
   - Garantir que `./scripts/strict-island.sh` permaneça verde durante todo o processo.

### Non-Goals (Fora de Escopo)
- Reescrita completa de componentes de UI ou alteração de regras de negócio.
- Alteração visual (design tokens/CSS) visível ao usuário final.
- Modificação das APIs públicas dos pacotes `@dosiq/core` e `@dosiq/shared-data`.

---

## 📐 3. Requisitos Arquiteturais & Contratos (DEVFLOW)

1. **R-060 (No Self-Merge)**: Nenhuma alteração gerada pelos subagentes do MetaSwarm será mergeada automaticamente na branch principal sem revisão (RC5/RC6) e validação final do humano.
2. **R-221 (SQP Release Protocol)**: Toda entrega parcial ou final deve registrar atualização de versão/changelog e entrada no journal C5 (`.agent/memory/journal/`).
3. **R-282 (ESM Extensions)**: Manter extensões `.js` em relative imports nos pacotes server/api/core.
4. **RTK Command Rule**: Todo agente executando comandos no terminal usará obrigatoriamente a CLI `rtk`.

---

## 📊 4. Métricas de Sucesso (Baseline Oficial)

| Métrica | Baseline Inicial (2026-08-02) | Valor Alvo |
|---------|──────────────────────────────|────────────|
| Erros / Avisos ESLint (`rtk proxy npm run lint`) | **159 warnings (0 erros)** | **0 warnings, 0 erros** |
| Avisos de Unit Label (`rtk npm run lint:unit-label`) | **0 erros (APROVADO)** | **0 erros** |
| Auto-fixáveis (`npx eslint --fix`) | **53 warnings** | **0** |
| Testes Críticos (`rtk npm run test:critical`) | **100% Passando** | **100% Passando** |
| Validation Safety Suite (`rtk npm run validate:agent`) | **Exit 0** | **Exit 0** |
| TS Ratchet (`./scripts/strict-island.sh`) | **Verde** | **Verde** |
