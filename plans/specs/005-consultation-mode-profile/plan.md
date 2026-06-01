# Implementation Plan: Consultation Mode Profile

**Feature Directory**: `plans/specs/005-consultation-mode-profile`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/005-consultation-mode-profile/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` §M1.3

---

## Technical Context

Esta feature envolve a criação de componentes de acessibilidade visual de alto contraste no aplicativo móvel nativo e a implementação de endpoints e rotas temporárias com segurança criptográfica baseada em banco de dados Supabase na web.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | O link temporário expõe dados estritamente clínicos (posologias, estoques e histórico) sem credenciais pessoais, expirando rigidamente em 24h. |
| **II. Mobile-First Reliability** | ✅ PASS | Tela travada em orientação retrato e sem complexidade de renderização pesada. |
| **IV. Timezone Correctness** | ✅ PASS | A expiração do token de 24h baseia-se no timestamp UTC de expiração no Supabase. |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelog e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `apps/mobile/src/features/profile/screens/ConsultationModeScreen.jsx` | Tela nativa mobile full-screen de alto contraste (AAA) com abas clínicas. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `apps/mobile/src/features/profile/components/ShareConsultButton.jsx` | Botão nativo acionando o `Share` API do React Native com link temporário. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `apps/web/src/features/profile/screens/WebConsultationView.jsx` | Rota web pública desktop read-only consumidora do token de 24h. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `packages/core/src/repositories/consultationRepository.js` | Métodos para gerar e validar tokens temporários de 24h integrados no core. | `@dosiq/core` optimization |
| `supabase/migrations/20260601000000_consultation_tokens.sql` | Migration de criação da tabela de tokens temporários e políticas de RLS. | Supabase DB Schema |

---

## Architectural Approach

### 1. Expo Go Decommission & Build Constraints
> [!IMPORTANT]
> **COMPILAÇÃO NATIVA OBRIGATÓRIA:**  
> Devido ao uso de dependências do monorepo e ao compartilhamento nativo `Share`, todos os testes locais e validação da tela de Modo Consulta devem ocorrer via Development Builds locais (`rtk expo run:android` / `rtk expo run:ios`).

### 2. Geração e Rota do Token Seguro
* **Criação do Link:** O repositório core efetua uma chamada RPC ou INSERT na tabela `consultation_tokens` que gera uma chave `secure_key` criptograficamente segura (32 bytes em formato hex) e um prazo exato de `now() + interval '24 hours'`.
* **Visualização Web:** A página pública `WebConsultationView.jsx` na web realiza a leitura fazendo SELECT baseado na `secure_key`. As políticas de RLS garantem que a consulta falhe imediatamente caso `expires_at` seja menor que a hora UTC atual do servidor Supabase (`expires_at < now()`).

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Mobile**, **Web** e **Shared/Core** (`packages/core`, `supabase`).
* **SemVer Impact:** Classificado como **minor** (ficha médica do modo consulta e compartilhamento seguro).
* **Version Update:**
  * Mobile: Atualizar `apps/mobile/app.config.js` (`APP_VERSION`).
  * Web: Atualizar `apps/web/package.json` (`version`).
* **Changelog:** Adicionar entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a chegada do Modo Consulta acessível e link seguro para médicos.
* **Quality Commands:**
  * Executar `rtk lint` no core, web e mobile.
  * Executar `rtk npm run validate:agent` e garantir sucesso de regressões.
