# Plano de Execucao: Estrategia Hibrida Web + Native

> **Status:** Plano operacional de execucao — H0-H5.5 COMPLETAS ✅ | H5.6 proxima
> **Data:** 2026-04-10 | **Ultima atualizacao:** 2026-04-12
> **Base:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md` (rev.1)
> **Ferramenta:** `/devflow` via Claude Code (Claude Pro)
> **Projeto:** Meus Remedios v4.0.0

---

## 1. Objetivo deste documento

Definir como executar a estrategia hibrida web+native usando sessoes de agente Claude Code via `/devflow`, considerando:

- restricoes de janela de contexto do Claude Pro (~200K tokens)
- necessidade de sessoes atomicas e rastreaveis
- dependencias humanas nao-automatizaveis
- coexistencia com o desenvolvimento continuo da web

---

## 2. Restricoes de contexto e regras de sessao

### 2.1. Budget de tokens por sessao

| Componente | Tokens estimados |
|-----------|-----------------|
| DEVFLOW bootstrap (state.json + indices filtrados) | ~20-30K |
| Spec da fase atual (1 arquivo) | ~5-15K |
| Addendums aplicaveis (1-2 arquivos) | ~5-10K |
| Codigo lido/escrito durante a sessao | ~30-60K |
| Respostas e raciocinio do agente | ~30-50K |
| **Total por sessao** | **~90-165K** |

### 2.2. Regras de contexto

1. **1 sprint interno = 1 sessao** — nao tentar fazer uma fase inteira numa sessao
2. **Carregar apenas a spec da fase atual** — nao carregar specs de fases futuras
3. **Maximo 2 addendums por sessao** — carregar apenas os aplicaveis ao sprint
4. **Master Spec sob demanda** — nao carregar inteira a cada sessao; consultar secoes especificas
5. **DEVFLOW bootstrap filtrado** — usar `goal` para filtrar rules/APs relevantes

### 2.3. Template de inicio de sessao

```bash
# 1. Bootstrap DEVFLOW
/devflow

# 2. Definir goal
/devflow coding "H{wave}.{sprint} — {descricao}"

# 3. Carregar spec da fase (via read)
# Ler apenas: plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE{N}_*.md

# 4. Carregar addendums aplicaveis (se necessario)
# Ler apenas os listados como obrigatorios na spec da fase

# 5. Implementar
# ...

# 6. Registrar
/devflow  # C5: registrar R-NNN / AP-NNN / journal
```

---

## 3. Waves de execucao

### Convencao de nomenclatura

- `H` = Hibrido
- `H0` = Wave 0 (Fase 0 da master spec)
- `H0.1` = Sprint 1 da Wave 0

---

## Wave H0 — Alinhamento e Guardrails (Fase 0) ✅ COMPLETA

**Estimativa:** 2-3 sessoes | ~1 semana
**Pre-requisitos humanos:** nenhum tecnico (fase documental)
**Spec:** `EXEC_SPEC_HIBRIDO_FASE0_GUARDRAILS.md`
**PR mergeado:** #457 (commit `441bea7`) — 2026-04-10

| Sessao | Sprint | Deliverables | Contexto a carregar |
|--------|--------|-------------|---------------------|
| H0.1 | 0.1 + 0.2 | Remover `expo` do root + auditoria factual + escrita das 3 ADRs | Fase 0 spec + package.json + vite.config.js |
| H0.2 | 0.3 + 0.4 | Inventarios de extracao (EXTRACTION_INVENTORY + SHARED_BOUNDARY_MATRIX) + supersessao docs antigos | Fase 0 spec + tree do src/ + addendum Human Dependencies |
| H0.3 | 0.5 | Registrar ADRs no DEVFLOW + validacao final + PR | Fase 0 spec + .agent/decisions.json |

**PR:** 1 unico (docs + ADRs + inventarios + remoção expo)

**Gates:**
- [x] `npm run build` passa
- [x] `npm run validate:agent` passa
- [x] 3 ADRs existem (ADR-026, ADR-027, ADR-028)
- [x] 2 inventarios existem (EXTRACTION_INVENTORY.md + SHARED_BOUNDARY_MATRIX.md)
- [x] `expo` removido do package.json
- [x] ADRs registradas no DEVFLOW (.agent/memory/decisions.json)

---

## Wave H1 — Workspaces (Fase 1) ✅ COMPLETA

**Estimativa:** 2 sessoes | ~3-4 dias
**Pre-requisitos humanos:** validacao visual da web + deploy preview Vercel
**Spec:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE1_WORKSPACES.md`
**Addendums:** Deploy Vercel Monorepo [`plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DEPLOY_VERCEL_MONOREPO.md`]
**PR mergeado:** incluido em #457 / wave H0-H1 consolidada — 2026-04-10

| Sessao | Sprint | Deliverables | Contexto a carregar |
|--------|--------|-------------|---------------------|
| H1.1 | 1.1 + 1.2 + 1.3 | Workspaces no root + skeleton packages + READMEs | Fase 1 spec + package.json |
| H1.2 | 1.4 + 1.5 | Turbo opcional + validacao retrocompativel (husky, vitest, Vercel) | Fase 1 spec + addendum Deploy Vercel |

**PR:** 1 unico (workspaces + estrutura vazia)

**Gates:**
- [x] `npm run dev` funciona
- [x] `npm run build` funciona
- [x] `npm run validate:agent` funciona
- [x] husky + lint-staged funcionam
- [x] Vercel deploy preview funcional
- [x] Vitest globs nao capturam packages/

**Bloqueio humano:** validacao visual web + deploy preview antes de merge ✅ validado

---

## Wave H2 — Core Puro (Fase 2) ✅ COMPLETA

**Estimativa:** 3-4 sessoes | ~1-2 semanas
**Pre-requisitos humanos:** nenhum (fase de codigo puro)
**Spec:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE2_CORE_PURO.md`
**Addendums:** Design Tokens [`plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DESIGN_TOKENS.md`]
**PRs mergeados:** H2.1-H2.2 (schemas+utils) + H2.3 design-tokens (commit `4e6b312`) — 2026-03-25

| Sessao | Sprint | Deliverables | Contexto a carregar |
|--------|--------|-------------|---------------------|
| H2.1 | 2.1 + 2.2 | `packages/core` com schemas migrados + zod como dep | Fase 2 spec + src/schemas/ |
| H2.2 | 2.3 | Utils puros migrados para packages/core | Fase 2 spec + src/utils/ |
| H2.3 | 2.4 + 2.5 | `packages/design-tokens` + alias repoint web | Fase 2 spec + addendum Design Tokens + vite.config.js |
| H2.4 | 2.6 | Testes + gates de validacao | Fase 2 spec + vitest configs |

**PRs:** 2 (schemas+utils; depois design-tokens+aliases+testes)

**Gates:**
- [x] Web compila com imports via @meus-remedios/core
- [x] Testes criticos passam
- [x] Nenhum browser API em packages/core
- [x] Design tokens exportam valores corretos (motionConstants.js + CSS keyframes + useMotion hook)

---

## Wave H3 — Adapters e Shared Data (Fase 3) ✅ COMPLETA

**Estimativa:** 4-5 sessoes | ~2-3 semanas
**Pre-requisitos humanos:** nenhum (fase de refactor web)
**Spec:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE3_ADAPTERS_SHARED_DATA.md`
**PRs mergeados:** #462 (H3.1-H3.2, commit `b4dcb94`) + #463 (H3.3-H3.5, commit `7e10c88`) — 2026-04-12

| Sessao | Sprint | Deliverables | Contexto a carregar |
|--------|--------|-------------|---------------------|
| H3.1 | 3.1 | `packages/storage` com contratos + web impl + memory impl | Fase 3 spec |
| H3.2 | 3.2 | `packages/config` com contratos + web loader | Fase 3 spec |
| H3.3 | 3.3 + 3.4 | Query cache refatorado (engine em shared-data, hook na web) — cache antigo mantido como fallback | Fase 3 spec + queryCache.js + useCachedQuery.js |
| H3.4 | 3.5 | Bootstrap web (webStorageAdapter, publicAppConfig, webSupabaseClient) | Fase 3 spec + supabase.js |
| H3.5 | 3.6 + 3.7 | 1-2 services por factory + validacao final + remocao cache antigo | Fase 3 spec + testes |

**PRs:** 2 (contratos+storage+config; depois cache+factories+bootstrap)

**Gates:**
- [x] `npm run test:critical` passa (543/543 OK)
- [x] `npm run build` passa
- [x] Zero `import.meta.env` em packages/
- [x] Zero `localStorage` em packages/
- [x] Cache antigo removido apos validacao (queryCache.js deletado, 413 linhas)

**Notas:** Gemini Code Assist apontou 4 issues (3 High + 1 Medium) — todos aplicados via commit ee5c4c3 antes do merge.
CACHE_KEYS centralizados em packages/shared-data com 25 chaves canonicas. generateCacheKey re-exportado do pacote.

---

## Wave H4 — Scaffold Mobile (Fase 4) ✅ COMPLETA

**Estimativa:** 3-4 sessoes | ~2 semanas
**Pre-requisitos humanos:** CRITICO — conta Expo, Apple Dev, Google Play, bundleIdentifier
**Spec:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE4_MOBILE_SCAFFOLD.md`
**Addendums:** Release Engineering [`plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_RELEASE_ENGINEERING.md`], Testing Mobile [`plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_TESTING_MOBILE.md`], Deploy Vercel [`plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DEPLOY_VERCEL_MONOREPO.md`], Human Dependencies [`plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_HUMAN_DEPENDENCIES.md`], Privacy [`plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_PRIVACY_PERMISSIONS_COMPLIANCE.md`]
**PR mergeado:** #464 (commit `7c43cbd`) — 2026-04-12 | Runtime fixes (commits `1ca9952`, `d6a0e3e`) — 2026-04-12

| Sessao | Sprint | Deliverables | Status |
|--------|--------|-------------|--------|
| H4.1 | 4.1 + 4.2 + 4.3 | Expo scaffold + app.config.js + eas.json + metro.config.js + babel.config.js | ✅ |
| H4.2 | 4.4 + 4.5 | Bootstrap native (config, storage, SecureStore chunked) | ✅ |
| H4.3 | 4.6 + 4.7 + 4.9 | Supabase native + React Navigation auth-aware + login + persistencia sessao | ✅ |
| H4.4 | 4.8 + 4.10 | Smoke screen + Jest setup + runtime crash fixes | ✅ |

**Runtime fixes pos-PR #464 (3h de debugging — 2026-04-12):**
- AP-H08: `react-native-url-polyfill` incompativel com Hermes/Expo Go SDK 53 — substituido por patch inline
- AP-H09: `registerRootComponent` activa expo-router automaticamente — corrigido com `AppRegistry` directo + rename `src/app/` → `src/navigation/`
- AP-H10: sessao nao persiste sem `getSession()` no mount + `initialRouteName` dinamico
- SecureStore chunked (1800 bytes/chunk) para tokens Supabase >2048 bytes

**Gates:**
- [x] App abre em iOS Simulator (Expo Go SDK 53) ✅ validado pelo maintainer
- [x] App abre em Android Emulator ✅ validado pelo maintainer 2026-04-14
- [x] Login funciona ✅
- [x] Sessao persiste ao reabrir ✅
- [x] Jest roda sem erro ✅
- [x] `meusremedios://` scheme configurado ✅

**Status das dependencias humanas (2026-04-12):**
- Expo/EAS: ✅ conta criada, tokens disponíveis
- Apple Developer: ⏳ conta criada, em processo de validação
- Google Play Console: ⏳ conta criada, em processo de validação
- bundleIdentifier: oficial `com.coelhotv.meusremedios` — aprovado no Play Console em 2026-04-14 ✅
- EAS Secrets (SUPABASE_URL, SUPABASE_ANON_KEY): ✅ disponíveis
- Validação iOS Simulator: ✅ confirmado pelo maintainer (Expo Go)
- Validação Android Emulator: ✅ concluída 2026-04-14

---

## Wave H5 — MVP Produto Mobile (Fase 5)

**Estimativa:** 6-8 sessoes | ~3-4 semanas
**Pre-requisitos humanos:** validacao funcional de cada tela
**Spec:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE5_MVP_PRODUTO.md`
**Addendums:** Deep Links [`plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DEEP_LINKS.md`], Offline/Sync [plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_OFFLINE_SYNC.md], Testing Mobile [plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_TESTING_MOBILE.md], Design Tokens [plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DESIGN_TOKENS.md]

| Sessao | Sprint | Deliverables | Contexto a carregar |
|--------|--------|-------------|---------------------|
| H5.1 | 5.1 | Shell + tabs + routing central | Fase 5 spec + addendum Deep Links |
| H5.2 | 5.2 | Tela Hoje / Dashboard enxuto | Fase 5 spec |
| H5.3 | 5.3 | Registro de dose (modal/sheet) | Fase 5 spec |
| H5.4 | 5.4 | Tela Tratamentos | Fase 5 spec |
| H5.5 | 5.5 | Tela Estoque | Fase 5 spec |
| H5.6 | 5.6 e 5.7 | Tela Perfil / Configuracoes + Vinculo Telegram | Fase 5 spec |
| H5.7 | 5.8 | Stale states + offline policy | Fase 5 spec + addendum Offline |
| H5.8 | 5.9 e 5.10 | Suite de testes + validacao | Fase 5 spec + addendum Testes mobile + Architecture Review H5 |


**PRs:** 6-8 (shell+tabs; dashboard+dose; tratamentos+estoque; perfil+telegram; stale; testes)

**Gates:**
- [ ] 7 fluxos MVP validados manualmente (humano)
- [ ] Testes unitarios de componentes criticos
- [ ] Zero dependencia de componentes web
- [ ] Design tokens Sanctuary aplicados

**Bloqueio humano:** validacao funcional de cada tela em device/simulator

---

## Wave H6 — Push Native e Beta (Fase 6)

**Estimativa:** 5-7 sessoes | ~3-4 semanas
**Pre-requisitos humanos:** CRITICO — APNs key, FCM, migracao SQL, device real, TestFlight
**Spec:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE6_PUSH_BETA_INTERNO.md`
**Addendums:** TODOS (Release Eng, Deep Links, Offline, Privacy, Testing, Human Deps)

| Sessao | Sprint | Deliverables | Contexto a carregar |
|--------|--------|-------------|---------------------|
| H6.1 | 6.1a | Migration SQL (notification_devices + user_settings) | Fase 6 spec |
| H6.2 | 6.1b | Dispatcher + canais (telegram + expo_push) — sem conectar a jobs | Fase 6 spec |
| H6.3 | 6.2 | Migrar checkReminders para dispatcher + flag de rollback | Fase 6 spec |
| H6.4 | 6.3 | Integracao mobile (permissao + token registration + UX) | Fase 6 spec + addendum Privacy |
| H6.5 | 6.4 | Foreground/background/cold start + pending intent + testes | Fase 6 spec + addendum Deep Links |
| H6.6 | 6.5a | Migrar demais jobs + observabilidade | Fase 6 spec |
| H6.7 | 6.5b | Build beta + distribuicao TestFlight/Internal Testing | Fase 6 spec + addendum Release Eng |

**PRs:** 4-5 (migrations+dispatcher; mobile push integration; job migration; beta build)

**Gates:**
- [ ] Telegram continua funcionando
- [ ] Push nativo funciona em iOS (device real — humano)
- [ ] Push nativo funciona em Android (device real — humano)
- [ ] Tap em notificacao leva para rota segura
- [ ] Flag de rollback testada
- [ ] Beta interno distribuido

**Bloqueio humano:** APNs/FCM config, migracao SQL, teste em device real, TestFlight upload

---

## Wave H7 — Migracao Web (Fase 7) — CONDICIONAL

**Estimativa:** 2-3 sessoes | ~1 semana
**Pre-requisitos humanos:** aprovacao explicita do maintainer
**Spec:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE7_MIGRACAO_WEB_APPS_WEB.md`
**Addendums:** Release Engineering, Deploy Vercel, Privacy

**Esta wave so executa se o maintainer decidir que o layout monorepo completo e necessario.**

| Sessao | Sprint | Deliverables | Contexto a carregar |
|--------|--------|-------------|---------------------|
| H7.1 | 7.1 | Mover src/, public/, index.html, vite.config.js para apps/web | Fase 7 spec + addendum Deploy Vercel |
| H7.2 | 7.2 | Ajustar aliases, scripts, CI, vercel.json | Fase 7 spec |
| H7.3 | 7.3 | Validacao final + deploy preview | Fase 7 spec |

---

## 4. Timeline estimada

```text
Semana 1      ─── H0 (Guardrails + ADRs + inventarios)     ✅ COMPLETA (PR #457)
Semana 2      ─── H1 (Workspaces)                          ✅ COMPLETA (consolidada em #457)
Semana 3-4    ─── H2 (Core Puro + Design Tokens)           ✅ COMPLETA (commit 4e6b312)
Semana 5-7    ─── H3 (Adapters + Shared Data)              ✅ COMPLETA (PRs #462 + #463)
Semana 8-9    ─── H4 (Scaffold Mobile) ← BLOQUEIO HUMANO: contas
Semana 10-13  ─── H5 (MVP Produto)
Semana 14-17  ─── H6 (Push + Beta) ← BLOQUEIO HUMANO: devices + stores
Semana 18+    ─── H7 (condicional)
```

**Total estimado:** 4-5 meses (H0-H6), sem contar bloqueios humanos.

Fatores que podem acelerar:
- sessoes paralelas em waves independentes (web features + docs)
- pre-setup de contas antes da Wave H4

Fatores que podem atrasar:
- bloqueios humanos nao resolvidos
- regressoes na web durante refactor
- problemas de toolchain Expo/Metro
- limite de tokens exigindo mais sessoes que o estimado

---

## 5. Regras de coexistencia com desenvolvimento web

### 5.1. A web continua evoluindo

Enquanto as waves hibridas rodam, a web pode receber:

- bug fixes
- features novas (desde que nao conflitem com refactors em andamento)
- melhorias de UX/performance

### 5.2. Regra de conflito

Se uma wave hibrida esta refatorando `queryCache` (H3) e a web precisa de um fix urgente no cache:

1. O fix entra na web normalmente
2. A wave hibrida absorve o fix no proximo sprint
3. Nao bloquear fix de producao por causa de refactor em andamento

### 5.3. Branches

- Waves hibridas usam branches `feature/hybrid-h{N}/{descricao}`
- Web features continuam com `feature/wave-{N}/{descricao}` ou `feature/{descricao}`
- Merges frequentes de main para branch hibrida para evitar drift

---

## 6. Protocolo de retomada de fase parcial

Se uma sessao termina no meio de uma wave (ex: H3 com 3/5 sprints feitos):

1. **Journal obrigatorio:** registrar no DEVFLOW exatamente o que foi feito e o que falta
2. **State.json atualizado:** goal reflete o sprint atual, nao a wave completa
3. **Proxima sessao:** carregar a mesma spec + ler journal da sessao anterior
4. **Nao recomecar do zero:** continuar de onde parou, nao refazer sprints ja concluidos

Template de journal para retomada:

```jsonl
{"type":"progress","wave":"H3","sprint":"3.3","status":"completed","notes":"Query cache engine criada em packages/shared-data"}
{"type":"progress","wave":"H3","sprint":"3.4","status":"in_progress","notes":"Bootstrap web iniciado, falta webSupabaseClient"}
{"type":"blocker","wave":"H3","description":"useCachedQuery depende de 3 outros hooks — verificar cascata"}
```

---

## 7. Metricas de sucesso por wave

| Wave | Metrica principal | Criterio | Status |
|------|------------------|----------|--------|
| H0 | Docs completos e corretos | 3 ADRs + 2 inventarios + expo removido | ✅ COMPLETA |
| H1 | Zero regressao web | Todos os scripts passam + Vercel OK | ✅ COMPLETA |
| H2 | Packages core funcionais | Imports via @meus-remedios/core sem fallback | ✅ COMPLETA |
| H3 | Web sobre novos contratos | Zero localStorage/import.meta.env em packages/ | ✅ COMPLETA |
| H4 | App mobile boots | Login + sessao persistente em 2 plataformas | ✅ iOS + Android validados |
| H5 | MVP funcional | 7 fluxos validados manualmente | ⏳ depende de H4 |
| H6 | Push operacional | Telegram + push nativo coexistindo | ⏳ depende de H5 |
| H7 | Monorepo completo | Web + mobile + packages em estrutura final | ⏳ condicional |

---

## 8. Riscos e mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|-------------|---------|-----------|
| Contexto estourado em fases complexas | Alta | Medio | Sprints atomicos, 1 por sessao |
| Bloqueio humano nao resolvido | Media | Alto | Checklist pre-wave no addendum Human Dependencies |
| Regressao web durante H3 | Media | Alto | Estrategia de coexistencia cache + flag rollback |
| Metro/Babel incompativel com Zod ESM | Media | Alto | Testar no H4.1 antes de implementar features |
| Drift entre spec e implementacao | Baixa | Medio | Gate: validate:agent + diff contra spec antes de PR |
| Expo Push free tier insuficiente | Baixa | Baixo | Irrelevante para beta (<50 usuarios) |

---

## 9. Checklist pre-execucao (para o maintainer)

Antes de iniciar a Wave H0, o maintainer deve confirmar:

- [ ] Li a Master Spec inteira (rev.1, 2026-04-10)
- [ ] Li os 4 novos addendums (Design Tokens, Deploy Vercel, Testing Mobile, Human Dependencies)
- [ ] Decidi sobre as contas Apple/Google (criar agora ou adiar para H4?)
- [ ] Conta Expo criada em expo.dev
- [ ] Confirmo que o limite de serverless functions Vercel (12) esta sob controle
- [ ] Confirmo `bundleIdentifier` e `androidPackage` (pelo menos placeholders)
- [ ] Entendo que code agents NAO mergeiam PRs — eu farei os merges
- [ ] Estou disposto a fazer validacoes manuais quando solicitado (simuladores, devices)

---

## 10. Como usar este documento

1. **Antes de cada wave:** ler a secao correspondente para saber quantas sessoes esperar
2. **Em cada sessao:** seguir o template de inicio (secao 2.3)
3. **Entre sessoes:** verificar o journal DEVFLOW para contexto
4. **Bloqueios:** consultar addendum Human Dependencies para saber o que depende de acao humana
5. **Duvidas de escopo:** consultar a spec da fase, nao este plano (este plano e operacional, nao normativo)
