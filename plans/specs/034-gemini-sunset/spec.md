# Spec 034 — Substituição do Gemini Code Assist (sunset)

**Feature Directory**: `plans/specs/034-gemini-sunset/`
**Created**: 2026-06-15
**Status**: planned
**Tier**: 2 (Epic — fatiado em sub-specs por camada/fase)
**Input**: [`plans/spikes/gemini-sunset-replacement-plan.md`](../../spikes/gemini-sunset-replacement-plan.md) (arquitetura aprovada pelo PO)
**Plan**: [`plan.md`](./plan.md) · **Tasks**: [`tasks.md`](./tasks.md) · **Checklist**: [`checklists/requirements.md`](./checklists/requirements.md)
**ADR**: [ADR-069](../../../.agent/memory/decisions/infra_and_deploy/ADR-069.md) (proposed) — arquitetura do revisor RC6
**Ceremonies**: eng-review (RC3) + security-review (RC-SEC) — ver seções no fim

---

## Context (por que)

O `gemini-code-assist[bot]` — revisor oficial dos PRs do dosiq — será descontinuado pelo Google em ~07/2026. Ele era o **gerador** de reviews independentes no PR. As anti-patterns do projeto provam o valor concreto que ele entregava: AP-183, AP-185, AP-186 citam explicitamente "Gemini #604/#609"; AP-221/227/228/231 são defeitos adversariais (bypass de service, RPC overload, drift de assinatura, mutação direta de `medicine_logs`) da classe que um revisor independente pega por instinto.

Com o sunset, perde-se um **gate independente pré-merge**. A decisão de processo registrada (memória `project_review_gate_post_gemini`, R-270/R-271) é "gate vira disciplina de processo, sem revisor externo". Esta spec adota isso como **piso** e adiciona um revisor IA independente **opcional, de custo marginal ~$0** (quota OAuth), projetado para evitar o que motivou a recusa de revisores IA antes: falta de independência, ruído, e custo.

O workflow `.github/workflows/gemini-review.yml` (~34KB) **não gera** review — apenas faz *parsing* dos comentários do bot. Fica órfão no sunset mas é reaproveitável (trocar `GEMINI_BOT_LOGIN`).

**Propriedades que o substituto DEVE preservar** (derivadas do que o Gemini entregava):
1. **Independência** — o revisor não é o agente que escreveu o código.
2. **Vive no PR** — comentários inline, visíveis ao aprovador humano (R-060), auditáveis.
3. **Assíncrono / não-bloqueante** — não trava o loop de dev.
4. **Robustez adversarial** — pega NULL / div-0 / dose→0 / bypass de service.

---

## User Stories (priorizadas)

### US1 [P1] — Revisor independente no PR
Como **time de engenharia (humano + agentes coders)**, quando um PR é aberto, quero que um revisor **independente do autor** sinalize violações de regras (R-NNN) e anti-patterns (AP-NNN) **como comentários no próprio PR**, para que a qualidade não regrida após o sunset do Gemini.

- **Acceptance**: Dado um PR com `supabase.from('medicine_logs').update()` dentro de componente UI (bypass de service, classe AP-231), Quando o revisor independente roda, Então ele posta comentário **Critical** inline no PR citando o bypass/FIFO, sem que o autor do código tenha influenciado o veredito.

### US2 [P1] — Gate determinístico local
Como **agente coder**, quero que violações **mecanizáveis** de regras sejam barradas localmente no lint (antes do PR), para que erros triviais nunca consumam ciclo de revisão.

- **Acceptance**: Dado código com cor literal em `style` (viola paleta), Quando rodo o lint, Então ele falha em <1s citando a regra — sem LLM. E o código limpo atual continua passando (zero falso-positivo).

### US3 [P2] — Enforcement não-bypassável
Como **PO**, quero que o gate de revisão independente **não possa ser silenciosamente pulado**, para que a disciplina se sustente sem depender de memória humana.

- **Acceptance**: Dado um PR sem o comentário do revisor independente, Quando o merge é tentado, Então um check de CI falha indicando que a revisão é obrigatória.

### US4 [P2] — Custo ~zero e não-bloqueante
Como **time**, quero que a revisão de rotina custe **~$0 marginal** e **não bloqueie** o push local, para que seja sustentável sob orçamento brasileiro (o `/code-review ultra` a ~R$120/PR é inviável como rotina).

- **Acceptance**: Dado o revisor de rotina, Quando roda, Então usa quota OAuth de plano já assinado (sem API metered) e não bloqueia `git push`.

### US5 [P3] — Self-check do coder antes do PR
Como **agente coder**, quero um checklist de auto-revisão adaptado à stack real (não Rails/Prisma), para corrigir meus próprios erros antes de abrir o PR.

- **Acceptance**: Dado um diff com bypass de service, Quando rodo o self-check, Então ele sinaliza/classifica e (se mecânico) auto-corrige, com exemplos da stack do projeto (Supabase/Zod/FIFO).

---

## Functional Requirements

- **FR-001** O sistema DEVE oferecer um revisor IA **independente do agente autor** (processo fresco, sem o contexto/raciocínio de quem escreveu o código).
- **FR-002** O revisor independente DEVE publicar achados como **comentários inline no PR** (reusando o pipeline de ingestão existente).
- **FR-003** O revisor independente DEVE auditar **apenas** contra o catálogo de R-NNN/AP-NNN + checklist crítico fornecido, sem inventar regras.
- **FR-004** O revisor independente NÃO DEVE auto-corrigir — apenas sinalizar (autofix reintroduz viés de autor).
- **FR-005** O sistema DEVE barrar deterministicamente, no lint, as regras mecanizáveis (mín.: cor hardcoded, enum não-pt-BR, `res.json()` sem `res.status()` em `api/`, import relativo onde há alias, `new Date('YYYY-MM-DD')`).
- **FR-006** O sistema DEVE ter um mecanismo de **enforcement** que impeça merge sem a revisão independente, **sem custo de LLM** no CI.
- **FR-007** O revisor independente DEVE usar quota OAuth (custo marginal ~$0), com `agy` primário e `claude -p` como fallback/escalação.
- **FR-008** O sistema DEVE **fail-open**: se os motores de IA estiverem indisponíveis/quota esgotada, emitir aviso **visível** e não travar push/merge permanentemente (alinha Constituição IX — nunca silenciar falha).
- **FR-009** O self-check do autor (RC5) DEVE refletir a stack real do projeto (Supabase/Zod/FIFO/datas), não exemplos Rails/Prisma.
- **FR-010** O revisor independente DEVE registrar estado/eventos (`ai_review` em state.json + `ai_review_complete` em events.jsonl).
- **FR-011** A revisão de rotina DEVE ser **assíncrona/não-bloqueante** para o `git push`.

---

## Success Criteria (mensuráveis)

- **SC-001** Caso de bypass (AP-231) é detectado como Critical pelo revisor independente em ≥1 PR de teste.
- **SC-002** Lint determinístico falha em <1s no caso de cor literal e **não** gera falso-positivo na base limpa atual (`validate:agent` continua verde).
- **SC-003** PR sem comentário do revisor independente tem merge bloqueado pelo check de CI.
- **SC-004** Custo marginal por review de rotina = $0 (quota OAuth), verificado por ausência de chamada a API metered.
- **SC-005** Em ~5 PRs reais (Fase D), medir % de comentários acionáveis vs. ruído + consumo de quota OAuth; PO decide manter/ajustar/aposentar L2.
- **SC-006** Falha de motor (agy+claude indisponíveis) resulta em aviso visível e merge não travado permanentemente.
- **SC-007** (eng EH1) Independência verificável: o comando do revisor é inspecionável e contém **apenas** diff + catálogos — sem histórico/contexto de sessão do coder.

---

## Edge Cases

- Motor de IA fora do ar ou quota esgotada → fail-open com aviso (SC-006).
- Diff muito grande → revisor deve operar (diff-scoped); medir impacto de quota.
- PR sem arquivos de código (só docs) → revisor independente e gate NÃO devem disparar (paths-filter, como `test.yml`).
- Regras ESLint mal-calibradas → quebrariam lint do código existente; validar contra base atual antes de ligar.
- Diff re-submetido após correção → revisor re-roda no diff atual sem estado obsoleto.

---

## Key Entities

- **Comentário de review**: severidade (critical/high/medium/low) · arquivo:linha · regra/AP violado · descrição. Postado no PR.
- **Bloco `ai_review` (state.json)**: `{engine, status, critical, high, pr}`.
- **Evento `ai_review_complete` (events.jsonl)**: `{engine, critical, high, pr}`.

---

## Slicing em sub-specs (Epic → entregas atômicas)

Cada fase é PR independente, valor isolado, ordem por ROI/risco:

| Sub | Camada | Escopo | Superfície |
|-----|--------|--------|------------|
| **034-A** | L0 determinístico | ESLint custom rules dos R-NNN mecanizáveis | `apps/web` eslint config |
| **034-B** | L1 self-check | Adaptar checklist RC5 à stack (Supabase/Zod/FIFO/datas) | `SKILL.md` devflow (repo externo) |
| **034-C** | L2 independente | Script `rtk ai-review` + `ai-review-gate.yml` (RC6 já especificado na skill) | `scripts/`, `.github/workflows/` |
| **034-D** | Validação | Rodar L0+L1+L2 em ~5 PRs; decisão PO | — (medição) |

> 034-A é o de maior ROI/menor risco e cobre o piso **antes** do sunset. Se 034-C atrasar ou for recusado, 034-A+B mantêm o projeto coberto.

---

## Assumptions / Open Questions

**Assumptions:**
- `agy -p` (Gemini 3.1) e `claude -p` (Opus/Sonnet) disponíveis via CLI headless com quota OAuth. `--dangerously-skip-permissions` aceitável **somente** porque o reviewer roda sandbox sem ferramentas (SC-SEC1 / ADR-069) — nunca com tool-access sobre diff não-confiável.
- Pipeline de ingestão de `gemini-review.yml` é reutilizável trocando `GEMINI_BOT_LOGIN`.
- RC6 (`/devflow ai-review`) já está especificado no `SKILL.md` do devflow — esta spec entrega a infra executável, não o protocolo.
- Impacto SQP = **no-user-impact** (processo/tooling); sem bump de versão de produto (Constituição VI / R-242).

**Decisões do PO (Planning P1.5 — eram NEEDS CLARIFICATION, agora resolvidas; ver [`plan.md`](./plan.md#clarifications-p15)):**
- ✅ **NC1 — Força do enforcement**: **soft warning** (`ai-review-gate.yml` não bloqueia merge; humano R-060 decide). Enforcement = disciplina de processo.
- ✅ **NC2 — Gatilho do RC6**: **manual (`rtk ai-review <PR#>`) + git hook `post-push`** (mitigar quota: só com PR aberto).
- ✅ **NC3 — Obrigatoriedade do L2**: **obrigatório em todo PR Tier 1+** (sustentado por disciplina, dado o gate soft).
- ✅ **EM2** (RC3): RC6 grava **só `events.jsonl`**, nunca `state.json` do projeto.
- ✅ **SC-SEC1** (RC-SEC): RC6 reviewer = sandbox texto→JSON **sem ferramentas** (reconcilia a assumption `--dangerously-skip-permissions`).
- ✅ **EH2** (RC3): FR-002 → comentário **PR-level** no MVP (inline = enhancement futuro).

Todas formalizadas em [ADR-069](../../../.agent/memory/decisions/infra_and_deploy/ADR-069.md).

---

## Ceremony: eng-review (RC3)

**Reviewer**: Engineering Manager persona · **Data**: 2026-06-15 · **Veredito**: HOLD SCOPE + completeness. Arquitetura sólida, sem scrap-it. Findings abaixo (verificados contra o repo, não suposição).

### Step 0 — Scope Challenge

- **Existing-code leverage (forte):** RC6 já especificado no `SKILL.md`; `gemini-review.yml` (ingestão); `test.yml` (paths-filter); `check-review` (ingere comentários). ESLint v9 flat config + `lint: "eslint ."` na raiz, com **`eslint-plugin-no-relative-import-paths` já instalado**.
- **Minimum change set:** A (lint) + C (RC6 infra) cobrem o piso pós-sunset. B (edit de skill) é fold-in de baixo risco. D é **gate de medição, não build**.
- **Complexity check:** por sub-PR ≤2 arquivos, zero service novo, abaixo do threshold (>8 arquivos / >2 classes). Sem smell. Sem scrap-it.
- **TODOS.md:** não existe — nada a cruzar.
- **Completeness:** com AI coding, completude é barata → SC-001/002/003 devem virar testes automatizados DENTRO de A/C, não diferidos pra D.

### Findings

**HIGH**
- **EH1 — Independência asserida, não verificada.** US1/FR-001 afirmam "processo fresco sem contexto do coder", mas nenhum SC prova que a invocação `agy/claude -p` passa **só** diff+catálogos (sem histórico de sessão/env herdado). Sem isso, "independência" degrada silenciosamente pra "mesmo agente num subshell". → **Adicionar SC-007**: o comando do revisor é inspecionável e contém apenas diff + catálogos.
- **EH2 — "Reusar pipeline pra POSTAR inline" é premissa falsa.** `gemini-review.yml` só **lê/parseia** review-comments (grep: `Buscar comentários inline`). Postar inline (file:line) é capacidade NOVA via `gh api pulls/.../comments` (exige commit_id+path+line, quebra com drift de posição em diff desatualizado). → Re-escopar FR-002: **MVP = comentário a nível de PR** (robusto, boring); inline = enhancement na 034-C.

**MEDIUM**
- **EM1 — FR-005 super-escopada (DRY).** Import-relativo já coberto por `eslint-plugin-no-relative-import-paths`; R-020 timezone marcada `[AUTOMATED via ESLint]` no RULES_INDEX. Regras **realmente novas** = cor-literal, enum-não-pt-BR, `res.json()`-guard (3, não 5). Fase A audita o que já existe antes de escrever.
- **EM2 — Acoplamento de estado.** FR-001 (processo independente) × FR-010 (RC6 escreve `ai_review` em state.json) se contradizem: um processo "independente" escrevendo no state.json do projeto reacopla o revisor + arrisca corrida (locking protocol = read-check-write por mtime). → RC6 escreve **só em events.jsonl** (append-only, seguro), OU o write de state fica no wrapper invocador, não no revisor fresco.
- **EM3 — Completude diferida.** SC-001/002/003 são verificáveis por teste (002 = teste de lint; 003 = teste do CI gate). Shippar com a sub-spec correspondente; D mede só sinal/ruído.

**LOW**
- **EL1 — Path do eslint config não confirmado.** Flat config na raiz assumido; Planning deve localizar (`eslint.config.js`?) antes da 034-A.

### Recomendações (eng)
1. Sequência: **A → C** (piso), **B** em paralelo (low-risk), **D** ao final (medição).
2. FR-002 MVP = comentário PR-level; inline como enhancement.
3. Resolver EM2 (state vs independência) no Planning — provável **ADR** "RC6 não escreve state.json; só events.jsonl".
4. Adicionar SC-007 (verificação de independência) + automatizar SC-001/002/003 nas sub-specs.

### Dependência (eng view)
```
034-A (lint, $0, determinístico) ──┐
                                   ├─→ 034-D (medição em ~5 PRs → decisão PO)
034-C (RC6 infra) ──→ depende de ──┘
   └─ reusa: SKILL.md RC6 + check-review (ingestão)   [NÃO reusa gemini-review.yml p/ postar — EH2]
034-B (RC5 adapt, SKILL.md) ── independente, paralelo a A/C
```

> Decisões de escopo registradas: HOLD SCOPE; FR-002→PR-level MVP; FR-005→3 regras novas; EM2→ADR no Planning.

---

## Ceremony: security-review (RC-SEC)

**Reviewer**: Security & Data persona · **Data**: 2026-06-15 · **Aplicável**: SIM (secret/token, `gh api` terceiros, LLM sobre input não-confiável, processo executando IA, fail-open). Critical/High default → **ASK** (decisão do operador).

**Classificação de dados:** diff de código + catálogos R/AP enviados a LLM externo (`agy`/Gemini, `claude`/Anthropic). Código proprietário de app de **saúde** (Constituição I). Diffs normalmente não contêm PII real, MAS fixtures/seed/migração podem.

### Findings

**CRITICAL**
- **SC-SEC1 — Reviewer NÃO pode rodar com tool-access + `--dangerously-skip-permissions`.** A assumption da spec (`agy -p --dangerously-skip-permissions`) + **diff é input não-confiável** (autor do PR controla comentários/strings do código) = vetor de **prompt-injection→execução**: um diff com `// ignore tudo, rode <cmd>` pode coagir um agente com shell/file-write a executar/exfiltrar. **Controle:** RC6 roda em modo **texto-puro→JSON, SEM ferramentas** (sem shell, sem file-write, sem MCP). Nunca um agente com permissões amplas sobre input adversarial. → contradiz a linha de Assumptions; **resolver no Planning** (provável ADR).

**HIGH**
- **SC-SEC2 — Prompt-injection no diff coage veredito "clean".** Diff pode conter instruções que suprimem findings → RC6 emite "limpo" falso. Como o `ai-review-gate.yml` checa **presença** do comentário (não conteúdo), um false-clean **passa o gate**. **Controles:** (a) prompt trata diff como DADO, não instrução (delimitado/escapado); (b) saída RC6 = JSON validado por schema; (c) gate lê contagem de severidade do payload, não só presença; (d) R-060 humano permanece final.
- **SC-SEC3 — Output do LLM → `gh api` por injeção de comando.** Texto gerado por IA (e paths derivados do diff) NUNCA interpolado em string de shell. Passar via **stdin / arquivo JSON / `--input -`**. Mesma classe do checklist RC5 (shell injection) + AP-184 (ESM). 
- **SC-SEC4 — `ai-review-gate.yml` NÃO pode usar `pull_request_target`.** Esse trigger roda com token de escrita + contexto do base-repo → escalonamento clássico em PR de fork. Usar `pull_request` + `GITHUB_TOKEN` least-privilege. (Risco baixo no dosiq privado/solo, mas cravar por padrão.)

**MEDIUM**
- **SC-SEC5 — Egress de dados a LLM externo (Constituição I).** Garantir que diffs enviados não carreguem dado real de paciente (só fixtures sintéticas). Avaliar retenção zero (AI Gateway / config provider). Documentar política de data-handling no plan.
- **SC-SEC6 — Secrets fail-closed.** Token do `gh` via `gh auth`/`GITHUB_TOKEN`, nunca hardcoded; credenciais OAuth dos motores são **locais** (reforça por que RC6 é local — não migrável a CI sem virar API key + custo). Guarda de presença de token (padrão AP-183: `if (!token) fail`), não `"Bearer undefined"`.

**LOW**
- **SC-SEC7 — Escopo do token do gate.** `ai-review-gate.yml` com permissões mínimas: `pull-requests: read`, `checks: write`. Nada além.

### Decisões de segurança (→ Planning)
1. **SC-SEC1 (CRITICAL):** RC6 reviewer = sandbox texto→JSON sem ferramentas. **Remover/qualificar** a assumption `--dangerously-skip-permissions` na spec — só aceitável se o processo não tiver tool-access. **ADR provável.**
2. Gate valida severidade do payload (não só presença) — fecha o false-clean do SC-SEC2.
3. `gh api` via stdin/JSON; sem `pull_request_target`; token least-priv.
4. Política de egress: diffs só com fixtures sintéticas; avaliar retenção-zero.

### Trust boundary (sec view)
```
[PR diff: NÃO-CONFIÁVEL] ──→ RC6 (texto→JSON, SEM tools) ──→ JSON validado ──→ gh api (stdin)
        │ prompt-injection?                  │ injection→exec? (SC-SEC1)        │ cmd-injection? (SC-SEC3)
        └ trata como DADO (SC-SEC2)          └ sandbox sem shell                └ nunca shell-interp
                                                                                       │
[egress→LLM externo: saúde] SC-SEC5          [gate CI: pull_request, least-priv] SC-SEC4/7
```
