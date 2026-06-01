# Tasks: Consultation Mode Profile

**Feature Directory**: `plans/specs/005-consultation-mode-profile`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/005-consultation-mode-profile/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/005-consultation-mode-profile/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Criar arquivo de migração SQL `supabase/migrations/20260601000000_consultation_tokens.sql` contendo a tabela de tokens com expiração e políticas de RLS restritas para select baseado puramente no token UUID/hash.
- [ ] **T002** [C1] Configurar as rotas no React Native e Next.js/Vite Web para a navegação do Modo Consulta.

## Phase 2: Implementation

### Database & Core Repository
- [ ] **T003** [US2] Executar a migration no Supabase local e mapear os métodos `generateToken` e `validateToken` em `packages/core/src/repositories/consultationRepository.js`.

### Mobile UI
- [ ] **T004** [US1] Desenhar a tela nativa `ConsultationModeScreen.jsx` travando o aplicativo em retrato e implementando o contraste visual AAA superior a 7:1.
- [ ] **T005** [US1] Organizar as abas simples: Medicamentos, Histórico (últimos 30 dias), Aderência e Estoque.
- [ ] **T006** [US2] Criar o botão de compartilhamento `ShareConsultButton.jsx` integrado com a API nativa `Share`.

### Web Client UI
- [ ] **T007** [US2] Construir a tela desktop pública `WebConsultationView.jsx` consumidora do token dinâmico no fuso local.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T008** [C4] Executar `rtk lint` em todos os diretórios do monorepo e corrigir warnings.
- [ ] **T009** [C4] Criar testes unitários para a criação e expiração lógica de tokens temporários no core.
- [ ] **T010** [C4] Executar `rtk npm run validate:agent` e certificar que todos os testes passaram.
- [ ] **T011** [C4] **Verificação de DoD Independente (R-060/R-221):** Testar no simulador móvel o clique em "Gerar Modo Consulta", verificar que o link temporário foi copiado e que ao tentar ler o mesmo link após alterar manualmente a expiração no banco para o passado, a rota web bloqueia o acesso imediatamente.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T012** [C5] Atualizar a versão do aplicativo no mobile (`app.config.js`) e na web (`package.json`).
- [ ] **T013** [C5] Adicionar entrada no topo do `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T014** [C5] Gravar evidência de qualidade do SQP.
- [ ] **T015** [C5] Finalizar a escrita do journal e incrementar no status.
