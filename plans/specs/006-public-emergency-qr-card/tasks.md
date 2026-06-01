# Tasks: Public Emergency QR Card

**Feature Directory**: `plans/specs/006-public-emergency-qr-card`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/006-public-emergency-qr-card/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/006-public-emergency-qr-card/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Criar arquivo de migração SQL `supabase/migrations/20260601001000_emergency_profiles.sql` contendo a tabela de perfil de emergência e políticas RLS restritas baseadas no token dinâmico.
- [ ] **T002** [C1] Configurar rotas de redirecionamento em deep links universais no mobile e no Next.js/Vite Web.

## Phase 2: Implementation

### Shared / Core Schemas & Repositories
- [ ] **T003** [US2] Implementar schema Zod canônico de validação `@dosiq/core/schemas/emergencyProfileSchema.js` de acordo com a R-021.
- [ ] **T004** [US2] Mapear os métodos de leitura pública e alteração de tokens em `packages/core/src/repositories/emergencyRepository.js`.

### Mobile App Components
- [ ] **T005** [US1] Desenhar o componente gerador de QR Code `EmergencyQRCode.jsx` na ProfileScreen do paciente nativo.
- [ ] **T006** [US2] Integrar o botão de controle de revogação/renovação de token na aba de privacidade do mobile.

### Web Serverless & Client UI
- [ ] **T007** [US1] Construir a tela móvel ultraleve e minimalista `PublicEmergencyScreen.jsx` Next.js/Vite Web garantindo carregamento instantâneo (< 50kB bundle size).

## Phase 3: Validation & QA Gates (C4)

- [ ] **T008** [C4] Executar `rtk lint` em todos os diretórios do monorepo e corrigir warnings.
- [ ] **T009** [C4] Escrever testes unitários para a validação Zod e políticas de segurança RLS do repositório core.
- [ ] **T010** [C4] Executar `rtk npm run validate:agent` e certificar que todos os testes passaram.
- [ ] **T011** [C4] **Verificação de DoD Independente:** Confirmar que ao acessar a URL com o token correto os dados de Dona Maria aparecem, e que ao clicar em "Revogar Token" no mobile e recarregar a mesma URL, o retorno do servidor web é erro 404 instantâneo.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T012** [C5] Atualizar a versão do aplicativo no mobile (`app.config.js`) e no core (`package.json`).
- [ ] **T013** [C5] Adicionar entrada no topo do `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T014** [C5] Gravar evidência de qualidade do SQP.
- [ ] **T015** [C5] Finalizar a escrita do journal e incrementar no status.
