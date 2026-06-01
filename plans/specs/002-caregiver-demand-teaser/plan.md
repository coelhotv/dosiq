# Implementation Plan: Caregiver Demand Teaser

**Feature Directory**: `plans/specs/002-caregiver-demand-teaser`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/002-caregiver-demand-teaser/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/EXEC_SPEC_P0_2_TERMOMETRO_CUIDADOR.md`

---

## Technical Context

Esta feature implementa um teste de demanda (painted door) híbrido. Ela reutiliza o serviço existente de cadastro em lista de espera (`betaSignupService.js` na Web e no Mobile) apontando para o endpoint serverless do Dosiq backend.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | O cadastro armazena apenas e-mails públicos de waitlist na tabela `beta_signups` com total isolamento de dados de med/logs. |
| **II. Mobile-First Reliability** | ✅ PASS | Layout da bottom sheet adaptado para teclado virtual com `KeyboardAvoidingView` no Android/iOS para não quebrar rendering. |
| **VI. Release and SQP Discipline** | ✅ PASS | Inclui o checklist obrigatório de SemVer, updates de versão e changelog em português (R-221). |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `apps/mobile/src/features/profile/components/CaregiverTeaserButton.jsx` | Botão destacado com bordas accent e badge EM BREVE. | `plans/backlog-unified_app_2026/EXEC_SPEC_P0_2_TERMOMETRO_CUIDADOR.md` |
| `apps/mobile/src/features/profile/components/CaregiverTeaserSheet.jsx` | Bottom sheet com input e-mail pré-preenchido e chamadas de serviço. | `plans/backlog-unified_app_2026/EXEC_SPEC_P0_2_TERMOMETRO_CUIDADOR.md` |
| `apps/mobile/src/features/profile/screens/ProfileScreen.jsx` | Modificado para expor botão e instanciar bottom sheet com dados do usuário. | `plans/backlog-unified_app_2026/EXEC_SPEC_P0_2_TERMOMETRO_CUIDADOR.md` |
| `apps/web/src/shared/components/CaregiverTeaserModal.jsx` | Modal Web PWA estilizada e lazy-loaded (AP-B03). | `plans/backlog-unified_app_2026/EXEC_SPEC_P0_2_TERMOMETRO_CUIDADOR.md` |
| `apps/web/src/views/ProfileView.jsx` | Modificado para expor botão e instanciar modal na Web PWA. | `plans/backlog-unified_app_2026/EXEC_SPEC_P0_2_TERMOMETRO_CUIDADOR.md` |

---

## Architectural Approach

### 1. Chamadas de API Absolutas no Mobile
- O `betaSignupService.js` no ambiente Web faz chamadas para `/api/users/beta-signup`.
- No **mobile**, a URL deve ser mapeada de forma absoluta (utilizando a constante `API_BASE_URL` ou o wrapper HTTP do Dosiq Mobile, ex: `https://dosiq.app/api/...`), para não gerar falhas de rede no simulador/dispositivo.

### 2. Tratamento de Erro e Idempotência (Unique Constraint)
- O Supabase contém uma unique constraint `(lower(email), feature)`. Se o mesmo e-mail tentar se cadastrar 2x para `caregiver_mode`, o backend retorna erro SQL `23505`.
- O handler do frontend deve interceptar este código de erro (ou a mensagem correspondente) e tratá-lo como **sucesso silencioso**, exibindo a mesma mensagem de agradecimento ao usuário para evitar frustração.

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit deste plano de feature deve prever a execução rígida dos seguintes passos do **SQP R-221**:

*   **Identificação de Plataformas:** Esta feature altera as plataformas **Web/PWA** e **Mobile**.
*   **SemVer Impact:** Classificado como **minor** (nova funcionalidade visível de painted door e waitlist de cuidador).
*   **Version Update:** 
    *   Web: Atualizar `apps/web/package.json`.
    *   Mobile: Atualizar `apps/mobile/app.config.js` (`APP_VERSION`).
*   **Changelog:** Adicionar uma entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a chegada do termômetro de demanda do Modo Cuidador.
*   **Store Note:** Preparar notas de atualização destacando a pesquisa ativa de interesse familiar.
*   **Quality Commands:**
    *   Executar `rtk lint` em ambos os diretórios.
    *   Executar `rtk npm run validate:agent` e certificar sucesso total antes da revisão final.
