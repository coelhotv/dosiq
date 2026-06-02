# Implementation Plan: Modo Consulta (Mobile + Web)

**Feature Directory**: `plans/specs/005-consultation-mode-profile`
**Spec**: `spec.md` · **Revised**: 2026-06-02 · **Tier**: 1 (2 se opção A)

> ⚠️ **Bloqueado por decisão**: resolver o `[NEEDS CLARIFICATION]` (A live-token vs B snapshot via `api/share`) antes do C2. Plano abaixo detalha ambos; o caminho B é o recomendado.

---

## Technical Context

Mobile: tela full-screen AAA reusando a agregação de ficha. Web: reusar `features/consultation`. Link: **B** via `api/share.js` (blob TTL 24h) ou **A** tabela+rota pública.

**Paths reais verificados:**
- Web consulta: `apps/web/src/features/consultation/{components/ConsultationView.jsx, components/redesign/ConsultationViewRedesign.jsx, services/consultationDataService.js}`. ✅
- Share: `api/share.js` (`expiresInHours`, default 72 / max 168 → usar 24). ✅
- Sem tabela `profiles`; migração (se A) em `docs/migrations/`.
- Mobile: `apps/mobile/src/features/profile/screens/ConsultationModeScreen.jsx` [NEW]; `components/ShareConsultButton.jsx` [NEW].

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| R-090 (serverless ≤12) | ✅ (B) / ⚠️ (A) | B reusa `api/share` (zero função nova); A adiciona rota → consome budget. |
| Health Data Safety | ✅ | Expira em 24h; só dados clínicos. |
| dry-principles | ✅ | Reusa `consultationDataService`; extrair p/ `@dosiq/core` se mobile precisar. |
| R-221 SQP | ✅ | Minor mobile+web (+core se extração). |

---

## Architecture / Approach

### Comum
- **Agregação da ficha**: `consultationDataService.getConsultationData(...)` (web, existente). Se o mobile precisar do mesmo cálculo, **extrair as funções puras p/ `@dosiq/core`** e reusar em ambos (não duplicar no mobile).
- **Mobile UI**: `ConsultationModeScreen.jsx` full-screen retrato, contraste ≥7:1, abas (Medicamentos/Histórico/Aderência/Estoque).

### Caminho B (recomendado — snapshot via api/share)
- Gerar a ficha (HTML/PDF — reusa o gerador da spec 007 `features/reports`) → `api/share` `{ blob, filename, expiresInHours: 24 }` → recebe URL → `Share` nativo.
- Web: a URL do blob abre o snapshot direto (sem rota nova). Expiração = TTL do blob (404 após 24h).

### Caminho A (se o PO exigir live)
- Migração `docs/migrations/<data>_consultation_tokens.sql`: tabela (`id`,`user_id`,`secure_key` 32 hex,`expires_at`) + GRANTs (CREATE TABLE → template obrigatório CLAUDE.md) + RLS (SELECT público condicionado a `expires_at > now()`).
- Rota pública web (`views/` lazy ou rota dedicada) lendo por `secure_key`. **Custa +1 função serverless** se virar endpoint — validar budget R-090.
- `WebConsultationView` reusa `ConsultationViewRedesign` em modo read-only/token.

---

## Target Files

| Path | Purpose | Caminho |
|------|---------|---------|
| `apps/mobile/src/features/consultation/screens/ConsultationModeScreen.jsx` | full-screen, **4 tabs** (Meds·Aderência·Prescrições+Titulação·Estoque), footer padBottom 88 (`mock-modoconsulta-*`). | C+B+A [NEW] |
| `apps/mobile/src/features/consultation/screens/ConsultationPresentationScreen.jsx` | **Modo Apresentação** full-bleed (PO-7, `mock-modoconsulta-telacheia.png`). | C+B+A [NEW] |
| `apps/mobile/src/features/consultation/components/ConsultationTabs/*` | tabs (Meds/Aderência/Prescrições+Titulação c/ `ConsultationTitrationCard`/Estoque). | C+B+A [NEW] |
| `apps/mobile/src/features/consultation/components/ShareSheet.jsx` | 3 opções (Apresentação · Gerar PDF→007 · sistema, `mock-modoconsulta-sharesheet.png`). | C+B+A [NEW] |
| `apps/mobile/src/features/profile/...` (hub) | entry point "Modo Consulta" em Ferramentas. | [MOD] |
| `packages/core/.../consultationData*.js` | extrair agregação pura de `consultationDataService` (se mobile reusar). | [MOD/NEW] |
| `api/share.js` | reuso (TTL 24h). | **B** |
| `docs/migrations/<data>_consultation_tokens.sql` + rota pública | tabela+RLS+rota. | **A** |

> **Removidos** os alvos errados: `features/profile/WebConsultationView.jsx` (usar `features/consultation`), `supabase/migrations/...` (usar `docs/migrations/`), e a tab **"Histórico"** (não é Modo Consulta — tab certa é Prescrições+Titulação, PO-6). **Mobile usa `features/consultation`** (espelha a web), não `features/profile`.

## Risks
- **Decisão A/B não resolvida** → C2 bloqueado.
- **A custa função serverless** (R-090) + migração; B não. Preferir B salvo necessidade de dado ao vivo.
- **Mobile duplicar agregação**: extrair p/ core, não copiar `consultationDataService`.
