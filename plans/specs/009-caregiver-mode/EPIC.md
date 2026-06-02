# EPIC: Modo Cuidador (Caregiver Mode) — Fase 7A

**Epic Directory**: `plans/specs/009-caregiver-mode`
**Created**: 2026-06-02 · **Tier**: 2 (épico multi-fase)
**Status**: Dev Ready (por fase — ver cadeia de gates)
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` (Fase 7A)
- `plans/backlog-unified_app_2026/DRAFT_CAREGIVER_MODE.md` (plano v1.2 — referência)

---

## Visão

Inverter a polaridade da saúde digital: a **carga cognitiva e a configuração iniciam no Cuidador** (filha, enfermeiro), reduzindo a barreira de letramento digital do **Paciente** (idoso). O paciente só visualiza e confirma doses. Conformidade LGPD total via consentimento explícito e revogação soberana.

O **Médico Observador** acompanha adesão em modo read-only, sem app, via dashboard web autenticado por token temporário.

---

## Princípio fundador — Owner = Paciente (D1)

> **O paciente é SEMPRE o owner dos próprios dados clínicos** (`user_id` = `auth.users.id` do paciente). O cuidador é um **operador avançado**: inputa dados, constrói agendas, facilita a gestão de entidades e dá suporte em situações críticas — **sempre via RLS**, nunca como dono.
>
> **Consequência arquitetural:** todas as entidades (`protocols`, `medicines`, `dose_instances`, `medicine_logs`, estoque) nascem sob o `user_id` do paciente desde o setup. A **revogação só deleta a linha de `caregiver_links`** — zero migração de ownership, zero re-apontamento de FK. O app do paciente volta a ser standalone instantaneamente porque os dados já eram dele.

Isto elimina toda a classe de bug de re-ownership transacional na revogação.

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

| Fase | Dir | Origem | Plataforma | Gate de entrada |
|---|---|---|---|---|
| **1 — Foundation & RLS** | [phase-1-foundation-rls](phase-1-foundation-rls/) | spec 010 | DB + core | G0 |
| **2 — Setup Flow** | [phase-2-setup-flow](phase-2-setup-flow/) | spec 009 | Mobile + core | G0 (junto da 1) |
| **3 — Caregiver Dashboard** | [phase-3-caregiver-dashboard](phase-3-caregiver-dashboard/) | spec 011 | Mobile + Web + core | G1 (multi-perfil) |
| **4 — Alert Engine** | [phase-4-alert-engine](phase-4-alert-engine/) | **NOVA** | Backend (cron) + canais | G2 |
| **5 — Medical Observer** | [phase-5-observer](phase-5-observer/) | spec 012 | Web + core + DB | G3 |

> **phase-1 é fundação bloqueante** — tabelas + RLS + schemas Zod são pré-requisito de todas as demais.
>
> **WhatsApp/Telegram bot (Fase 7B)** = épico próprio (specs [013](../013-whatsapp-bot-adapter/)/[014](../014-whatsapp-templates-webhook/)), bloqueado por Meta Business. **Não faz parte deste épico.** O que importa aqui são apenas **canais de envio** do link de vínculo (share nativo: WhatsApp/SMS/Telegram/email) — tratados na phase-2.

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
