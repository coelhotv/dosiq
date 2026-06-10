# EPIC: Modo Cuidador (Caregiver Mode) — Fase 7A

**Epic Directory**: `plans/specs/009-caregiver-mode`
**Created**: 2026-06-02 · **Tier**: 2 (épico multi-fase)
**Status**: specified — próximo grande épico do roadmap; NÃO implementado
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` (Fase 7A)
- `plans/backlog-unified_app_2026/DRAFT_CAREGIVER_MODE.md` (plano v1.2 — referência)

> **⚠️ Coordenação 012 (Diabetes T2 — 2026-06-10):** o épico 012 (Fase C) cria **`biomarkers_log`**
> (glicemia/peso/PA do paciente — dado sensível) com RLS `user_id=auth.uid()`. Quando este épico
> rodar, o modelo de permissões do Cuidador DEVE decidir explicitamente: cuidador **vê** medidas?
> **registra** medida pelo paciente (fast-logging por procuração — caso real: filha mede a glicemia
> da mãe)? RLS/policies de `biomarkers_log` precisam entrar na Fase 1 (Foundation RLS) junto com as
> demais tabelas. Persona T2 idoso é onde o cuidador mais aparece — não tratar como afterthought.

## Visão

Inverter a polaridade da saúde digital: a **carga cognitiva e a configuração iniciam no Cuidador** (filha, enfermeiro), reduzindo a barreira de letramento digital do **Paciente** (idoso). O paciente só visualiza e confirma doses. Conformidade LGPD total via consentimento explícito e revogação soberana.

O **Médico Observador** acompanha adesão em modo read-only, sem app, via dashboard web autenticado por token temporário.

---

## Princípio fundador — Owner = Paciente (D1)

> **O paciente é SEMPRE o owner dos próprios dados clínicos** (`user_id` = `auth.users.id` do paciente). O cuidador é um **operador avançado**: inputa dados, constrói agendas, facilita a gestão de entidades e dá suporte em situações críticas — **sempre via RLS**, nunca como dono.
>
> **Consequência arquitetural:** todas as entidades (`protocols`, `medicines`, `dose_instances`, `medicine_logs`, estoque) nascem sob o `user_id` do paciente desde o setup. A **revogação só deleta a linha de `caregiver_links`** — zero migração de ownership, zero re-apontamento de FK. O app do paciente volta a ser standalone instantaneamente porque os dados já eram dele.

Isto elimina toda a classe de bug de re-ownership transacional na revogação.

## Modelo de identidade & contexto (D3/D4 — ver phase-0)

> **Default = auto-gestão (M1):** o Dosiq continua, por padrão, um app de paciente auto-suficiente. O cold-start normal é o onboarding de sempre. **O modo cuidador é opt-in.** A escolha `[ Sou Paciente ]/[ Sou Cuidador ]` **não é a primeira tela** — só aparece no **contexto de convite** (deeplink/QR). Usuários normais nunca a veem.
>
> **Provisionamento upfront com conta anônima (M2):** o cuidador cria o paciente como **conta `auth.users` anônima (sem PII)**; as entidades nascem sob esse `user_id` desde a criação. O código/QR mapeia o device do paciente → essa conta; ao escanear+consentir, o paciente **reivindica** a conta — `uid` provisionado = `uid` final, **zero migração**. O paciente escolhe a autenticação depois (a seu critério). Contas não reivindicadas em X dias são descartadas (cron, sem PII).
>
> **Conta = pessoa · Contexto = self + managed (M3):** uma conta opera em contexto `self` (default) + N contextos `managed` (via `caregiver_links`). "Cuidador" é a relação + o contexto ativo, não um papel fixo da conta. Conta sem `managed` = app de auto-gestão idêntico ao atual. O seletor de contexto (phase-3) alterna "Eu / Minha mãe / …".

---

## Matriz de Recursos & Permissões (3 roles)

| Recurso | Paciente (owner) | Cuidador (`manager`) | Médico (`observer`) |
|---|---|---|---|
| Visualizar agenda | ✅ | ✅ (RLS) | ✅ (RLS, read-only) |
| Registrar dose | ✅ (check-in físico) | ✅ (remoto, `source='caregiver'`) | ❌ |
| Cadastrar/editar medicamentos | ❌ (desabilitado) | ✅ | ❌ |
| Ajustar estoque | ✅ | ✅ | ❌ |
| Dashboard adesão | ✅ (própria) | ✅ (paciente vinculado) | ✅ (read-only, real-time) |
| Receber alertas | — | ✅ (canal escolhido) | ❌ |
| **Revogar acesso** | ✅ (soberania LGPD) | ❌ | ❌ |
| Gerenciar N pacientes | ❌ | ✅ (multi-perfil, gated) | ✅ (dashboard) |

---

## Cadeia de Gates Produto/Negócio

Cada salto de complexidade exige tração medida antes do build. **Não construir adiante de demanda comprovada.**

| Gate | Métrica · Limiar · Fonte | Libera |
|---|---|---|
| **G0 — Demanda** (spec [002](../002-caregiver-demand-teaser/)) | `beta_signups feature='caregiver_mode'` **> 50** signups em 3 meses · logs Supabase | Build de 7A (phase-1 + phase-2) |
| **G1 — Adoção mono-paciente** | **> X cuidadores ativos com 1 paciente vinculado** (vínculo `manager` ativo + ≥1 dose `source='caregiver'`/semana) · `caregiver_links` + logs | phase-3 multi-perfil (dropdown N pacientes) |
| **G2 — Engajamento dashboard** | cuidadores que abrem dashboard ≥ 2×/semana · analytics | phase-4 engine de alertas (vale o custo de cron + R-090) |
| **G3 — Demanda clínica** | ≥ N pacientes geram token de observer · `caregiver_links role='observer'` | phase-5 observer dashboard completo |

> Limiares exatos (X, N) a calibrar pelo PO no fechamento de G0. Painted-door (002) é pré-requisito absoluto: < 50 signups → épico deprioritizado.

---

## Fases (ordem de execução por dependência)

Ordem de execução por dependência (o número da fase é rótulo; esta tabela é a verdade):

| # exec | Fase | Dir | Origem | Plataforma | Gate de entrada |
|---|---|---|---|---|---|
| 1 | **0 — Identity & Context Model** | [phase-0-identity-model](phase-0-identity-model/) | **NOVA** | core + mobile + infra | G0 |
| 2 | **1 — Foundation & RLS** | [phase-1-foundation-rls](phase-1-foundation-rls/) | spec 010 | DB + core | G0 |
| 3 | **2 — Setup Flow** | [phase-2-setup-flow](phase-2-setup-flow/) | spec 009 | Mobile + core | G0 |
| 4 | **6 — Patient Cared Mode + Sinais** | [phase-6-patient-cared-mode](phase-6-patient-cared-mode/) | **NOVA** | Mobile + core | G0 (contraparte do paciente) |
| 5 | **3 — Caregiver Dashboard** | [phase-3-caregiver-dashboard](phase-3-caregiver-dashboard/) | spec 011 | Mobile + Web + core | G1 (multi-perfil) |
| 6 | **4 — Alert Engine** | [phase-4-alert-engine](phase-4-alert-engine/) | **NOVA** | Backend (cron) + canais | G2 |
| 7 | **5 — Medical Observer** | [phase-5-observer](phase-5-observer/) | spec 012 | Web + core + DB | G3 |

> **phase-0 e phase-1 são fundação bloqueante** — modelo de identidade/contexto + tabelas/RLS/schemas Zod são pré-requisito de todas as demais.
>
> **Escopo de canais:** os canais de notificação e de envio do link de vínculo são abstratos — push, Telegram, e-mail, share nativo do SO. Integração com **WhatsApp Business (Meta)** está **fora do escopo deste épico** (entrega futura separada).

---

## Decisões transversais

- **D1 (owner=paciente):** ver Princípio fundador. Aplicado em todas as fases.
- **D2 (auth observer):** token temporário TTL 24–72h gerado pelo paciente OU cuidador, ou sessão autenticada — nunca rota pública sem credencial (phase-5).
- **Migrações:** sempre em `docs/migrations/` (CLAUDE.md), nunca `supabase/migrations/`. Template de GRANTs + RLS obrigatório após `CREATE TABLE`.
- **R-090:** engine de alertas (phase-4) e dashboards não podem estourar o budget de 12 funções serverless Vercel. Dimensionar em phase-4.

---

## Success Criteria do Épico

- **SC-E1:** Owner=paciente garantido — 100% das entidades sob `user_id` do paciente; revogação não migra dados, apenas deleta vínculo (verificável em phase-1/phase-2).
- **SC-E2:** Cada gate (G0–G3) tem métrica, limiar e fonte verificáveis antes de liberar a fase seguinte.
- **SC-E3:** Observer nunca acessa dados sem token/sessão válida e não-expirada (phase-5).
- **SC-E4:** Cuidador recebe alerta acionável de não-adesão dentro do SLA da phase-4 ("estou no trabalho e sou avisado que minha mãe não tomou nenhum remédio hoje").
