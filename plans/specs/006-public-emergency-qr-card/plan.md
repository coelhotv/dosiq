# Implementation Plan: Public Emergency QR Card

**Feature Directory**: `plans/specs/006-public-emergency-qr-card`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/006-public-emergency-qr-card/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` §F6.1

---

## Technical Context

Esta feature envolve a modelagem lógica e validação estrutural do cartão de emergência no pacote core (regras R-021), a integração de renderizadores de QR Code nativos e a otimização de bundles no frontend web Next.js/Vite para velocidade extrema de carregamento.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Os dados expostos são puramente de emergência (socorro) e controlados de forma soberana com revogação via RLS pelo próprio usuário. |
| **II. Mobile-First Reliability** | ✅ PASS | Leitura e geração de QR Code local no dispositivo nativo com o menor tamanho de código. |
| **IV. Timezone Correctness** | ✅ PASS | Armazenamento de auditoria e criação em timestamps UTC no Supabase. |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelog e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `packages/core/src/schemas/emergencyProfileSchema.js` | Schema Zod 4 de validação do perfil de emergência (R-021). | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `apps/mobile/src/features/profile/components/EmergencyQRCode.jsx` | Componente nativo gerador do QR Code a partir de `emergency_token`. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `apps/web/src/features/emergency/screens/PublicEmergencyScreen.jsx` | Rota web pública Next.js/Vite ultraleve (< 50kB bundle) para socorristas. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `packages/core/src/repositories/emergencyRepository.js` | Métodos de persistência, revogação e rota pública integrados no core. | `@dosiq/core` integration |
| `supabase/migrations/20260601001000_emergency_profiles.sql` | Migration para criar tabela `emergency_profiles` e políticas de segurança RLS baseadas em `emergency_token`. | Supabase DB Schema |

---

## Architectural Approach

### 1. Expo Go Decommission & Build Constraints
> [!IMPORTANT]
> **COMPILAÇÃO NATIVA OBRIGATÓRIA:**  
> A geração de QR Code nativo e a integração com deep links universais requer compilação nativa. Todo teste local no mobile deve ocorrer via Development Builds locais (`rtk expo run:android` / `rtk expo run:ios`).

### 2. Políticas de Segurança RLS (Supabase)
* **Acesso Público Restrito:** A tabela `emergency_profiles` possui política RLS `SELECT` aberta baseada na validação do token do cabeçalho de consulta:
  ```sql
  CREATE POLICY "Acesso público restrito por token ativo" 
  ON emergency_profiles 
  FOR SELECT 
  USING (emergency_token = (current_setting('request.jwt.claims', true)::json->>'emergency_token'));
  ```
  *(Ou passando o token como argumento direto em função RPC Supabase, garantindo que usuários comuns sem o token não possam ler dados de terceiros).*
* **Revogação Instantânea:** Quando o usuário clica em "Revogar" no aplicativo nativo, uma chamada PATCH ou chamada de função altera `emergency_token` na tabela `profiles` e na tabela de relacionamento para um novo hash MD5/Hex randômico, invalidando instantaneamente qualquer cache de URL antiga.

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Mobile**, **Web**, **Shared/Core** (`packages/core`) e **Infra/Supabase**.
* **SemVer Impact:** Classificado como **minor** (cartão de emergência público com revogação LGPD).
* **Version Update:**
  * Mobile: Atualizar `apps/mobile/app.config.js` (`APP_VERSION`).
  * Web/Core: Atualizar `apps/web/package.json` e `packages/core/package.json`.
* **Changelog:** Adicionar entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a chegada do Cartão de Emergência físico por QR Code e tela pública de socorristas.
* **Quality Commands:**
  * Executar `rtk lint` em todos os diretórios.
  * Executar `rtk npm run validate:agent` e garantir sucesso antes do commit final.
