# EXEC SPEC — Fase 4: Perfil + Landing + Onboarding

> **Versão**: v1 — 2026-05-23
> **Duração estimada**: 2 sprints semanais
> **Branch base (mãe)**: `feat/profile-onboarding` (a criar; sai de `main` após Fase 3)
> **Pré-condição**: ✅ Fase 1 (Medicamentos) · ✅ Fase 2 + 2.5 (Tratamentos) · ✅ Fase 3 (Estoque) entregues
> **Quality Gates**: Perfil (mini-CRUD) segue G1 → G2 → G3; Landing/Onboarding/Settings = UI/auth (G1-equivalente, sem extract/migrate)
> **SQP vinculante**: v2.0 ([INDEX_EXEC_SPECS.md](INDEX_EXEC_SPECS.md))
> **Referência mestra**: [MASTER_PLAN_HIBRIDO_EVOLUCAO_CRUD.md](MASTER_PLAN_HIBRIDO_EVOLUCAO_CRUD.md) §9 (Fase 4)
> **Mocks aprovados (PO)**: `MOCKS_APP_CRUD/export/fase-4/` + protótipo `MOCKS_APP_CRUD/project/Dosiq · Fase 4 - Perfil.html` (`dosiq-mocks/profile-screens.jsx` + `onboarding-screens.jsx`)
> **Handoff designer canônico**: `MOCKS_APP_CRUD/project/dosiq-mocks/HANDOFF_FASE_4_EM_DIANTE.md` §2.4

---

## §0 — Cuidados Aprendidos (consolidado RETROs Fase 1+2+3)

Todo spawn da Fase 4 DEVE seguir; spec sem aplicar = retrabalho garantido.

### 0.1 Arquitetura compartilhada (web↔mobile)
- **Factory canônica** para o mini-CRUD de perfil: `createProfileRepository({ client, getUserId })` em `packages/core/src/repositories/` — espelha `createMedicineRepository`/`createProtocolRepository`/`createStockRepository`. Injeta client + getUserId; métodos sem param userId.
- **Schema único** em `@dosiq/core` — estender o `userProfileSchema` existente (hoje em `apps/web/src/schemas/userProfileSchema.js`; mover/derivar canônico em `packages/core/src/schemas/` se ainda não estiver lá — **verificar com find/grep no C1**).
- **Helpers puros** já existentes reusar (não duplicar): `calculateAge` (derivar de `birth_date` via `parseLocalDate`), `getInitials` (iniciais do display_name).

### 0.2 Mobile patterns (consolidados Fases 1-3)
- Form full-screen stack + sticky save bar (`FormActions` absolute, Cancelar flex:1 / Salvar flex:2). NUNCA modal.
- Bottom sheet (`Modal statusBarTranslucent` — R-233) para ações contextuais: avatar picker, sheet excluir conta, sheet logout. Spacer `<View height={StatusBar.currentHeight}>` (Android) + `SafeAreaView edges={['bottom']}`.
- Ordem React (R-010): States → Memos → Effects → Handlers.
- Datas: SEMPRE `parseLocalDate` (R-020); nunca `new Date('YYYY-MM-DD')`.
- `createStackNavigator` JS (ADR-036), não native (crash Android API 24).
- Lazy view + `ViewSkeleton` (R-117).
- **Toda tela tem EMPTY STATE** (regra fixada pelo PO na Fase 3): Hub do Perfil vazio = card teal soft borda dashed + CTA "Adicionar meus dados".
- **Affordance visual, nunca textual** (regra geral pós-Fase 3): sombra raised + chevron, sem "toque aqui".

### 0.3 Decisões PO absorvidas dos mocks Fase 4 (HANDOFF §2.4)

| ID | Decisão | Implicação spec |
|----|---------|-----------------|
| PO-1 | **Card de identidade no Hub é canônico**; versão MVP sem card removida. Hub vazio = empty state "Complete seu perfil" (nome, data nasc., cidade) | Hub sempre renderiza card OU empty state |
| PO-2 | **Editar perfil roadmap v1 → v2**. **v1 entrega agora** = só iniciais (avatar pequeno, sem upload). v2 = foto (avatar grande + camera badge + picker) — **backlog** | Fase 4 entrega V1; V2 registrada em §Evolução Futura |
| PO-3 | **"Sair da Conta" vive APENAS no Hub** (não em Configurações). Sheet de confirmação sobre o Hub | — |
| PO-4 | **Mobile NÃO tem seção Administração / DLQ** (web-only) | — |
| PO-5 | **Avatar picker (v2) NÃO tem "Remover foto"** — "Usar iniciais" já zera | v2/backlog |
| PO-6 | **Avatar default = iniciais coloridas** (`AC` teal sobre `primaryBg`). Nunca avatar ilustrado | — |
| PO-7 | **Email é readonly** no form (alteração via Configurações → Segurança) | Campo lock |
| PO-8 | **Onboarding = experiência guiada "aha moment"** — novo usuário cadastra 1º medicamento + 1º tratamento logo no setup, **reusando os serviços/primitivos das Fases 1 e 2** (zero duplicação de lógica). Passo de tratamento tem "Pular" | Wizard orquestra fluxos existentes |
| PO-9 | **Settings: densidade da interface** (Padrão / Automático / Detalhado) + Segurança (Alterar senha · Excluir conta). Sem "Sair" aqui | Novo campo de preferência |
| PO-10 | **Excluir conta bloqueia se houver tratamentos ativos**; confirmação dupla digitando "EXCLUIR"; banner sugere exportar antes (export = Fase 6) | Sheet bloqueante + RPC |

### 0.4 Processo (SQP §§10-13)
- Smoke PO ANTES de `gh pr create` (R-234). Push EAS OK; segurar PR até PO validar iOS + Android API 24.
- Sub-agentes NUNCA commitam (R-230 brief, Write/Edit only).
- `validate:agent` antes de solicitar gate.

### 0.5 Base existente no app (ponto de partida — NÃO criar do zero)

Esta fase **evolui telas e infra já existentes no MVP** — verificar e estender, não recriar. Verificar paths no C1 (podem ter mudado).

| Artefato existente | Path | Estado atual (MVP) | Delta da Fase 4 |
|--------------------|------|--------------------|-----------------|
| **`LandingScreen`** | `apps/mobile/src/screens/LandingScreen.jsx` | Já existe e montada em `ROUTES.LANDING` (`Navigation.jsx`). Tem `AdherenceRing score={91}`, card "PRÓXIMA DOSE 08:00 Atorvastatina", headline atual **"Sua saúde sob controle, sem complicações."**, benefits bar (100% SEGURO · Offline ACESSO · Grátis PARA SEMPRE), CTAs `Criar conta`→`ROUTES.SIGNUP` e `Já tenho conta`→`ROUTES.LOGIN` | Alinhar copy/layout ao `mock-landing-revisada` (headline "Nunca mais esqueça um remédio.", 2 feature chips Lembretes/Estoque). **Reusa `AdherenceRing` e os CTAs já fiados** — é refinamento visual, não tela nova |
| **`ProfileScreen`** | `apps/mobile/src/features/profile/screens/ProfileScreen.jsx` | Já existe e montada em `ROUTES.PROFILE_MAIN` (`ProfileStack.jsx`). MVP read-only: seções **MINHA CONTA** (email + status), **AVISOS & LEMBRETES** (Notificações→inbox), **OUTROS** (Privacidade e dados · Sobre o Dosiq "em breve"), botão **Sair da Conta** (Alert nativo) + versão no rodapé. Usa `useProfile` + `logoutUser` | Vira o **Hub** (§C): adicionar **card de identidade / empty state** no topo + linha **Configurações** + evoluir "Sair" para **bottom sheet** (PO-3). Preservar as seções já existentes. Renomear para Hub conceitualmente, manter a rota `PROFILE_MAIN` |
| **`useProfile`** | `apps/mobile/src/features/profile/hooks/useProfile.js` | Hook atual (carrega user) | Estender para expor perfil completo (display_name, birth_date, city, state, phone, ui_density) via factory |
| **`profileService`** | `apps/mobile/src/features/profile/services/profileService.js` | Tem `logoutUser` (+ testes) | Adotar `createProfileRepository` (G1/G2/G3) + `authService` (signUp/in/updatePassword); preservar logout |
| **Rotas existentes** | `apps/mobile/src/navigation/routes.js` | `LANDING`, `LOGIN`, `SIGNUP`, `PROFILE`('Perfil'), `PROFILE_MAIN`('ProfileMain') já definidas | Adicionar `PROFILE_EDIT`, `SETTINGS`, `CHANGE_PASSWORD`, `ONBOARDING` |
| **Telas auxiliares já existentes** | `NotificationPreferencesScreen.jsx`, `TelegramLinkScreen.jsx`, `TelegramLinkCard.jsx` | Vivem no ProfileStack | Manter; o Hub continua linkando Notificações |

> **Onboarding (§B)**: as rotas `SIGNUP`/`LOGIN` **já existem** — o passo 1 do wizard alinha-se ao fluxo de signup atual; não duplicar autenticação.

---

## Objetivo

Levar o app nativo de "MVP read-only de perfil" para:

1. **Landing não-autenticada** — primeira tela ao abrir o app sem sessão: preview de valor (anel "Tudo em dia" + próxima dose mock) + CTAs `Criar conta` / `Já tenho conta`.
2. **Onboarding guiado (3 passos)** — wizard de primeiro acesso que entrega o **"aha moment"**: criar conta → cadastrar 1º medicamento → configurar 1º tratamento (frequência/horários, com "Pular"). Reusa serviços/primitivos das Fases 1-2.
3. **Perfil completo (mini-CRUD)** — Hub (card identidade ou empty state) + Editar Perfil V1 (nome, data nasc., cidade, estado, telefone; email readonly; avatar iniciais) + Configurações (densidade UI, alterar senha, excluir conta) + Sair (sheet no Hub).

**Exclusões v1** (→ backlog / fases futuras):
- Avatar com **foto** (upload/galeria/camera) = Perfil V2 (§Evolução Futura).
- **Exportar dados** (LGPD) e **Cartão de Emergência** = Fase 6 (linhas presentes no Hub sem destination ainda).
- Modo escuro / temas além de densidade.

---

## Contexto Técnico: onde mora o perfil

| Aspecto | Estado atual |
|---------|--------------|
| Storage | Tabela `user_settings` (web: `useProfileState.js`). Campos: `display_name`, `birth_date`, `city`, `state`, `updated_at` (+ `emergency_card` etc.) chaveado por `user_id` |
| Schema | `userProfileSchema` → `validateUserProfile` (campos display_name/birth_date/city/state) |
| Web hoje | `apps/web/src/features/profile/hooks/useProfileState.js` faz `supabase.from('user_settings').upsert(...)` **inline** (sem service/factory) |
| Avatar | Derivado: iniciais de `display_name`. Foto inexistente |
| Auth (email/senha) | Supabase Auth (`supabase.auth.updateUser`, `signUp`, `signInWithPassword`) |

**Campos NOVOS nesta fase** (migration + extensão de schema):
- `phone` (telefone, opcional) em `user_settings`
- `ui_density` (`'padrao' | 'automatico' | 'detalhado'`, default `'automatico'`) em `user_settings`
- (V2/backlog) `avatar_url` para foto

---

## Especificação de Telas

### §A — Landing (não-autenticada) · evolui `apps/mobile/src/screens/LandingScreen.jsx`
Mock: `mock-landing-revisada.png`. **Tela já existe** (montada em `ROUTES.LANDING`); esta fase **refina copy/layout** — reusa `AdherenceRing` e os CTAs já fiados a SIGNUP/LOGIN.
- Logo `dosiq` + check teal no topo.
- **Preview card** (mock, sem lógica): mini-anel `91% · Tudo em dia` + card `PRÓXIMA DOSE 08:00 Atorvastatina · 40 mg · 1 unidade`.
- Headline: **"Nunca mais esqueça um remédio."** (esqueça em teal).
- Subcopy: "lembra dos horários, controla o estoque e funciona offline. Gratuito, sem assinatura."
- 2 feature chips: `Lembretes` (push + WhatsApp em breve) · `Estoque` (avisa antes de acabar).
- CTAs: `Criar conta` (primary, → Onboarding passo 1) · `Já tenho conta` (secondary, → Login).

### §B — Onboarding (wizard 3 passos) · `OnboardingNavigator`
Mocks: `mock-onboarding-passo1/2/3-diario/3-semanal`. Progress dots no topo (3). Reusa serviços F1/F2 + primitivos de form.

- **Passo 1 — Criar conta**: email (required) + senha (required, min 6, toggle Mostrar). Card "Sua conta, suas regras" (offline). Banner info "link de confirmação por e-mail". CTA `Continuar` → `supabase.auth.signUp`. Microcopy Termos + Privacidade.
- **Passo 2 — 1º medicamento**: reusa o fluxo de criação de medicamento da **Fase 1** (busca ANVISA bottom sheet + nome required) embutido no wizard. CTA `Continuar`.
- **Passo 3 — 1º tratamento**: "Quando você toma?" — reusa o fluxo de criação de tratamento da **Fase 2**: `Frequência` (Todo dia / Dias da semana — segmented), `Horários` (chips verticais + "Adicionar horário"), `Quantidade por dose`, toggle "Me avise a hora de tomar" (lembrete). Botão `Pular` (header) + `Concluir`. Variantes diário/semanal mudam o seletor de dias.
- **Conclusão**: navega para o app autenticado (Dashboard "Hoje") — primeiro valor visível imediatamente (aha moment).

> **Reuso obrigatório (PO-8)**: passos 2 e 3 NÃO recriam telas — orquestram `medicineService.create` (F1) e `protocolService.create` (F2) via os mesmos primitivos de form. O onboarding é uma casca de fluxo guiado; a lógica é a já entregue.

### §C — Hub do Perfil · evolui `apps/mobile/src/features/profile/screens/ProfileScreen.jsx` (rota `PROFILE_MAIN`)
Mocks: `mock-perfil-empty-state` · `mock-perfil-preenchido-v1` (iniciais). **Tela já existe** (MVP read-only); preservar seções atuais (MINHA CONTA · AVISOS & LEMBRETES · OUTROS · versão) e adicionar o que segue.
- **Empty state** (perfil sem dados): card teal soft borda dashed + ilustração circular + heading "Complete seu perfil" + CTA `Adicionar meus dados` → Editar Perfil.
- **Preenchido**: card identidade (avatar iniciais `AC` + nome + idade derivada + cidade/estado) com chevron → Editar.
- Seções: **MINHA CONTA** · **AVISOS & LEMBRETES** · **OUTROS** (inclui linha "Privacidade e dados" — sem destination na F4) + linha "Configurações" → Settings.
- Rodapé: botão `Sair da Conta` (→ sheet logout) + versão `DOSIQ v0.4.0`.

### §D — Editar Perfil V1 · `ProfileEditScreen`
Mocks: `mock-perfil-editar-v1` (vazio) · `-v1-novo` · `-v1-erro` · `-v1-sucesso`.
- Form full-screen + sticky save bar (`Cancelar` / `Salvar`).
- Avatar: iniciais `AC` teal sobre `primaryBg` + label "Adicionar foto" **inerte na V1** (badge "V2 - evolução futura" no canvas; no app V1, o tap abre nada ou um toast "em breve" — **confirmar microcopy com PO no kickoff**).
- Campos: `Nome` (required) · `Data de nascimento` (opcional, DatePicker nativo) · `Cidade` + `Estado` (select UF) · `Telefone` (opcional, máscara) · `Email da conta` (**readonly**, lock icon, caption "Para alterar, use Configurações → Segurança").
- Erros inline (mock `-v1-erro`: nome vazio). Sucesso = toast "Perfil atualizado!" (mock `-v1-sucesso`).

### §E — Configurações · `SettingsScreen`
Mock: `mock-perfil-settings`.
- **PREFERÊNCIAS → Densidade da interface** (3-up cards: `Padrão` textos maiores/foco · `Automático` ajusta pelos tratamentos · `Detalhado` gráficos/visões técnicas). Persistir `ui_density`.
- **SEGURANÇA**: linha `Alterar senha` (última alteração) → Alterar Senha · linha `Excluir minha conta` (bloqueante se tratamentos ativos) → sheet excluir.
- Rodapé: `DOSIQ v0.4.0 · Design Santuário`.
- **Sem** "Sair" (vive no Hub — PO-3) e **sem** Administração/DLQ (PO-4).

### §F — Alterar Senha · `ChangePasswordScreen`
Mocks: `mock-perfil-trocar-senha` · `-erro`.
- Header contextual (IconLock + microcopy). Campos: nova senha + confirmar. Barra de força (4 segmentos). Banner info teal sobre re-login. `supabase.auth.updateUser({ password })`.

### §G — Sheets
- **Logout** (`mock-perfil-sheet-logout`): sheet sobre o Hub. Confirmar → cleanup localStorage/AsyncStorage + reload (R: Workbox/Supabase signOut — ver [[feedback_workbox_supabase_logout]] no contexto web; mobile usa `supabase.auth.signOut` + reset nav).
- **Excluir conta** (`mock-perfil-sheet-excluir`): sheet bloqueante sobre Settings. Lista deps (tratamentos · estoque · histórico · dados). Banner amber "exporte antes" (export = Fase 6). Confirmação dupla digitando `EXCLUIR`. **Bloqueia se houver tratamentos ativos** (PO-10) → RPC `delete_user_account` (a especificar — SECURITY DEFINER, valida ownership, cascata controlada).

---

## Mini-CRUD de Perfil — Schema, Migration & Factory

### Migration (PO aplica via MCP, agente não auto-aplica)
`docs/migrations/YYYYMMDD_profile_phone_density.sql`:
```sql
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS ui_density text
  DEFAULT 'automatico' CHECK (ui_density IN ('padrao','automatico','detalhado'));
-- Grants já existentes na tabela (verificar via MCP). RLS já ativa.
```
> `avatar_url` (foto) NÃO entra na V1 — adicionar só na V2.

### Schema canônico
Estender `userProfileSchema` (campos: `display_name` required, `birth_date` nullable, `city`/`state` nullable, **`phone` nullable novo**). Sincronizar com CHECK constraints. `.nullable().optional()` (nunca só `.optional()`).

### Factory `createProfileRepository`
`packages/core/src/repositories/createProfileRepository.js` — espelha as factories anteriores:
- `getProfile()` → `user_settings` single por user_id (default object se ausente)
- `updateProfile(input)` → `validateUserProfile` + upsert `{ user_id, ...data, updated_at }` onConflict user_id
- `updateDensity(density)` → upsert `ui_density`
- `deleteAccount()` → RPC `delete_user_account` (bloqueia se tratamentos ativos)

Auth (signUp/signIn/updatePassword/signOut) **fica fora da factory** (é Supabase Auth, não tabela) — encapsular num `authService` mobile fino.

---

## Sprint Breakdown

### Sprint S4.1 — Perfil (mini-CRUD) + Settings + Landing — Semana ~12

| # | Task | Path | Agente | Cx |
|---|------|------|--------|----|
| S1 | Migration `phone` + `ui_density` (PO aplica) | `docs/migrations/*.sql` | 👤 Opus | ⭐ |
| S2 | Estender `userProfileSchema` (+phone) canônico em `@dosiq/core` | `packages/core/src/schemas/` | 👤 Opus | ⭐⭐ |
| S3 | `createProfileRepository` factory + parity tests | `packages/core/src/repositories/` | 👤 Opus | ⭐⭐ |
| S4 | `profileService` mobile (adopt factory; **preservar `logoutUser` existente**) + `authService` (signUp/in/updatePassword) | `apps/mobile/src/features/profile/services/profileService.js` | 🤖 Sonnet | ⭐⭐ |
| S5 | **Estender `useProfile`** (perfil completo) + `useProfileMutation` | `apps/mobile/src/features/profile/hooks/useProfile.js` | 🤖 Sonnet | ⭐⭐ |
| S6 | **Evoluir `ProfileScreen`** → Hub (empty state + card identidade + linha Configurações; preservar seções MVP) | `apps/mobile/src/features/profile/screens/ProfileScreen.jsx` | 👤 Opus | ⭐⭐⭐ |
| S7 | `ProfileEditScreen` V1 (form + sticky save + email readonly + erros + toast) | idem | 👤 Opus | ⭐⭐⭐ |
| S8 | `SettingsScreen` (densidade + segurança) + `ChangePasswordScreen` | idem | 🤖 Sonnet | ⭐⭐ |
| S9 | Sheets Logout + Excluir conta (RPC `delete_user_account` + dupla confirmação) | idem + `docs/migrations/*.sql` | 👤 Opus | ⭐⭐⭐ |
| S10 | **Refinar `LandingScreen` existente** (copy/layout do mock revisado; reusa `AdherenceRing` + CTAs já fiados) | `apps/mobile/src/screens/LandingScreen.jsx` | 🤖 Sonnet | ⭐⭐ |
| S11 | Adicionar rotas novas (`PROFILE_EDIT`, `SETTINGS`, `CHANGE_PASSWORD`, `ONBOARDING`) — `LANDING`/`SIGNUP`/`LOGIN` já existem | `apps/mobile/src/navigation/routes.js` + stacks | 🤖 Haiku | ⭐ |

### Sprint S4.2 — Onboarding guiado + Extract/Migrate (G2/G3) — Semana ~13

| # | Task | Path | Agente | Cx |
|---|------|------|--------|----|
| O1 | `OnboardingNavigator` (3 passos, progress dots, "Pular") | `apps/mobile/src/features/onboarding/` | 👤 Opus | ⭐⭐⭐ |
| O2 | Passo 1 conta (`signUp`) + Passo 2 reusa fluxo medicamento F1 + Passo 3 reusa fluxo tratamento F2 | idem | 👤 Opus | ⭐⭐⭐ |
| O3 | Gate de primeiro acesso (sessão nova sem perfil/tratamento → onboarding; senão app) | `apps/mobile/src/navigation/` | 👤 Opus | ⭐⭐ |
| O4 | **G3** — web adota `createProfileRepository`: refatorar `useProfileState.js` pra delegar à factory (remover supabase inline) | `apps/web/src/features/profile/hooks/useProfileState.js` | 👤 Opus | ⭐⭐⭐ |
| O5 | `validate:agent` web 100% green pós-G3 | — | 👤 Opus | ⭐ |
| O6 | Atualizar MASTER_PLAN + INDEX (cross-ref) | `plans/backlog-native_app/` | 🤖 Haiku | ⭐ |
| O7 | Smoke E2E iOS + Android API 24 (landing → onboarding → perfil → settings → senha → logout) | Manual | 👤 Humano | — |

---

## Quality Gates — Fase 4

### Perfil (mini-CRUD) → G1 / G2 / G3
- **G1 (Cópia)**: `profileService` mobile funcional (CRUD em `user_settings`); testes; CRUD no simulador; `validate:agent` web green.
- **G2 (Extração)**: `createProfileRepository({ client, getUserId })` em `@dosiq/core`; mobile adota; parity tests; web ainda inline.
- **G3 (Migração)**: web `useProfileState` adota factory; **todos os testes web passam**; zero supabase inline residual; build web + `expo export` OK.

### Landing / Onboarding / Settings → UI/auth (sem G2/G3)
Não há lógica de domínio compartilhável nova (auth = Supabase SDK; onboarding = orquestração de fluxos já extraídos). Entrega em PR único mobile, com **G1-equivalente**: smoke iOS+Android + `validate:agent` web verde (sem regressão). Justificativa: forçar copy→extract→migrate aqui seria cerimônia sem ganho de paridade (decisão alinhada com PO 2026-05-23).

---

## Brief padrão cavecrew (R-230)
Cada spawn recebe: refs read-only absolutas (esta spec + mock PNG/jsx + arquivo análogo Fase 1-3) · path absoluto · contrato exato (assinatura/props/return) · regras críticas (R-010, R-020, R-233, ADR-036) · output esperado + ponto de integração · **sem commits** (Write/Edit only).

---

## PR Strategy

| Sprint | PR contra | Reviewer humano | Reviewer LLM |
|--------|-----------|-----------------|--------------|
| S4.1 (waves) | `feat/profile-onboarding` | PO smoke iOS+Android | Gemini |
| S4.2 (waves) | `feat/profile-onboarding` | PO smoke (onboarding + G3 web) | Gemini |
| PR-mãe | `main` | PO valida fluxo completo | Gemini |

R-060/R-065: agente nunca auto-merge; PO faz merge na main.

---

## Critérios para encerramento da Fase 4
- [ ] G1/G2/G3 do mini-CRUD de perfil aprovados (humano)
- [ ] Landing + Onboarding + Settings smoke OK (iOS + Android API 24)
- [ ] Onboarding reusa serviços F1/F2 (zero duplicação) — verificado em review
- [ ] `validate:agent` web 100% green pós-G3
- [ ] Migrations aplicadas via MCP + validadas
- [ ] PR-mãe mergeado em main
- [ ] DEVFLOW C5: APs/Rs novos + journal; `createProfileRepository` registrado no MASTER §12
- [ ] MASTER_PLAN + INDEX atualizados (cross-ref desta spec)
- [ ] `/devflow distill` pós-fase

---

## Evolução Futura (backlog — fora da v1)
- **Perfil V2 — foto de avatar**: `avatar_url` + Supabase Storage; Avatar Picker (tirar foto / galeria / usar iniciais; sem "remover foto"); camera badge. Mocks: `mock-perfil-editar-v2*`, `mock-perfil-preenchido-v2-fotoavatar`, sheets `v2-sheet-foto/iniciais`.
- **Exportar dados (LGPD)** e **Cartão de Emergência**: Fase 6 (linhas já presentes no Hub).

---

## Changelog
- **v1 — 2026-05-23**: Spec criada. Escopo ampliado vs MASTER original (que previa só Perfil): incorpora **Landing revisada** + **Onboarding guiado** (aha moment, reuso F1/F2) por decisão do PO. Mini-CRUD de perfil segue G1/G2/G3 (`createProfileRepository`); landing/onboarding/settings = UI/auth sem extract. Fundamentada no HANDOFF designer §2.4 + mocks `export/fase-4/`.

---

## Cross-References
- ⬆️ [MASTER_PLAN_HIBRIDO_EVOLUCAO_CRUD.md](MASTER_PLAN_HIBRIDO_EVOLUCAO_CRUD.md) §9 Fase 4
- ⬅️ Fase anterior: [EXEC_SPEC_FASE3_ESTOQUE.md](EXEC_SPEC_FASE3_ESTOQUE.md)
- ➡️ Próxima fase: [EXEC_SPEC_FASE5_ANALITICAS.md](EXEC_SPEC_FASE5_ANALITICAS.md)
- 📐 SQP v2.0 + delegação: [INDEX_EXEC_SPECS.md](INDEX_EXEC_SPECS.md)
- 🎨 Mocks: `MOCKS_APP_CRUD/export/fase-4/` · Handoff `dosiq-mocks/HANDOFF_FASE_4_EM_DIANTE.md` §2.4
