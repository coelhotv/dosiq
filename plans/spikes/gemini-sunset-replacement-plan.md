# Plano de Substituição do Gemini Code Assist (sunset ~07/2026)

**Projeto**: Dosiq
**Tipo**: plano de execução prescritivo
**Data**: 2026-06-15
**Status**: arquitetura aprovada pelo PO · L2/RC6 já implementado no devflow · L0/L1 pendentes

> **Para o agente que vai executar isto:** este documento é auto-contido. Não precisa de
> contexto externo além do repo. Leia §1 (o que muda) → §2 (arquitetura) → §3 (estado atual)
> → §4 (execute as fases na ordem). Cada fase tem deliverables concretos, caminhos de arquivo
> e critérios de aceite. Trabalhe sob R-221 SQP e DEVFLOW (bootstrap antes de codar).

---

## 1. Contexto — o que sai, o que fica

**O que é descontinuado:** o `gemini-code-assist[bot]` do Google — o *gerador* das reviews dos PRs.

**O que NÃO é o bot (e fica órfão, mas reutilizável):** o workflow [`.github/workflows/gemini-review.yml`](../.github/workflows/gemini-review.yml) (~34KB) **não gera** review — ele apenas *faz parsing* dos comentários que o bot posta e estrutura a saída para os agentes coders. No sunset, o gerador some; este pipeline de ingestão fica sem fonte, mas **é reaproveitável** trocando-se o `GEMINI_BOT_LOGIN`.

**O que o Gemini entregava (e qualquer substituto tem que preservar):**

| Propriedade | Por que importa |
|---|---|
| **Independência** — não é o agente que escreveu o código | Segundo par de olhos pega o ponto cego do autor |
| **Vive no PR** — comentários inline | O aprovador humano (R-060) vê; vira registro auditável |
| **Assíncrono / não-bloqueante** | Não trava o loop de dev |
| **Robustez adversarial** — NULL / div-0 / dose→0 / bypass de service | Foi o gap revelado no review #650 |

**Decisão de processo registrada** (memória `project_review_gate_post_gemini`): o gate vira **disciplina de processo** (R-270 preflight + R-271 CHECK). Este plano **adota isso como piso** (camadas L0/L1) e adiciona um revisor IA independente **opcional** (L2/RC6) que custa **$0 marginal** — projetado para evitar exatamente o que motivou a recusa de revisores IA antes (falta de independência, ruído, custo).

---

## 2. Arquitetura — defesa em 4 camadas (barato → caro)

Princípio-mestre: **não usar LLM para o que um linter resolve.** Determinístico é mais barato, mais rápido e não alucina. LLM só onde exige julgamento (arquitetura, contrato, robustez adversarial).

```
┌─ L0  Piso determinístico ────────── local, pré-commit, custo zero
│      ESLint custom rules + rtk lint, rodado por C4 (Quality Gates)
│      → pega R-NNN mecanizáveis: cor hardcoded, enum pt-BR, res.json(),
│        import relativo onde há alias, new Date('YYYY-MM-DD')
│
├─ L1  Self-check do coder ────────── local, antes de abrir o PR
│      RC5 / `/devflow code-review` (checklist Pass 1 CRITICAL + Fix-First)
│      → o autor revê o próprio diff e auto-corrige (legítimo: é self-check)
│
├─ L2  Revisor IA independente ───── local headless (OAuth $0), posta no PR
│      RC6 / `/devflow ai-review` — processo FRESCO, sem o contexto do coder
│      agy (primário) / claude -p (fallback), flag-only, posta via `gh api`
│      + ai-review-gate.yml (CI sem LLM) audita presença do comentário
│
└─ L3  Gate humano (R-060) ───────── inalterado: humano lê e faz o merge
```

**Por que L2 é local e não CI com API:** `claude -p` / `agy` headless usam a **quota OAuth do plano semanal já assinado** → custo marginal **$0** (sem API key metered, sem crédito de CI). Independência **não** exige máquina remota — vem de **processo separado + contexto fresco**, alcançável local. O único ganho real do CI (enforcement não-bypassável) é recuperado pelo `ai-review-gate.yml`, um job de CI minúsculo **sem LLM** que só audita se o comentário do RC6 existe.

**Engine:** `agy` (Gemini 3.1) primário (quota semanal maior, absorve rotina); `claude -p` (Opus 4.8/Sonnet 4.6) fallback/escalação (raciocínio mais confiável, PR arquitetural). **Sem Ollama** — determinismo é trabalho do L0.

**`/code-review ultra` fora da rotina:** ~US$20/PR (≈ R$120) é insustentável como gate recorrente. Reservado para escalação manual rara (PR grande/arriscado).

---

## 3. Estado atual (o que já existe vs. pendente)

| Item | Onde | Estado |
|---|---|---|
| **RC6 — `/devflow ai-review`** (L2) | `SKILL.md` do devflow, modo Reviewing | ✅ **especificado** (processo fresco, agy/claude, flag-only, `gh api`, state/events) |
| **RC5 — `/devflow code-review`** (L1) | `SKILL.md` do devflow | ✅ existe — checklist com exemplos Rails/Prisma (a adaptar) |
| **CI lint+test** | [`.github/workflows/test.yml`](../.github/workflows/test.yml) | ✅ roda em PR (`paths-ignore` para docs/.agent/md) |
| **Pipeline de ingestão de comentários** | `.github/workflows/gemini-review.yml` | ⚠️ órfão no sunset — reaproveitar (trocar `GEMINI_BOT_LOGIN`) |
| **ESLint custom rules** (L0) | `apps/web` eslint config | ❌ a criar (Fase A) |
| **Adaptação do checklist RC5 à stack** (L1) | `SKILL.md` | ❌ a fazer (Fase B) |
| **Script `rtk ai-review`** (L2) | `scripts/` | ❌ a criar (Fase C) |
| **`ai-review-gate.yml`** (L2 enforcement) | `.github/workflows/` | ❌ a criar (Fase C) |

---

## 4. Plano de execução (fases na ordem; cada uma entrega valor isolado)

### Fase A — L0: ESLint custom rules (semana 1, maior ROI)

**Objetivo:** barrar deterministicamente os R-NNN mecanizáveis no lint que o C4 já roda. Zero LLM.

**Deliverables:**
1. Adicionar regras `no-restricted-syntax` / `no-restricted-properties` (ou plugin local) ao eslint config de `apps/web`. Cobrir no mínimo:

   | Regra | Detecção | Mensagem |
   |---|---|---|
   | R-020 (paleta) | literal de cor (`#RRGGBB`, `'red'`, `rgb(...)`) em `style`/JSX | "Use design-token, não cor literal" |
   | enum pt-BR | string de enum fora do conjunto pt-BR (`'daily'`, `'weekly'`…) | "Enums em português (R-Schemas)" |
   | Vercel R-090 | `res.json(` sem `res.status(` no mesmo escopo em `api/` | "Sempre `res.status(code).json(body)`" |
   | alias | import relativo longo (`../../../`) onde existe alias | "Use alias (@features/@shared/…)" |
   | timezone | `new Date('` com string `YYYY-MM-DD` literal | "Use `parseLocalDate()` de @utils/dateUtils" |

2. Garantir que `rtk lint` (e portanto `validate:agent` via C4) falhe nessas violações.

**Critério de aceite (Fase A):**
- PR com `style={{ color: '#FF0000' }}` → `rtk lint` falha em <1s, sem LLM, citando a regra.
- `rtk npm run validate:agent` continua verde no código limpo atual (sem falso-positivo).

**SQP:** impacto = no-user-impact (tooling), sem bump de versão; changelog em `[Unreleased]` seção tooling.

---

### Fase B — L1: adaptar o checklist RC5 à stack do projeto (semana 1-2)

**Objetivo:** o RC5 (`/devflow code-review`) hoje traz exemplos Rails/Prisma. Adaptar à stack real para o self-check do coder ter tração.

**Deliverables (editar `SKILL.md`, seção R1 / RC5 Pass 1):**
- Trocar exemplos Rails/Prisma por equivalentes da stack:
  - SQL safety → bypass do service de doses (insert direto em `medicine_logs` em vez de `doseService`); FIFO de estoque; ordem "Validar → Registrar → Decrementar estoque".
  - Zod → `.nullable().optional()` (nunca só `.optional()`); enums pt-BR; sincronia com CHECK SQL.
  - Vercel → `res.status().json()`; sem `process.exit()`; env fallback `process.env.X || process.env.VITE_X`.
  - Datas → `parseLocalDate()`.
- Manter Fix-First Protocol (AUTO-FIX vs ASK) e o formato de output do RC5.
- Reforçar: rodar R-270 preflight ANTES de codar mudança de DB/RPC/schema.

**Critério de aceite (Fase B):** rodar `/devflow code-review` num diff de teste com bypass de service → RC5 sinaliza, classifica e (se mecânico) auto-corrige.

---

### Fase C — L2: ligar o RC6 (script + enforcement) (semana 2-3)

O **RC6 já está especificado** no `SKILL.md`. Falta a infraestrutura executável.

**Deliverable C.1 — `scripts/ai-review.sh` (ou `.mjs`), exposto como `rtk ai-review <PR#>`:**
```
1. diff   = git diff $(git merge-base HEAD main)...HEAD  filtrado p/ .js/.jsx/.ts/.tsx
2. ctx    = CLAUDE.md + .agent/memory/RULES_INDEX.md + .agent/memory/ANTI_PATTERNS_INDEX.md
            (+ detail files dos R-NNN/AP-NNN que casam com o escopo do diff)
3. prompt = checklist "Pass 1 CRITICAL" do RC5 (verbatim)
            + "Você é auditor INDEPENDENTE; não escreveu este código; audite só contra o
               catálogo + checklist; não invente regras; saída JSON estrita."
4. engine = agy -p   (fallback: claude -p)   — processo FRESCO, sem contexto do coder
5. publish= parse JSON → comentários inline no PR via `gh api`
            (reusar pipeline do gemini-review.yml com GEMINI_BOT_LOGIN trocado)
6. state  = gravar em .agent/state.json {ai_review:{engine,status,critical,high,pr}}
            + append events.jsonl {event:"ai_review_complete",...}
7. fail-open: agy+claude indisponíveis/quota esgotada → "⚠️ AI review indisponível —
              revisão humana obrigatória", exit 0 (nunca trava merge)
```
- **Sem auto-fix.** RC6 só sinaliza. O coder corrige depois (ciclo RC5/`check-review`) e re-roda `rtk ai-review`.

**Deliverable C.2 — `.github/workflows/ai-review-gate.yml` (CI, SEM LLM):**
```
trigger: pull_request [opened, synchronize]  (paths-filter igual ao test.yml)
job:     via `gh api`, verificar se existe comentário do AI-reviewer no PR.
         ausente → check falha (bloqueia merge) com instrução "rode `rtk ai-review <PR#>`"
         presente → check passa.
custo:   ~zero (sem LLM, só chamada de API ao GitHub).
```

**Critério de aceite (Fase C):**
1. PR com `supabase.from('medicine_logs').update()` dentro de componente UI → `rtk ai-review` comenta **Critical** inline citando bypass do service / FIFO. Push **não** bloqueia; merge bloqueia pelo gate humano + `ai-review-gate.yml`.
2. Coder corrige, re-roda `rtk ai-review` no diff novo → comentário resolve; CI gate vê comentário → libera.
3. `agy` indisponível → fail-open com aviso; merge não trava permanentemente.

---

### Fase D — validação e decisão do PO

- Rodar L0+L1+L2 em **~5 PRs reais**. Medir: % de comentários acionáveis vs. ruído (RC6) + **consumo de quota OAuth**.
- PO decide: manter RC6 na rotina, ajustar severidade, ou ficar só com L0+L1 + `/code-review ultra` manual em PR grande (resultado legítimo).

**Mitigação de timing:** L0+L1 não dependem de serviço externo e cobrem o piso **antes** do sunset. Se a Fase C atrasar ou o PO recusar L2, o projeto **não fica descoberto**.

---

## 5. Riscos

- **Quota OAuth finita** — review pesado consome a quota semanal de dev. Mitiga: RC6 só em PR-open (não a cada push), diff-scoped. Monitorar na Fase D.
- **Enforcement depende de processo** — RC6 local pode ser pulado; `ai-review-gate.yml` recupera enforcement auditando presença do comentário, sem custo de LLM.
- **Qualidade do `agy`** — Gemini 3.1 como primário tem quota maior mas raciocínio menos confiável que Claude; usar `claude -p` como fallback/escalação em PR arquitetural.
- **Falso-positivo no L0** — regras ESLint mal-calibradas quebram o lint do código existente; validar contra a base atual na Fase A.

---

## 6. Mapa rápido (referências do repo)

- Workflow CI atual: `.github/workflows/test.yml`
- Pipeline a reaproveitar: `.github/workflows/gemini-review.yml` (trocar `GEMINI_BOT_LOGIN`)
- RC5/RC6: `SKILL.md` do devflow (modo Reviewing)
- Catálogos para o contexto do RC6: `.agent/memory/RULES_INDEX.md`, `.agent/memory/ANTI_PATTERNS_INDEX.md`
- Skill que ingere comentários de PR: `check-review`
- Regras-âncora: R-221 (SQP), R-270/R-271 (preflight/CHECK), R-060 (humano faz merge), R-090 (Vercel)
