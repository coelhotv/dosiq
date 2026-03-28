# Wave 10 — Perfil Hub, Histórico Calendar-Driven & Settings Extraction

**Status:** 🚀 EM PROGRESSO — Wave 10A ✅ ENTREGUE (2026-03-27) | Wave 10B ✅ ENTREGUE (2026-03-27)
**Data de criação:** 2026-03-27
**Dependências:** W0-W9 ✅ (todos mergeados em main)
**Risco:** MÉDIO — inclui migração de dados (localStorage → Supabase) e mudança de paradigma de navegação no Histórico (infinite scroll → calendar-driven)

### Sub-Wave Status:
- **10A — Settings Extraction:** ✅ ENTREGUE (PR #435 mergeada em main, commit 50a0665, 2026-03-27)
- **10B — Profile Hub:** ✅ ENTREGUE (PR #436 mergeada em main, commit 9d4141b, 2026-03-27)
- **10C — Histórico Calendar-Driven:** ⏳ ROADMAP (Wave 10C)

---

## Por que esta wave existe

A Wave 9 entregou a estrutura visual do Perfil (sidebar + seções + links), mas o resultado ficou aquém da visão de produto. O designer criou novos mocks de referência (6 telas: perfil, histórico, settings — desktop + mobile) que elevam significativamente a experiência em três áreas:

1. **Perfil como Hub** — O perfil atual é uma lista de links organizada em seções. O mock propõe um hub centralizado com dados do paciente em destaque, Cartão de Emergência visual, e grid de ferramentas de gestão.

2. **Histórico Calendar-Driven** — O histórico atual usa scroll infinito (Virtuoso) que tem usabilidade prejudicada com milhares de registros. O mock propõe navegação pelo calendário como controle principal: clicar no dia → ver doses daquele dia → clicar na dose para detalhes/edição.

3. **Settings como View Separada** — Configurações vivem hoje dentro do Perfil (seção "Configurações"). O mock propõe uma view independente acessada via ícone ⚙️ no header do Perfil, com cards agrupados por função.

**Pergunta central de cada área:**
- Perfil: *"Quem sou eu neste sistema e o que posso acessar?"*
- Histórico: *"O que aconteceu em tal dia?"*
- Settings: *"Como personalizar minha experiência?"*

---

## Escopo Consolidado — O que ENTRA vs. O que FICA DE FORA

### ✅ ENTRA

#### Perfil (Wave 10B)
- Avatar com iniciais (sem upload de foto — evitar custos de storage)
- Nome, idade, tipo sanguíneo, localização — exibidos no header do perfil
- Cartão de Emergência como card visual com QR code, alergias, condições, contato
- Modo Consulta como card descritivo (link para ConsultationView, que continua como view separada)
- Grid "Ferramentas de Gestão": Relatório PDF (modal), Histórico de Doses (view), Exportar Dados (modal)
- "Editar Perfil" — formulário para campos pessoais persistidos no Supabase
- Migração de dados de perfil: localStorage (Emergency) → `user_settings` no Supabase (novas colunas)

#### Histórico (Wave 10C)
- KPI cards no topo: adesão 30d, sequência atual, doses/mês
- Calendário como controle principal de navegação (manter comportamento atual: nav por dia/mês, dots nos dias com registro)
- Painel "doses do dia selecionado" — substituir infinite scroll por visualização por dia
- Click em dose individual → detalhes/edição/deleção (reutilizar funcionalidade existente do scroll infinito - Virtuoso)
- Gráfico de adesão 30d melhorado (apenas modo Complex/Carlos)
- Padrão por período: modo Simples = períodos consolidados | modo Complex = drilldown por dia da semana (heatmap atual)

#### Settings (Wave 10A)
- View separada (full, com back → profile)
- Acesso via ícone ⚙️ no header do ProfileRedesign
- Telegram: botão Conectar (gerar token) / botão Desconectar (sem toggle)
- Densidade da interface com descrição do que cada modo faz + respeitar auto-detection existente
- Alterar Senha (lógica existente)
- Admin DLQ com badge "ACESSO RESTRITO" (lógica existente)
- Logout + versão do app no footer

### ❌ FICA DE FORA

| Item | Motivo |
|------|--------|
| Upload de avatar/foto | Custo de infra (S3/storage) |
| Seção Arquivos & Documentos | Complexidade de manter histórico de PDFs para re-download |
| Compartilhamento / Modo Cuidador | Placeholder roadmap Q3 2026 |
| Info do médico no footer | Erro de design; FAB de dose manual já existe |
| Dots por período no calendário | Manter comportamento atual do calendário |
| Timeline/listagem infinita de doses | Usabilidade ruim com milhares de registros |
| Filtros no histórico | Desnecessários sem listagem infinita |
| Dica de Saúde (card) | Escopo desnecessário |
| Biometria (FaceID/Digital) | Backlog |
| Modo Escuro | Backlog (existe hoje, removido do redesign) |

---

## Sub-Waves: Ordem de Execução

### Wave 10A — Settings Extraction
**Status:** ✅ ENTREGUE (2026-03-27)
**Prioridade:** 1ª (menor escopo, desbloqueia Profile)
**Estimativa:** ~150-200 linhas JSX + ~250 linhas CSS
**Spec detalhada:** `WAVE_10A_SETTINGS_EXTRACTION.md`
**Merge:** PR #435 → commit 50a0665 (squash merge)

**Escopo:**
1. Criar `SettingsRedesign.jsx` como view independente
2. Extrair handlers de settings do ProfileRedesign (Telegram, Densidade, Senha, Admin DLQ, Logout)
3. Layout por cards/seções conforme mock: Integrações, Preferências, Segurança, Área Admin
4. Adicionar ícone ⚙️ (lucide `Settings`) no header do ProfileRedesign
5. Nova rota `settings` no App.jsx com back → profile (apenas redesign)
6. Footer: "Sair da Conta" + versão do app (`package.json version`)
7. Densidade com descrição dos modos + indicação de modo atual (auto-detectado vs. manual)

**O que NÃO muda:** Views originais (Profile.jsx), lógica de negócio, schemas, banco de dados.

---

### Wave 10B — Profile Hub + Migração de Dados
**Status:** ✅ ENTREGUE (2026-03-27)
**Prioridade:** 2ª (depende de 10A para Settings estar fora do Profile)
**Estimativa:** ~300-400 linhas JSX + ~400 linhas CSS + migration SQL
**Spec detalhada:** `WAVE_10B_PROFILE_HUB.md`
**Merge:** PR #436 → commit 9d4141b (squash merge)

**Escopo:**
1. Rewrite de ProfileRedesign.jsx como hub centralizado (eliminar sidebar de seções)
2. Header do perfil: iniciais, nome, idade, tipo sanguíneo, localização, botão "Editar Perfil"
3. Cartão de Emergência: card visual com QR, alergias, condições, contato de emergência
4. Modo Consulta: card descritivo com navegação para ConsultationView
5. Grid "Ferramentas de Gestão": Relatório PDF, Histórico de Doses, Exportar Dados
6. **Migração de dados e correção de dívida técnica:**
   - **Criar coluna `emergency_card` JSONB** em `user_settings` — coluna nunca foi criada no banco apesar de o `emergencyCardService` ter código completo para usá-la. Dados vivem apenas em localStorage desde sempre.
   - Adicionar colunas `display_name`, `birth_date`, `city`, `state` em `user_settings`
   - Sync one-time: dados de emergência em localStorage → Supabase (no load do Profile Hub)
   - Formulário "Editar Perfil" grava diretamente no Supabase
7. Layout responsivo: hub centralizado (mobile) / hub com cards lado a lado (desktop)

**Decisão arquitetural — Persistência de perfil:**
- Dados pessoais (nome, idade, cidade) → novas colunas em `user_settings` (tipados, indexáveis)
- Dados de saúde (blood_type, allergies, contacts) → coluna `emergency_card` JSONB (a ser criada — emergencyCardService já tem write-through implementado, zero mudança de código)
- Formulário "Editar Perfil" grava colunas de perfil; cartão de emergência continua editável pela Emergency view
- Migração de localStorage → Supabase: one-time sync no primeiro load do novo Profile

---

### Wave 10C — Histórico Calendar-Driven
**Prioridade:** 3ª (maior escopo, maior risco, maior recompensa UX)
**Estimativa:** ~400-500 linhas JSX + ~350 linhas CSS
**Spec detalhada:** `WAVE_10C_HISTORICO_CALENDAR.md` ✅

**Escopo:**
1. KPI cards no topo: adesão 30d (%), sequência atual (dias), doses este mês (X/Y)
2. Calendário como controle principal (manter componente existente, promover a "driver" da view)
3. Painel "doses do dia selecionado":
   - Desktop: painel lateral ao lado do calendário
   - Mobile: seção abaixo do calendário
   - Lista de doses do dia com hora, medicamento, status (no horário / atrasado / pendente)
4. Click em dose → expand inline ou modal com detalhes + edição (reutilizar lógica existente)
5. Modo Simples (Dona Maria): KPIs + calendário + doses do dia. Sem gráfico, sem padrão por período.
6. Modo Complex (Carlos): tudo acima + gráfico adesão 30d (Recharts melhorado com tooltip) + padrão por período com drilldown por dia da semana
7. Eliminar dependência de Virtuoso/infinite scroll no redesign (dados carregados por mês selecionado)

**Decisão arquitetural — Calendar-driven vs. Infinite Scroll:**
- O calendário já existe e funciona para navegação por dia/mês
- A mudança é promovê-lo de "acessório visual" para "controle principal de navegação"
- Dados carregados por mês (query com range de datas) — elimina problema de performance com milhares de registros
- A funcionalidade de edição de dose individual já existe no componente atual (Virtuoso) — precisa ser extraída e reutilizada no novo fluxo
- O componente HealthHistory original continua intacto (fallback quando redesign desligado)

---

## Personas e Densidade

O sistema de densidade (useComplexityMode) continua funcionando como hoje:

| Modo | Threshold | Persona | O que muda na Wave 10 |
|------|-----------|---------|----------------------|
| `simple` | ≤3 medicamentos ativos | Dona Maria | Perfil limpo, Histórico só KPI+calendário+doses |
| `complex` | 4+ medicamentos | Carlos | Histórico com gráfico 30d + padrão por período |

**Na Settings (10A):** O controle de densidade deve:
1. Mostrar o modo atual (auto-detectado) com explicação: "Baseado nos seus X protocolos ativos"
2. Permitir override manual com descrição de cada opção:
   - **Simples:** "Textos maiores e foco no essencial" (≈ mock)
   - **Complexo:** "Gráficos detalhados e visões técnicas" (≈ mock)
   - **Automático:** "Ajusta automaticamente baseado nos seus tratamentos"
3. Quando em override manual, mostrar indicação visual de que não está em auto

---

## Impacto em Arquivos Existentes

### Arquivos CRIADOS (por sub-wave)

**10A:**
- `src/views/redesign/SettingsRedesign.jsx`
- `src/views/redesign/settings/SettingsRedesign.css`

**10B:**
- Rewrite de `src/views/redesign/ProfileRedesign.jsx` (arquivo existente, reescrito)
- Possível: `src/views/redesign/profile/ProfileCardRedesign.jsx` (card de emergência)
- Possível: `src/views/redesign/profile/ProfileToolsGrid.jsx` (grid de ferramentas)
- Migration SQL em `docs/migrations/`

**10C:**
- `src/views/redesign/HealthHistoryRedesign.jsx` (rewrite — hoje é wrapper CSS-only)
- `src/views/redesign/history/HistoryKPICards.jsx`
- `src/views/redesign/history/HistoryDayPanel.jsx`
- `src/views/redesign/history/HistoryRedesign.css`

### Arquivos MODIFICADOS

**10A:**
- `src/views/redesign/ProfileRedesign.jsx` — remover seção Settings, adicionar ícone ⚙️
- `src/App.jsx` — adicionar rota `settings` com branching redesign

**10B:**
- `src/views/redesign/ProfileRedesign.jsx` — rewrite completo
- `src/views/redesign/profile/ProfileRedesign.css` — rewrite completo
- `src/views/redesign/profile/ProfileHeaderRedesign.jsx` — adaptar para hub layout

**10C:**
- `src/views/redesign/HealthHistoryRedesign.jsx` — de wrapper CSS para componente completo
- `src/views/redesign/HealthHistoryRedesign.css` — rewrite

### Arquivos NUNCA TOCADOS
- `src/views/Profile.jsx` (original)
- `src/views/HealthHistory.jsx` (original)
- `src/views/Emergency.jsx` (original)
- `src/features/dashboard/hooks/useComplexityMode.js` (original — usar nas views redesign diretamente, sem criar hook separado a menos que necessário)
- Qualquer service ou schema existente (exceto migration SQL na 10B)

---

## Referência Visual

Mocks de referência (designs aspiracionais, não spec pixel-perfect):
- `plans/redesign/references/perfil-desktop.png`
- `plans/redesign/references/perfil-mobile.png`
- `plans/redesign/references/historico-desktop.png`
- `plans/redesign/references/historico-mobile.png`
- `plans/redesign/references/config-desktop.png`
- `plans/redesign/references/config-mobile.png`

---

## Critérios de Conclusão (Wave 10 completa)

### Wave 10A ✅ CONCLUÍDA
- [x] Settings é view separada, acessada via ⚙️ no header do Perfil
- [x] Integrações Telegram: gerar token, conectar/desconectar
- [x] Preferências: controle de densidade (3 modos: Padrão/Automático/Detalhado)
- [x] Segurança: alterar senha com validação Zod (authSchema.js)
- [x] Área Administrativa: acesso a DLQ (condicional via telegram_chat_id)
- [x] Logout + versão do app no footer
- [x] ProfileRedesign limpeza: removido Settings, adicionado ⚙️ gear icon
- [x] App.jsx integração: lazy loading com Suspense + ViewSkeleton
- [x] ESLint 0 errors, todos testes passam (546 passed)
- [x] Layout responsivo: mobile (<768px back button) + desktop (max-width 640px)
- [x] Santuário design system: CSS vars + scope .sr-*
- [x] Código review Gemini: 4 issues avaliadas, HIGH security fix + 3 refactors aplicadas

### Wave 10B ⏳ PLANEJADO
- [ ] Perfil é hub centralizado com dados do paciente, Cartão de Emergência, e Ferramentas
- [ ] Dados de perfil persistidos no Supabase (não mais só localStorage)
- [ ] Migration: emergency_card JSONB + profile fields (display_name, birth_date, city, state)
- [ ] Editar Perfil: formulário com sync para Supabase

### Wave 10C ⏳ PLANEJADO
- [ ] Histórico navega por calendário (click dia → doses do dia)
- [ ] KPI cards: adesão 30d, sequência, doses/mês
- [ ] Modo Simples vs Complex funciona no Histórico (gráfico + padrão por período só no Complex)
- [ ] Scroll infinito (Virtuoso) eliminado do redesign do Histórico

### Wave 10 Geral
- [x] Todas as funcionalidades existentes preservadas (Emergency, Consulta, PDF, Export, Telegram, Senha)
- [ ] Views originais intactas (fallback quando redesign desligado)
