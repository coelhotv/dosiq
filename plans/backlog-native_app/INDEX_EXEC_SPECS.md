# Dosiq Native App — Índice de Specs de Execução

> **Projeto**: Evolução CRUD Nativa  
> **Criado**: 14 de maio de 2026  
> **Master Plan**: [MASTER_PLAN_HIBRIDO_EVOLUCAO_CRUD.md](MASTER_PLAN_HIBRIDO_EVOLUCAO_CRUD.md)

---

## Timeline Visual

```
Sem 1-3  4-6   7-9  10-11  ~12-13   ~14-16
    ├───┤ ├───┤ ├───┤ ├───┤  ├─────┤  ├──────┤
    Pré   F1    F2   F2.5+F3  Fase 4   Fase 5
    Req   Med   Trat Estoque  Perfil+  Analíticas
                              Landing+ (Hist/Ader/
                              Onboard  Consulta)
    ✅    ✅    ✅   ✅       📋       📋
```

**Fases 0 → 3 entregues** (~11 sprints + Fase 2.5). **Fases 4-5 com spec pronta** (~4-5 sprints). Fase 6 a planejar.

---

## Specs Disponíveis

| Fase | Spec | Sprints | Status |
|------|------|---------|--------|
| **Pré-Req** | [EXEC_SPEC_PRE_REQUISITOS.md](EXEC_SPEC_PRE_REQUISITOS.md) | P.1 — P.3 | ✅ Entregue |
| **Fase 1** | [EXEC_SPEC_FASE1_MEDICAMENTOS.md](EXEC_SPEC_FASE1_MEDICAMENTOS.md) | M1.1 — M1.3 | ✅ Entregue |
| **Fase 2** | [EXEC_SPEC_FASE2_PROTOCOLOS.md](EXEC_SPEC_FASE2_PROTOCOLOS.md) | T2.1 — T2.3 | ✅ Entregue |
| **Fase 2.5** | [EXEC_SPEC_FASE2_5_STATUS_TRATAMENTOS.md](EXEC_SPEC_FASE2_5_STATUS_TRATAMENTOS.md) | T2.5.1 | ✅ Entregue |
| **Fase 3** | [EXEC_SPEC_FASE3_ESTOQUE.md](EXEC_SPEC_FASE3_ESTOQUE.md) | S3.1 — S3.2 | ✅ Entregue |
| **Fase 4** | [EXEC_SPEC_FASE4_PERFIL.md](EXEC_SPEC_FASE4_PERFIL.md) | S4.1 — S4.2 | 📋 Spec pronta |
| **Fase 5** | [EXEC_SPEC_FASE5_ANALITICAS.md](EXEC_SPEC_FASE5_ANALITICAS.md) | S5.1 — S5.3 | 📋 Spec pronta |
| **Fase 6** | _(a criar — Emergência · Chatbot · PDF · Export LGPD — **fecha paridade**)_ | — | ⏸️ A planejar |
| **Fase 7** | _(a criar — mobile-only: camera · HealthKit · widgets · geolocation · watch · chatbot on-device)_ | — | ⏸️ A planejar |

---

## Métricas por Fase

| Fase | Novos Arquivos | Arquivos Modificados | Services Extraídos | Testes |
|------|---------------|---------------------|--------------------| -------|
| Pré-Req | ~15 | ~2 | 0 | ~6 |
| Fase 1 | ~12 | ~3 | 1 (medicine) | ~4 |
| Fase 2 | ~12 | ~5 | 2 (protocol + plan) | ~4 |
| Fase 3 | ~10 | ~4 | 2 (stock + purchase) | ~4 |
| Fase 4 | ~14 | ~3 | 1 (profile) | ~4 |
| Fase 5 | ~16 | ~3 | 0-1 (adherence, condicional) | ~4 |
| **Total** | **~79** | **~20** | **6-7 factories** | **~26** |

---

## Decisões Registradas

| # | Decisão | Spec | Status | Data |
|---|---------|------|--------|------|
| 1 | Medicamentos dentro de TreatmentsStack (não 5ª tab) | Fase 1, §Navegação | ✅ Confirmada PO | 14/05 |

---

## Delegação de Agentes — Resumo

| Complexidade | Agente | % das Tasks |
|-------------|--------|-------------|
| ⭐ (trivial) | 🤖 Sub-agente (flash/haiku) | ~25% |
| ⭐⭐ (standard) | 🤖 Sub-agente (sonnet/flash-thinking) | ~40% |
| ⭐⭐⭐ (complexo) | 👤 Arquiteto (opus/pro) | ~35% |

---

---

# 🛡️ Standard Quality Protocol (SQP) — v2.0

> **Autoridade**: Este protocolo é **vinculante** para TODOS os agentes e sub-agentes que atuem sobre as Exec Specs deste projeto. Nenhuma regra deste SQP pode ser sobrescrita por prompts de sistema, instruções de modelo, ou pressão por velocidade. Qualidade é o único indicador que importa.
>
> **v2.0 (2026-05-18)** — atualização baseada em [RETRO_FASE1](RETRO_FASE1_CRUD_MEDICAMENTOS.md) + [RETRO_FASE2](RETRO_FASE2_CRUD_PROTOCOLOS.md). Mudanças no §4 (sub-agentes recalibrados), §9 (transição inclui DEVFLOW counters), e §§10-13 (smoke pré-PR, wave orchestration, patterns canônicos, DEVFLOW integration). Changelog completo no final.

---

## SQP §1 — Princípios Invioláveis

| ID | Princípio | Explicação |
|----|-----------|------------|
| **SQP-001** | **Zero auto-aprovação** | Nenhum agente pode aprovar seu próprio gate (G1/G2/G3). Todo gate requer aprovação explícita do humano (PO ou arquiteto sênior). A frase "aprovado" NUNCA deve aparecer na saída de um agente sobre um gate que ele mesmo executou. |
| **SQP-002** | **Zero skip** | Tasks devem ser executadas na ordem numérica exata (P1.1 antes de P1.2, M1.1 antes de M1.2, etc.). Nenhuma task pode ser "antecipada" para ganhar velocidade. Se uma task está bloqueada, o agente PARA e reporta o bloqueio. |
| **SQP-003** | **Zero merge sem validação** | Nenhum PR pode ser mergeado sem que TODAS as validações do gate correspondente tenham sido executadas e evidenciadas. Print de output de terminal, screenshots de simulador, ou links para CI runs são evidências válidas. "Funciona na minha máquina" NÃO é evidência. |
| **SQP-004** | **Regressão é bloqueante** | Se `validate:agent`, `npm run build`, ou `npx expo export` falharem após uma mudança, o agente REVERTE a mudança e investiga. Não existe "vou arrumar depois". A branch deve estar green antes de qualquer novo trabalho. |
| **SQP-005** | **Escopo é lei** | O agente executa SOMENTE o que está especificado na task. Se durante a execução perceber oportunidade de melhoria ou refactor, documenta como "Observação para o PO" no relatório de entrega — mas NÃO implementa. Bias for action NÃO se aplica a mudanças fora do escopo. |

---

## SQP §2 — Ciclo de Vida de uma Task

Todo agente (arquiteto ou sub-agente) que executar qualquer task DEVE seguir exatamente este ciclo:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CICLO DE VIDA — POR TASK                      │
│                                                                  │
│  1. CLAIM    → Agente anuncia: "Iniciando task X.Y"              │
│               Verifica pré-requisitos (tasks anteriores OK?)     │
│               Se NÃO → STOP + reportar bloqueio                 │
│                                                                  │
│  2. PLAN     → Lista os arquivos que serão criados/modificados   │
│               Lista os testes que serão executados               │
│               Estima risco: baixo/médio/alto                     │
│                                                                  │
│  3. EXECUTE  → Implementa SOMENTE o que está no PLAN             │
│               Se desvio necessário → STOP + pedir permissão     │
│                                                                  │
│  4. VALIDATE → Executa TODOS os comandos de validação:           │
│               • rtk lint (se houver .js/.jsx modificados)        │
│               • testes unitários relevantes                      │
│               • build/export se aplicável                        │
│               COLA o output no relatório                         │
│                                                                  │
│  5. REPORT   → Relatório estruturado (ver template §6)           │
│               Inclui evidências (output de terminal)             │
│               NÃO marca gate como "aprovado"                    │
│               Entrega para humano avaliar                        │
│                                                                  │
│  6. WAIT     → Para e espera aprovação humana antes de avançar   │
│               NÃO inicia próxima task proativamente              │
└─────────────────────────────────────────────────────────────────┘
```

---

## SQP §3 — Protocolo de Gate (G1/G2/G3)

Gates são checkpoints formais entre fases de maturidade de um serviço. O processo é:

### 3.1 — Quem solicita o gate?

O **agente que completou a última task do sprint** solicita o gate ao humano. Nunca auto-convoca.

### 3.2 — Checklist de evidência (por gate)

O agente produz um **Gate Report** com esta estrutura exata:

```markdown
## Gate Report: [G1|G2|G3] — [Nome da Fase]

### Critérios de Aprovação
| # | Critério (copiado da spec) | Evidência | Status |
|---|---------------------------|-----------|--------|
| 1 | ...                       | [output/link/screenshot] | ✅ Pass / ❌ Fail |
| 2 | ...                       | ...       | ... |

### Comandos Executados
\```bash
# Cada comando com output completo colado abaixo
rtk npm run validate:agent
# → [output]
\```

### Observações para o PO
- (qualquer insight, risco, ou sugestão fora de escopo)

### Veredito do Agente
⏳ AGUARDANDO APROVAÇÃO HUMANA
(O agente NUNCA escreve "Aprovado" aqui)
```

### 3.3 — Quem aprova?

| Gate | Aprovador | Como |
|------|-----------|------|
| G1 (Copy) | 👤 Humano (PO ou arquiteto sênior) | Review do Gate Report + smoke test manual |
| G2 (Extract) | 👤 Humano | Review do Gate Report + diff validation |
| G3 (Migrate) | 👤 Humano | Review do Gate Report + CI green + merge approval |

**Regra**: O aprovador NÃO pode ser o agente que executou as tasks. Separação de responsabilidades.

### 3.4 — O que acontece se um gate falhar?

```
Gate FALHOU
  ├── Agente REVERTE para o último estado green
  ├── Agente documenta a causa raiz
  ├── Agente propõe fix com novo PLAN
  ├── Humano aprova o PLAN
  └── Agente re-executa + solicita gate novamente
```

Não existe "aprovação parcial". Gate é binário: PASS ou FAIL.

---

## SQP §4 — Regras para Sub-Agentes (Cavecrew Distribution — ADR-044)

**Recalibração v2.0** (pós-Fase 2): Sonnet validado em tarefas complexas (factory criada zero-shot em T3.1, useTreatments com 8 campos em T6). Restrições anteriores eram defensivas demais. Modelo de distribuição abaixo.

### 4.1 Matriz de delegação

| Modelo | Ideal para | Cap arquivos | Brief obrigatório |
|--------|------------|--------------|-------------------|
| 👤 **Opus (arquiteto)** | Decisões arquiteturais · integração cross-feature · sensíveis (auth/dados de saúde) · fixes pós-Gemini | sem cap (com cuidado §11) | — |
| 🤖 **Sonnet ⭐⭐** | Factories novas · espelhar pattern existente · refactor com escopo claro · UX complexa com lógica de state | **até 4 arquivos** (validado em Fase 2) | R-230 (6 itens) |
| 🤖 **Haiku ⭐** | Tasks mecânicas: parity tests · find/replace · barrel updates · doc cross-ref · sweep retroativo | até 2 arquivos | R-230 (6 itens) |

### 4.2 Brief obrigatório (R-230) — todo spawn cavecrew

```
1. Arquivos read-only (refs absolutos com line ranges)
2. Path absoluto do arquivo a criar/modificar
3. Contrato exato (props, return shape, exports)
4. Regras críticas R-NNN aplicáveis (especialmente R-010 hooks order)
5. VALIDAÇÃO pós-code com comandos exatos (rtk lint + tests relevantes)
6. "NÃO COMMITAR" explícito (Opus consolida + commita no fim da wave)
```

Spawn sem os 6 itens = retrabalho garantido. Fase 1+2 confirmaram zero retrabalho em 17 spawns com brief completo.

### 4.3 Restrições por modelo

| # | Regra | Motivo |
|---|-------|--------|
| SA-001 | Sonnet máx 4 arquivos · Haiku máx 2 | Cap recalibrado em Fase 2; original `max 2` era restritivo demais |
| SA-002 | **Cavecrew PODE criar factories** se brief lista pattern de referência (R-231 + parity tests) | Validado Fase 2 (createProtocolRepository); SA-002 original removido |
| SA-003 | Cavecrew **PODE modificar barrel exports** (schemas/utils/index.js) mas DEVE auditar consumers (AP-164 naming collision) | Risco mitigado por audit; AP-164 mostra que problema é collision, não barrel em si |
| SA-004 | Não pode alterar navigation files (`RootTabs`, `Navigation.jsx`) sem aprovação Opus | Impacto global; mantida |
| SA-005 | Inclui `rtk lint` output em toda entrega | Validação mínima obrigatória |
| SA-006 | Lint falha >2x → escala pra arquiteto | Mantida |
| SA-007 | Não deleta arquivos existentes sem aprovação Opus | Risco regressão |
| SA-008 | Código DEVE seguir patterns vizinhos (`rtk read` arquivo similar antes) | Mantida |
| SA-009 | **NOVO** — antes de spawn, fazer `git fetch origin` + sync da branch base (AP-169) | Branch outdated → duplicação no push |
| SA-010 | **NOVO** — se task toca packages compartilhados (`@dosiq/core`, `@design-tokens`), brief DEVE listar consumers afetados | Anti AP-164 (naming collision) + anti barrel-export sem audit |

---

## SQP §5 — Validação Contínua (Mandatória)

Após **qualquer** modificação de arquivo `.js` ou `.jsx`, o agente executa:

```bash
# 1. Lint (SEMPRE)
rtk lint

# 2. Testes relevantes (SE existirem)
rtk npm test -- --testPathPattern="<nome-do-arquivo-modificado>"

# 3. Build check (A CADA PR, não a cada task)
rtk npm run build          # web
npx expo export            # mobile (só se mobile foi modificado)

# 4. Validate:agent (ANTES de solicitar gate)
rtk npm run validate:agent
```

**Regra de ouro**: Se o agente não colou o output do lint/test no relatório, a task é considerada **não validada** e será rejeitada no review.

---

## SQP §6 — Template de Relatório de Task

Todo agente deve entregar este relatório após completar uma task:

```markdown
## Task Complete: [Task ID] — [Nome]

### Agente
[🤖 Builder / 👤 Arquiteto] — [Modelo usado]

### Escopo Executado
- `src/path/arquivo1.js` (criado): [descrição 1 linha]
- `src/path/arquivo2.jsx` (modificado L42-L68): [descrição 1 linha]

### Desvios da Spec
- Nenhum / [descrição do desvio + justificativa]

### Validação
\```bash
$ rtk lint
# [output]

$ rtk npm test -- --testPathPattern="arquivo"
# [output]
\```

### Observações para o PO
- [qualquer insight fora de escopo]

### Status
✅ Task completa — aguardando review humano para prosseguir
```

---

## SQP §7 — Anti-Padrões Proibidos

Comportamentos que resultam em **rejeição automática** do trabalho:

| # | Anti-Padrão | Consequência |
|---|------------|--------------|
| AP-SQP-001 | Agente escreve "Gate aprovado" ou "Gate passed" sem input humano | Task inteira rejeitada |
| AP-SQP-002 | Agente inicia task N+1 sem confirmação de que task N foi aceita | Task N+1 inteira descartada |
| AP-SQP-003 | Agente faz "improvements" fora do escopo da task | Revert do improvement, warning ao agente |
| AP-SQP-004 | Agente pula validação por "confiança" no código | Task devolvida para re-execução com validação |
| AP-SQP-005 | Sub-agente modifica arquivo que não está na lista de sua task | Revert integral, escalação |
| AP-SQP-006 | Agente faz merge ou push direto para `main` | **Bloqueio imediato** do agente |
| AP-SQP-007 | Agente assume que teste anterior ainda vale após nova mudança | Task devolvida — reteste obrigatório |
| AP-SQP-008 | Agente omite output de validação no relatório | Relatório rejeitado, re-execução |
| AP-SQP-009 | Agente combina múltiplas tasks em uma única entrega para "eficiência" | Entrega rejeitada — 1 task = 1 relatório |
| AP-SQP-010 | Agente resolve conflito de merge sozinho sem consultar humano | Revert do merge, review humano |

---

## SQP §8 — Escalação

| Nível | Condição | Ação do Agente |
|-------|----------|----------------|
| 🟢 Normal | Task dentro do esperado | Seguir ciclo §2 |
| 🟡 Aviso | Lint ou test falha + corrigido em ≤ 2 tentativas | Documentar no relatório |
| 🟠 Bloqueio | Task não pode avançar (dep externa, ambiguidade) | **STOP** → reportar com motivo → esperar humano |
| 🔴 Crítico | Regressão detectada em área fora do escopo | **STOP + REVERT** → reportar imediatamente → NÃO tente resolver |

**Regra**: Na dúvida, escale. Nunca assuma. A frase "achei que era seguro" não é aceitável.

---

## SQP §9 — Transição entre Fases

A transição de uma fase para a próxima (ex: Pré-Req → Fase 1) requer **todas** as condições:

```
CHECKLIST DE TRANSIÇÃO DE FASE
================================
[ ] G3 da fase anterior 100% completo (se aplicável)
[ ] Gate Report aprovado pelo humano (com evidências)
[ ] `rtk npm run validate:agent` web — 0 falhas
[ ] `npx expo export` mobile — 0 erros
[ ] `npm run build` web — 0 erros
[ ] Services locais web obsoletos deletados (se G3)
[ ] Factory exportada no `@dosiq/core/repositories/` (R-231 — não mais `shared-data`)
[ ] Smoke PO concluído + checklist `docs/operations/<FASE>_G3_SMOKE_CHECKLIST.md` assinado
[ ] PR mergeado em `main` com aprovação do PO (R-060 — nunca auto-merge)
[ ] Nenhuma task pendente da fase anterior
[ ] Nenhum bug conhecido em estado aberto da fase anterior
[ ] RETRO da fase escrita em `plans/backlog-native_app/RETRO_<FASE>.md`
[ ] DEVFLOW C5 aplicado: R-NNN/AP-NNN/ADR-NNN/journal entry + `state.json` counters batem com índices
[ ] EXEC_SPEC da próxima fase atualizada com gaps identificados na RETRO atual (bloco "Cuidados aprendidos")
```

**Um único item não checado = transição bloqueada. Sem exceções.**

---

## SQP §10 — Smoke PO Pré-PR (R-234)

**Vinculante** desde Fase 2 (após D6 RETRO_FASE2). Originada de Fase 1 onde push imediato → PR gerou ~25 commits de iteração em M1.2.

### 10.1 Quando aplica
- Toda sprint com mudança UI mobile ou web visível ao usuário
- Toda sprint com mudança de fluxo (navegação, forms, modais)

### 10.2 Fluxo correto
```
[implementação done] → [push pra branch remote] → [build EAS preview se mobile]
   ↓
[PO faz smoke local/iOS/Android API 24] → [feedback]
   ↓
SE bugs/refinos → loop até PO aprovar
SE OK → `gh pr create` (NÃO antes!)
```

### 10.3 Anti-pattern explícito
- **AP-SQP-011** — Abrir PR antes de smoke PO em sprint UI = rejeição automática. Push pra remote OK (necessário pra EAS worktree); `gh pr create` SEGURA até PO aprovar localmente.

### 10.4 Exceção
- Sprints puramente backend/services/schemas/docs/memory podem abrir PR sem smoke PO. Critério: zero UI alterada visivelmente.

---

## SQP §11 — Wave Orchestration + Dependency Graph (R-237)

**Adotada Fase 2.5** (12 tasks em 4 waves, 9 spawns paralelos, -60% tokens Opus vs spawn sequencial).

### 11.1 Quando aplica
- Sprint com 5+ tasks que admitem paralelismo
- Tasks heterogêneas (mecânicas + complexas + integração)

### 11.2 Protocolo
```
1. Listar todas as tasks da sprint
2. Pra cada task, identificar inputs (tasks que precisam estar done antes)
3. Agrupar tasks sem deps mútuas em "waves" paralelas
4. Spawn por wave; AGUARDAR wave completar antes da próxima
5. Reservar Opus inline pra tasks sensíveis (integração, decisões arquiteturais)
6. Sonnet pra tarefas mecânicas complexas (espelhar pattern, refactor escopo claro)
7. Haiku pra tarefas mecânicas simples (tests, find/replace, docs)
8. Wave final inline (Opus) consolida outputs + commita
```

### 11.3 Quando NÃO aplicar
- Sprint <5 tasks (orchestration overhead > ganho)
- Tasks com deps lineares 1→2→3→4 (waves degeneram em sequencial)
- Sprint exploratório (especificação evolui durante execução)

### 11.4 Brief de cada spawn — vide §4.2 (R-230)

---

## SQP §12 — Patterns Canônicos Web↔Mobile

**Consolidados nas RETROs.** Toda spec nova DEVE referenciar (ou explicar desvio).

### 12.1 Factory pattern (R-231 + ADR-045)
- Lógica CRUD compartilhada → `packages/core/src/repositories/createXRepository.js`
- DI via parâmetro `client` (Supabase web vs mobile)
- Parity tests com mocked client em `packages/core/src/repositories/__tests__/`
- **NUNCA** `packages/shared-data/src/services/` (deprecado pra repositories)

### 12.2 Helper canônico derivado (R-NNN Fase 2.5)
- Derivações de estado compartilhadas web↔mobile → `packages/core/src/utils/`
- Exemplo: `resolveTreatmentStatus(protocol, today)` substitui lógica duplicada nas 2 apps
- Re-exportar via `packages/core/src/utils/index.js`

### 12.3 Hook canônico antes de inline (R-235)
- Antes de implementar mutation/delete/refresh inline em screen, `grep` por `use<Entity>Delete` / `use<Entity>Mutation` no `apps/<plataforma>/src/features/<dominio>/hooks/`
- Inline OK SOMENTE se nenhum hook cobrir; documentar motivo em comment

### 12.4 Cache invalidation matrix (R-236)
- Toda mutation DEVE documentar (inline JSDoc) TODOS os AsyncStorage snapshots que invalida
- Pattern obrigatório:
```js
/**
 * Caches invalidados:
 *   - @dosiq/protocols-snapshot (detail/useProtocol)
 *   - @dosiq/treatments-snapshot (listagem/useTreatments)
 * Caches NÃO invalidados (intencionalmente):
 *   - @dosiq/medicines-snapshot (mutation não afeta lista de medicamentos)
 */
```
- Esquecer um cache adjacente = bug latente (D11 Fase 2.5)

### 12.5 Bottom sheet mobile Android (R-233)
- `<Modal statusBarTranslucent>` + spacer `<View height={StatusBar.currentHeight}>` (Android) + `<SafeAreaView edges={['bottom']}>`
- Sem isso: API 24 mostra overlay truncado + inputs vazando

### 12.6 Decimal PT-BR (AP-167)
- Inputs numéricos com vírgula preservam estados intermediários como string (`"0,"`, `"."`, vazio)
- Coerção apenas no submit (Zod `z.coerce.number()`)

### 12.7 Unidade(s) sempre (ADR-046)
- `formatDoseUnit` retorna sempre `"unidade"` ou `"unidades"` (nunca mapeia por `dosage_unit`)
- Apresentação de unidade real (ml/mg/cp) fica em DataPills separadas

### 12.8 Locale Zod PT-BR (R-232)
- Mensagens via `z.config(localeConfig)` em `@dosiq/core/zodSetup.js`
- Overrides locais SÓ quando regra dá info útil (ex: "max 200 caracteres")

### 12.9 Naming distintivo em packages com `export *` (AP-164)
- Antes de adicionar export novo no barrel `packages/core/src/<dominio>/index.js`, fazer:
```bash
rtk grep -rn "export.*<funcName>" packages/core/src/
```
- 2 funções com mesmo nome em arquivos diferentes = renomear uma (ex: `isProtocolInPeriod` vs `isProtocolActiveOnDate`)
- Lint NÃO pega; bug aparece em runtime com semântica errada

### 12.10 Vitest config propagation (AP-170)
- Toda mudança em alias em `vitest.config.js` propaga pra TODOS os outros configs vitest do workspace:
```bash
rtk find apps/ -name 'vitest*.config.js' -type f
```
- Esquecer: tests locais passam, `validate:agent` (CI) falha

### 12.11 Sweep retroativo no mesmo PR
- Quando bug detectado é pattern já presente em outros lugares (ex: AP-165 sheets sem statusBarTranslucent), corrigir TODOS no mesmo PR
- Acessória: comentar "sweep retroativo aplicado em [lista de arquivos]" na PR description

---

## SQP §13 — DEVFLOW Integration

**SQP e DEVFLOW são complementares.** SQP rege processo de entrega; DEVFLOW rege memória persistente.

### 13.1 C5 obrigatório pós-merge
Após merge do PR de uma sprint, agente executa imediatamente:
- Novos bugs → `AP-NNN` em `.agent/memory/anti-patterns/<cat>/AP-NNN.md` + bump `ANTI_PATTERNS_INDEX.md`
- Padrões novos → `R-NNN` em `.agent/memory/rules/<cat>/R-NNN.md` + bump `RULES_INDEX.md`
- Decisões arquiteturais → `ADR-NNN` em `.agent/memory/decisions/<cat>/ADR-NNN.md` (status: accepted) + bump `DECISIONS_INDEX.md`
- Entrega significativa → append `journal/YYYY-WWW.jsonl`
- `state.json` — incrementar `journal_entries_since_distillation`; verificar counters batem com índices

**Anti**: AP-SQP-012 — sprint sem C5 pós-merge = débito técnico de memória. Knowledge base degrada sem disciplina.

### 13.2 Mocks frozen gate (anti CR1 Fase 1)
Antes de spawn pra implementação UI:
- [ ] Mocks da feature revisados pelo PO
- [ ] Mocks aprovados (PO confirma "ok seguir")
- [ ] Mocks documentados em path canônico (`MOCKS_APP_CRUD/export/<fase>/`)

Spec sem este check **NÃO** pode iniciar implementação. Mock novo durante sprint vira backlog (não commit no mesmo PR).

### 13.3 Branch sync antes de spawn (AP-169)
Antes de criar branch nova OU spawn que toca arquivos compartilhados:
```bash
rtk git fetch origin
rtk git status   # confirmar branch base = origin
# SE não: git pull (ou reset hard se necessário) antes de criar branch nova
```

### 13.4 DEVFLOW counter audit (anti D4 Fase 1)
Em todo distill (e idealmente a cada 5 PRs):
1. Scan `.agent/memory/<class>/<cat>/*.md` files
2. Cross-check com `<CLASS>_INDEX.md` entries
3. Reconciliar `state.json` counters com count real dos índices
4. Drift detectado = fix imediato (não "depois")

### 13.5 RETRO + C5 em mesmo PR (testado Fase 2.5)
PR único combinando RETRO (doc) + DEVFLOW C5 (memory) reduz overhead Gemini. Aplicável quando:
- Ambos escopos são docs/memory (não código funcional)
- Gemini precision OK em counts/refs (Fase 2.5 confirmou)

Se Gemini gera noise excessivo no PR misto, voltar pra PRs separados.

### 13.6 Spec viva — capture-as-you-go
EXEC_SPEC da fase em execução ganha §1 dedicada a "Cuidados aprendidos" durante a fase (não só no fim). Próxima sprint começa com guardrails explícitos.

---

## Changelog SQP

### v2.0 — 2026-05-18 (pós-RETRO Fase 1 + Fase 2)
- **§4 recalibrado**: cavecrew distribution explicitada (Opus/Sonnet/Haiku); SA-002 (no factory) removido — Sonnet validado; cap arquivos elevado (Sonnet 4, Haiku 2); SA-009/SA-010 adicionados (branch sync + audit barrel)
- **§4.2** brief R-230 (6 itens) formalizado
- **§9** transição inclui DEVFLOW C5 + counter audit + RETRO + factory location atualizada (`@dosiq/core/repositories`)
- **§10 NOVO**: Smoke PO pré-PR (R-234) — vinculante pra sprints UI
- **§11 NOVO**: Wave orchestration + dependency graph (R-237)
- **§12 NOVO**: 11 patterns canônicos web↔mobile (factory, helper @dosiq/core, hook canônico, cache matrix, sheet Android, decimal PT-BR, unidade(s), locale Zod, naming, vitest config, sweep retroativo)
- **§13 NOVO**: DEVFLOW integration — C5 obrigatório, mocks frozen gate, branch sync, counter audit, RETRO+C5 PR misto, spec viva
- **Novos anti-patterns**: AP-SQP-011 (PR sem smoke PO em UI), AP-SQP-012 (sprint sem C5)

### v1.0 — 14/05/2026 (criação inicial)
- §§1-9 (princípios, ciclo, gate, sub-agentes, validação, template, anti-patterns, escalação, transição)

---

> _"A qualidade nunca é acidental; é sempre o resultado de intenção inteligente, esforço sincero, direção competente e execução disciplinada."_ — William A. Foster
