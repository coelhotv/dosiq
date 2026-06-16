# Spec 034 — Substituição do Gemini Code Assist (sunset)

**Feature Directory**: `plans/specs/034-gemini-sunset/`
**Created**: 2026-06-15
**Status**: specified
**Tier**: 2 (Epic — fatiado em sub-specs por camada/fase)
**Input**: `plans/spikes/gemini-sunset-replacement-plan.md` (arquitetura aprovada pelo PO)

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
- `agy -p` (Gemini 3.1) e `claude -p` (Opus/Sonnet) disponíveis via CLI headless com quota OAuth (modo ideal para `agy -p` é `--dangerously-skip-permissions`).
- Pipeline de ingestão de `gemini-review.yml` é reutilizável trocando `GEMINI_BOT_LOGIN`.
- RC6 (`/devflow ai-review`) já está especificado no `SKILL.md` do devflow — esta spec entrega a infra executável, não o protocolo.
- Impacto SQP = **no-user-impact** (processo/tooling); sem bump de versão de produto (Constituição VI / R-242).

**Open Questions (resolver no Planning):**
- `[NEEDS CLARIFICATION: força do enforcement — o `ai-review-gate.yml` deve ser um required check que BLOQUEIA o merge, ou uma anotação soft não-bloqueante que apenas avisa?]` (afeta UX do gate + se é de fato não-bypassável).
- `[NEEDS CLARIFICATION: gatilho do RC6 — apenas manual via `rtk ai-review <PR#>`, ou também automático via git hook `post-push`?]` (afeta consumo de quota OAuth e fricção do fluxo).
- `[NEEDS CLARIFICATION: escopo de obrigatoriedade do L2 — RC6 obrigatório em todo PR Tier 1+, ou opt-in por PR?]` (afeta quota e o critério de enforcement do FR-006).
