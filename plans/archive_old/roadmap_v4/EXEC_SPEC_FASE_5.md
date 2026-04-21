# Spec de Execução — Fase 5: Valor Clínico e Portabilidade

**Versão:** 1.0
**Data:** 24/02/2026
**Tipo:** Especificação de Execução para Agente Orquestrador
**Baseline:** v3.0.0 (Fase 4 + pós-Fase 4 concluídas)
**Escopo:** 68 SP, 10 features, 4 sprints, ~49 tarefas atômicas
**Referências:** `PRD_FASE_5_ROADMAP_2026.md`, `.memory/rules.md`, `.memory/anti-patterns.md`

---

## Índice

1. [Papéis dos Agentes](#1-papéis-dos-agentes)
2. [Regras Obrigatórias (Pré-Voo)](#2-regras-obrigatórias-pré-voo)
3. [Lições do Post-Mortem (Sprint 7)](#3-lições-do-post-mortem-sprint-7)
4. [Estrutura de Sprints](#4-estrutura-de-sprints)
5. [Sprint 5.1 — Fundação & Calendário](#5-sprint-51--fundação--calendário)
6. [Sprint 5.2 — Pipeline de Exportação](#6-sprint-52--pipeline-de-exportação)
7. [Sprint 5.3 — Compartilhamento & Inteligência](#7-sprint-53--compartilhamento--inteligência)
8. [Sprint 5.4 — Analytics Avançado](#8-sprint-54--analytics-avançado)
9. [Quality Gates](#9-quality-gates)
10. [Mapa de Dependências](#10-mapa-de-dependências)
11. [Pontos de Integração](#11-pontos-de-integração)
12. [Mitigação de Riscos](#12-mitigação-de-riscos)
13. [Protocolo de Validação](#13-protocolo-de-validação)
14. [Estratégia de Rollback](#14-estratégia-de-rollback)
15. [Novos Diretórios e Arquivos](#15-novos-diretórios-e-arquivos)
16. [Checklist do Orquestrador](#16-checklist-do-orquestrador)

---

## 1. Papéis dos Agentes

### 🔨 Coder (Agente de Codificação)

| Aspecto | Especificação |
|---------|--------------|
| **Pré-voo** | LER `.memory/rules.md` + `.memory/anti-patterns.md` ANTES de qualquer código (R-065) |
| **Duplicatas** | Executar `find src -name "*NomeArquivo*" -type f` antes de criar/modificar qualquer arquivo (R-001) |
| **Branches** | `feature/fase-5/{nome-da-feature}` |
| **Hook order** | States → Memos → Effects → Handlers (R-010) |
| **Datas** | SEMPRE `parseLocalDate()`, NUNCA `new Date('YYYY-MM-DD')` (R-020) |
| **Zod enums** | Em português (R-021) |
| **JSDoc** | Em português (R-050) |
| **Código** | Em inglês |
| **Commits** | Semânticos, em português (`feat(calendar): adicionar calendário visual`) |
| **Validação** | `npm run validate:agent` antes de push (R-074) |
| **PRs** | Criar PR mas NUNCA dar merge no próprio PR (R-060) |
| **Imports** | Usar path aliases (`@features`, `@shared`, `@schemas`, etc.) |

### 🧪 Tester (Agente de Testes)

| Aspecto | Especificação |
|---------|--------------|
| **Pré-voo** | Mesmo do Coder — ler `.memory/rules.md` + `.memory/anti-patterns.md` (R-065) |
| **Framework** | Vitest + @testing-library/react |
| **Max linhas** | Arquivo de teste ≤ 300 linhas — dividir por escopo se necessário (R-079, AP-T05) |
| **Cleanup** | `afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers(); })` (R-078) |
| **Mocks** | `vi.mock('caminho')` no nível do módulo, ANTES dos imports (R-071) |
| **Timers** | `vi.useFakeTimers()` para testes dependentes de tempo (R-073) |
| **Promises** | Resolver em `finally` block (R-072) |
| **Async** | Usar `waitFor(() => expect(...))`, NUNCA `setTimeout` em `act()` (R-070, AP-T06) |
| **localStorage** | Verificar `NODE_ENV === 'test'` — não usar em testes (R-076) |
| **Validação** | `npm run validate:agent` para verificar (R-074) |

### 🚀 DevOps (Agente de Infraestrutura)

| Aspecto | Especificação |
|---------|--------------|
| **vercel.json** | Novos rewrites ANTES do catch-all `/(.*)`  (R-040) |
| **Env vars** | Validar existência + fornecer fallbacks (R-083, R-088) |
| **Merge** | Revisar e mergear PRs APÓS review do Gemini Code Assist (R-060) |
| **Merge flag** | `--no-ff` (preservar histórico) |
| **Cleanup** | Deletar branch após merge |
| **Dependências** | Verificar build após adicionar dependências |

### 📝 Docs (Agente de Documentação)

| Aspecto | Especificação |
|---------|--------------|
| **CHANGELOG** | Atualizar por sprint |
| **README** | Atualizar com novas features |
| **Memory** | Adicionar novas regras a `.memory/rules.md` se descobertas durante execução |
| **Release** | Criar `RELEASE_NOTES` ao final da Fase 5 |

---

## 2. Regras Obrigatórias (Pré-Voo)

**TODO agente DEVE ler estes arquivos antes de iniciar qualquer tarefa:**

```
.memory/rules.md          → 89 regras (R-001 a R-089)
.memory/anti-patterns.md  → 32 anti-patterns (AP-001 a AP-S09)
```

### Regras Críticas para Fase 5

| Regra | Descrição | Impacto na Fase 5 |
|-------|-----------|-------------------|
| R-001 | Checar duplicatas antes de modificar | Novos arquivos em `src/features/` |
| R-010 | Hook order: States → Memos → Effects → Handlers | Todos os novos componentes |
| R-020 | `parseLocalDate()` não `new Date()` | Calendário, prescrições, custos |
| R-021 | Zod enums em português | Emergency card schema, interaction schema |
| R-040 | Rewrites antes do catch-all no vercel.json | API de compartilhamento (F5.3) |
| R-042 | Endpoint service_role DEVE ter autenticação | API de compartilhamento (F5.3) |
| R-060 | Code agent NUNCA mergeia próprio PR | Todos os PRs |
| R-065 | Ler memory antes de codificar | Todos os agentes |
| R-074 | `npm run validate:agent` obrigatório | Antes de todo push |
| R-082 | Zod ↔ SQL sincronizados | Emergency card se usar Supabase |
| R-083 | Fallbacks para env vars | `BLOB_READ_WRITE_TOKEN` |
| R-086 | `res.status(code).json(body)` no Vercel | `api/share.js` |
| R-087 | Logging estruturado desde dia 1 | Todos os endpoints e serviços |

### Anti-Patterns Mais Relevantes

| Anti-Pattern | Prevenção |
|-------------|-----------|
| AP-005: `new Date('YYYY-MM-DD')` | Importar `parseLocalDate` de `@utils/dateUtils` |
| AP-010: `process.exit()` em serverless | Usar `throw new Error()` |
| AP-S05: `res.json()` estilo Express | Usar `res.status(200).json({})` |
| AP-S06: Logging "depois" | Logger estruturado no primeiro commit |
| AP-T02: Sem cleanup em testes | `afterEach` obrigatório |
| AP-T05: Arquivo de teste >300 linhas | Dividir por escopo |

---

## 3. Lições do Post-Mortem (Sprint 7)

O Sprint 7 (Integração Gemini) teve 5 issues CRITICAL e 4 HIGH. As lições a seguir DEVEM ser aplicadas na Fase 5:

| Lição | O que aconteceu | Como prevenir na Fase 5 |
|-------|-----------------|------------------------|
| **Schema drift** | Zod e SQL divergiram → 500 em INSERT | F5.8 (Emergency Card) armazena em localStorage + JSONB existente. Não criar tabelas novas sem Zod+SQL sincronizados |
| **Env vars ausentes** | `SUPABASE_URL` faltava no Vercel | `api/share.js` DEVE validar env vars no startup + usar fallback `process.env.X \|\| process.env.VITE_X` |
| **Auth faltando** | 403 Forbidden em blobs privados | Incluir `Authorization: Bearer ${token}` em toda requisição a Vercel Blob |
| **Logging insuficiente** | 45 min para identificar erros | Todo endpoint API novo (`api/share.js`) com logger estruturado desde o commit 1 |
| **Response format** | `res.json()` não funciona no Vercel | Padronizar `res.status(code).json(body)` em todo endpoint |
| **nullable vs optional** | Zod rejeitou `null` | Usar `.nullable().optional()` para campos que podem receber `null` |
| **Merge sem review** | Código com bugs foi mergeado | DevOps é o ÚNICO que mergeia, APÓS review do Gemini |
| **PRs de teste** | Arquivos de teste ficaram no repo | Nunca commitar arquivos temporários de teste manual |

---

## 4. Estrutura de Sprints

```
Sprint 5.1 ─ Fundação & Calendário (16 SP)
  ├── F5.4  Calendário Visual de Doses (8 SP)
  ├── F5.8  Cartão de Emergência offline (5 SP)
  └── F5.9  Rastreador de Prescrições (3 SP)
  └── ▓▓▓ GATE 5.1 ▓▓▓

Sprint 5.2 ─ Pipeline de Exportação (18 SP)
  ├── F5.2  Exportação CSV/JSON (5 SP)
  └── F5.1  Relatórios PDF com Gráficos (13 SP)
  └── ▓▓▓ GATE 5.2 ▓▓▓

Sprint 5.3 ─ Compartilhamento & Inteligência (16 SP)
  ├── F5.3  Compartilhamento via Link (5 SP)
  ├── F5.7  Modo Consulta Médica (8 SP)
  └── F5.5  Notificações Proativas de Estoque (3 SP)
  └── ▓▓▓ GATE 5.3 ▓▓▓

Sprint 5.4 ─ Analytics Avançado (18 SP)
  ├── F5.10 Análise de Custo (5 SP)
  └── F5.6  Alertas de Interação Medicamentosa (13 SP)
  └── ▓▓▓ GATE 5.4 ▓▓▓

Finalização ─ Docs + Deploy + Smoke Test
```

---

## 5. Sprint 5.1 — Fundação & Calendário

**Escopo:** 16 SP | **Features:** F5.4, F5.8, F5.9
**Justificativa:** Sem dependências externas, sem npm novo, reutiliza infra existente (Calendar, PWA cache, protocolSchema.end_date).

---

### F5.4 — Calendário Visual de Doses (8 SP)

**Branch:** `feature/fase-5/calendario-visual`

#### Tarefa F5.4-1: DoseCalendar Service

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Input** | `src/utils/adherenceLogic.js` (funções `getDailyDoseRate`, `isProtocolActiveOnDate`), `src/shared/services/api/logService.js`, `src/features/protocols/services/protocolService.js` |
| **Output** | `src/features/calendar/services/doseCalendarService.js` |
| **Descrição** | Função pura `calculateMonthlyDoseMap(logs, protocols, year, month)` que retorna mapa `{ 'YYYY-MM-DD': { expected, taken, status: 'completo'|'parcial'|'perdido'|'sem_doses' } }` |
| **Critérios de aceite** | (1) Usa `parseLocalDate()` (R-020), (2) Trata `frequency: 'quando_necessario'` (expected=0), (3) Respeita `start_date`/`end_date` dos protocolos, (4) Considera tolerância de 2h, (5) JSDoc em português |
| **Arquivos criar** | `src/features/calendar/services/doseCalendarService.js` |
| **Dependências** | Nenhuma |

#### Tarefa F5.4-2: DoseCalendar Component

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Input** | `src/shared/components/ui/Calendar.jsx`, `doseCalendarService.js` (F5.4-1) |
| **Output** | `src/features/calendar/components/DoseCalendar.jsx` + `DoseCalendar.css` |
| **Descrição** | Componente que usa Calendar existente com props `enableLazyLoad`, `enableSwipe`, `enableMonthPicker`. Adiciona dots coloridos por status do dia. Click no dia abre painel de detalhe com status por protocolo. |
| **Critérios de aceite** | (1) Verde (#10b981)=completo, Âmbar (#f59e0b)=parcial, Vermelho (#ef4444)=perdido, Cinza (#6b7280)=sem_doses/futuro, (2) Click no dia abre detalhe, (3) Usa `useDashboardContext()` para dados, (4) Framer Motion para animação do painel, (5) Responsivo ≥320px, (6) Hook order correto (R-010) |
| **Arquivos criar** | `src/features/calendar/components/DoseCalendar.jsx`, `src/features/calendar/components/DoseCalendar.css` |
| **Dependências** | F5.4-1 |

#### Tarefa F5.4-3: Integração na Navegação

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Input** | `src/App.jsx`, `src/views/Dashboard.jsx` |
| **Output** | Novo case `'calendar'` em `App.jsx`, novo `src/views/Calendar.jsx`, CTA no Dashboard |
| **Descrição** | Adicionar `case 'calendar':` no switch de `renderCurrentView()` em `App.jsx`. Criar view wrapper `Calendar.jsx`. Adicionar CTA "Calendário" no Dashboard (via `QuickActionsWidget` ou seção existente). Tracker de analytics: `analyticsService.track('calendar_view_opened')`. |
| **Critérios de aceite** | (1) Navegação funciona via Dashboard CTA, (2) Lazy import do componente se possível, (3) Evento de analytics trackeado |
| **Arquivos criar** | `src/views/Calendar.jsx` |
| **Arquivos modificar** | `src/App.jsx`, `src/views/Dashboard.jsx` |
| **Dependências** | F5.4-2 |

#### Tarefa F5.4-T1: Testes do DoseCalendar Service

| Campo | Valor |
|-------|-------|
| **Agente** | Tester |
| **Output** | `src/features/calendar/services/__tests__/doseCalendarService.test.js` |
| **Cenários** | (1) Sem protocolos, (2) Protocolo diário único, (3) Múltiplos protocolos, (4) Dias alternados, (5) `quando_necessario`, (6) Protocolo com `end_date` no meio do mês, (7) `start_date` no meio do mês |
| **Regras** | `parseLocalDate()` nos dados de teste, cleanup em `afterEach`, arquivo ≤300 linhas |
| **Dependências** | F5.4-1 |

#### Tarefa F5.4-T2: Testes do DoseCalendar Component

| Campo | Valor |
|-------|-------|
| **Agente** | Tester |
| **Output** | `src/features/calendar/components/__tests__/DoseCalendar.test.jsx` |
| **Cenários** | (1) Renderiza mês correto, (2) Cores correspondem ao status, (3) Click no dia abre detalhe, (4) Navegação entre meses |
| **Regras** | Mock `useDashboardContext` e `doseCalendarService` no nível do módulo, cleanup obrigatório |
| **Dependências** | F5.4-2 |

---

### F5.8 — Cartão de Emergência Offline (5 SP)

**Branch:** `feature/fase-5/cartao-emergencia`

#### Tarefa F5.8-1: Schema do Cartão de Emergência

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | `src/schemas/emergencyCardSchema.js` |
| **Descrição** | Schema Zod: `emergency_contacts` (array de `{name, phone, relationship}`), `allergies` (array de strings), `blood_type` (enum: `['A+','A-','B+','B-','AB+','AB-','O+','O-','desconhecido']`), `notes` (string), `last_updated` (datetime ISO). |
| **Critérios de aceite** | (1) Enums em português (R-021), (2) `.nullable().optional()` para campos opcionais (R-085), (3) Funções `validateEmergencyCard(data)` retornando `{ success, data?, errors? }`, (4) Segue padrão de `src/schemas/medicineSchema.js` |
| **Dependências** | Nenhuma — PODE ser paralelizado com F5.4-1 e F5.9-1 |

#### Tarefa F5.8-2: Emergency Card Service (Offline-First)

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Input** | `emergencyCardSchema.js` (F5.8-1) |
| **Output** | `src/features/emergency/services/emergencyCardService.js` |
| **Descrição** | Salva/carrega dados do cartão. Storage primário: `localStorage` (chave: `mr_emergency_card`). Storage secundário: Supabase `user_settings` tabela (JSONB). Estratégia: write-through (localStorage + Supabase), read: localStorage first → fallback Supabase. |
| **Critérios de aceite** | (1) `save(data)`: valida com schema → salva localStorage + Supabase, (2) `load()`: localStorage first → Supabase fallback, (3) `getOfflineCard()`: SOMENTE localStorage, (4) Verifica `NODE_ENV === 'test'` para localStorage (R-076), (5) Log estruturado (R-087) |
| **Dependências** | F5.8-1 |

#### Tarefa F5.8-3: Componentes do Cartão de Emergência

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Input** | `emergencyCardService.js`, componentes UI existentes (`Button`, `Card`, `Modal`) |
| **Output** | `src/features/emergency/components/EmergencyCardForm.jsx`, `EmergencyCardView.jsx`, `EmergencyCard.css` |
| **Descrição** | **Form**: formulário de edição (contatos, alergias, tipo sanguíneo). **View**: modo read-only com fontes grandes, alto contraste, auto-popula medicamentos ativos de `useDashboardContext()`. Indicador offline quando sem rede. |
| **Critérios de aceite** | (1) Form segue padrões existentes (inputs controlados, validação Zod no submit), (2) View: texto legível, medicamentos auto-populados, (3) Indicador offline, (4) Hook order correto (R-010) |
| **Dependências** | F5.8-2 |

#### Tarefa F5.8-4: Integração na Navegação

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Input** | `src/App.jsx`, `src/views/Settings.jsx` |
| **Output** | Novo case `'emergency'` em `App.jsx`, novo `src/views/Emergency.jsx`, link em Settings |
| **Critérios de aceite** | (1) Acessível via Settings ("Cartão de Emergência"), (2) Funciona offline (lê de localStorage) |
| **Dependências** | F5.8-3 |

#### Tarefa F5.8-T1: Testes do Emergency Card

| Campo | Valor |
|-------|-------|
| **Agente** | Tester |
| **Output** | `src/schemas/__tests__/emergencyCardSchema.test.js`, `src/features/emergency/services/__tests__/emergencyCardService.test.js` |
| **Cenários schema** | Dados válidos passam, telefone inválido rejeita, campos obrigatórios faltando |
| **Cenários service** | Save/load round-trip, offline-first lógica, fallback Supabase |
| **Regras** | Mock Supabase no nível do módulo, DOIS arquivos separados (≤300 linhas cada) |
| **Dependências** | F5.8-1, F5.8-2 |

---

### F5.9 — Rastreador de Prescrições (3 SP)

**Branch:** `feature/fase-5/controle-receitas`

#### Tarefa F5.9-1: Prescription Service

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | `src/features/prescriptions/services/prescriptionService.js` |
| **Descrição** | Funções puras: `getPrescriptionStatus(protocol)` → `{ status: 'vigente'|'vencendo'|'vencida', daysRemaining }`. `getExpiringPrescriptions(protocols, thresholdDays=30)` → filtra protocolos próximos do vencimento. |
| **Critérios de aceite** | (1) Usa `parseLocalDate()` (R-020), (2) `end_date: null` = sempre 'vigente', (3) Status em português (R-021), (4) Funções puras sem side effects |
| **Dependências** | Nenhuma — PODE ser paralelizado com F5.4-1 e F5.8-1 |

#### Tarefa F5.9-2: Integração no SmartAlerts

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Input** | `prescriptionService.js`, `src/views/Dashboard.jsx`, `SmartAlerts` |
| **Output** | Dashboard.jsx modificado para incluir alertas de prescrição |
| **Descrição** | Quando `end_date` de um protocolo está a ≤30 dias: alerta "warning" no SmartAlerts. Quando vencido: alerta "critical". Ação: "Renovar" navega para protocols view. |
| **Critérios de aceite** | (1) Formato segue padrão SmartAlerts: `{ id, severity, title, message, actions }`, (2) ID baseado em `protocol_id + '_prescription'` (sem duplicatas), (3) Apenas protocolos com `end_date` preenchido |
| **Arquivos modificar** | `src/views/Dashboard.jsx` |
| **Dependências** | F5.9-1 |

#### Tarefa F5.9-T1: Testes do Prescription Service

| Campo | Valor |
|-------|-------|
| **Agente** | Tester |
| **Output** | `src/features/prescriptions/services/__tests__/prescriptionService.test.js` |
| **Cenários** | (1) Prescrição vigente, (2) Vencendo em 30 dias, (3) Vencendo em 7 dias, (4) Vencida, (5) `end_date: null` |
| **Dependências** | F5.9-1 |

---

### ▓▓▓ GATE 5.1 ▓▓▓

**Executor:** DevOps

| Check | Comando/Ação |
|-------|-------------|
| Todos os PRs passam validate:agent | `npm run validate:agent` em cada branch |
| Gemini Code Assist review completo | Verificar cada PR |
| Issues CRITICAL/HIGH resolvidos | Revisar comentários do Gemini |
| `validate:full` passa | `npm run validate:full` |
| Testes novos passando | Verificar cobertura ≥80% nos novos arquivos |
| Merge de todos os PRs do Sprint 5.1 | `git merge --no-ff`, deletar branches |

---

## 6. Sprint 5.2 — Pipeline de Exportação

**Escopo:** 18 SP | **Features:** F5.2, F5.1
**Justificativa:** Sequencial — CSV/JSON primeiro (cria infra de extração de dados), depois PDF (reutiliza).

---

### F5.2 — Exportação CSV/JSON (5 SP)

**Branch:** `feature/fase-5/exportacao-csv-json`

#### Tarefa F5.2-1: Export Service

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | `src/features/export/services/exportService.js` |
| **Descrição** | `exportAsJSON(options)` e `exportAsCSV(options)` com `{ dateRange, includeProtocols, includeLogs, includeStock, includeMedicines }`. CSV: separador ponto-e-vírgula, UTF-8 BOM, headers em português. Download via `URL.createObjectURL(blob)` + anchor click. |
| **Critérios de aceite** | (1) CSV com BOM para Excel, (2) JSON pretty-print, (3) Sanitização anti-injection (prefixar `=`, `+`, `-`, `@` com tab), (4) Trata datasets vazios (CSV só com headers), (5) `parseLocalDate()` para formatação (R-020), (6) Inclui `unit_price` no export de estoque |
| **Dependências** | Nenhuma |

#### Tarefa F5.2-2: Export UI Component

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Input** | `exportService.js`, componentes `Modal`, `Button` |
| **Output** | `src/features/export/components/ExportDialog.jsx`, `ExportDialog.css` |
| **Descrição** | Modal com seletor de formato (CSV/JSON), date range, checkboxes de tipos de dados, botão "Exportar". Acessível via Settings ("Exportar Dados"). |
| **Critérios de aceite** | (1) Usa Modal existente, (2) Analytics event no export, (3) Feedback visual de progresso |
| **Arquivos modificar** | `src/views/Settings.jsx` |
| **Dependências** | F5.2-1 |

#### Tarefa F5.2-T1: Testes do Export Service

| Campo | Valor |
|-------|-------|
| **Agente** | Tester |
| **Output** | `src/features/export/services/__tests__/exportService.test.js` |
| **Cenários** | (1) CSV com separador correto e BOM, (2) JSON estruturado, (3) Filtro por date range, (4) Dataset vazio, (5) Prevenção de formula injection |
| **Dependências** | F5.2-1 |

---

### F5.1 — Relatórios PDF com Gráficos (13 SP)

**Branch:** `feature/fase-5/relatorios-pdf`

#### Tarefa F5.1-0: Adicionar Dependência jsPDF

| Campo | Valor |
|-------|-------|
| **Agente** | DevOps |
| **Comando** | `npm install jspdf jspdf-autotable` |
| **Critérios de aceite** | (1) Em `dependencies` (não devDependencies — runtime), (2) `npm run build` passa, (3) Bundle size verificado |

#### Tarefa F5.1-1: Chart Renderer Service

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | `src/features/reports/services/chartRenderer.js` |
| **Descrição** | Gera gráficos como data URLs (base64 PNG) usando Canvas API puro. Funções: `renderAdherenceChart(data, width, height)` → bar chart de aderência diária. `renderStockChart(stockSummary, width, height)` → horizontal bars de dias restantes. |
| **Critérios de aceite** | (1) Canvas puro — sem lib de gráficos, (2) Cores consistentes com o tema do app, (3) Labels em português, (4) Funciona em browser context |
| **Dependências** | F5.1-0 |

#### Tarefa F5.1-2: PDF Generator Service

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Input** | jsPDF, jspdf-autotable, `chartRenderer.js`, `adherenceService.js` |
| **Output** | `src/features/reports/services/pdfGeneratorService.js` |
| **Descrição** | Gera PDF completo A4 com seções: (1) Cabeçalho, (2) Resumo de adesão, (3) Gráfico de tendência 30d, (4) Tabela de protocolos (autotable), (5) Resumo de estoque com gráfico, (6) Rodapé com disclaimer. Retorna Blob. |
| **Critérios de aceite** | (1) Formato A4 portrait, (2) `addImage()` para gráficos do chartRenderer, (3) Page breaks automáticos, (4) Tamanho <2MB, (5) Retorna Blob, (6) `parseLocalDate()` (R-020), (7) Logging de tempo de geração (R-087), (8) **LAZY LOAD**: `const { jsPDF } = await import('jspdf')` — não impactar bundle inicial de 762KB |
| **Dependências** | F5.1-1 |

#### Tarefa F5.1-3: Report Generation UI

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Input** | `pdfGeneratorService.js`, componentes UI existentes |
| **Output** | `src/features/reports/components/ReportGenerator.jsx`, `ReportGenerator.css` |
| **Descrição** | Componente com botão "Gerar Relatório", seletor de período, estado de loading, botão "Baixar". Acessível do Dashboard (CTA) e Settings. |
| **Critérios de aceite** | (1) Loading animation durante geração, (2) Error handling com mensagem amigável, (3) Nome do arquivo: `dosiq-relatorio-{periodo}-{data}.pdf`, (4) Analytics event trackeado |
| **Arquivos modificar** | `src/views/Settings.jsx`, `src/views/Dashboard.jsx` |
| **Dependências** | F5.1-2 |

#### Tarefa F5.1-T1: Testes do Chart Renderer

| Campo | Valor |
|-------|-------|
| **Agente** | Tester |
| **Output** | `src/features/reports/services/__tests__/chartRenderer.test.js` |
| **Cenários** | (1) Retorna string base64 válida, (2) Trata dados vazios, (3) Dimensões corretas |
| **Nota** | Mock canvas context (limitação jsdom) |
| **Dependências** | F5.1-1 |

#### Tarefa F5.1-T2: Testes do PDF Generator

| Campo | Valor |
|-------|-------|
| **Agente** | Tester |
| **Output** | `src/features/reports/services/__tests__/pdfGeneratorService.test.js` |
| **Cenários** | (1) Gera Blob, (2) Inclui todas as seções, (3) Trata dados vazios, (4) Disclaimer presente |
| **Nota** | Mock jsPDF no nível do módulo |
| **Dependências** | F5.1-2 |

---

### ▓▓▓ GATE 5.2 ▓▓▓

| Check | Verificação |
|-------|------------|
| CSV abre corretamente no Excel | Teste manual com LibreOffice/Excel |
| PDF gera com gráficos | Teste manual em Chrome, Safari, Firefox |
| jsPDF é lazy loaded | Verificar que bundle inicial não cresceu significativamente |
| `validate:full` passa | `npm run validate:full` |
| Merge de todos os PRs do Sprint 5.2 | DevOps |

---

## 7. Sprint 5.3 — Compartilhamento & Inteligência

**Escopo:** 16 SP | **Features:** F5.3, F5.7, F5.5
**Justificativa:** F5.3 depende de F5.1. F5.7 depende de F5.1 + F5.3. F5.5 é independente e pode ser paralelizado.

---

### F5.3 — Compartilhamento de Relatório via Link (5 SP)

**Branch:** `feature/fase-5/compartilhamento-relatorios`

#### Tarefa F5.3-1: Share API Endpoint

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | `api/share.js` |
| **Descrição** | Serverless function: `POST /api/share` recebe `{ blob: base64, filename, expiresInHours }`, faz upload para Vercel Blob com TTL, retorna `{ url, expiresAt }`. |
| **Critérios de aceite — POST-MORTEM DRIVEN** | (1) `res.status(code).json(body)` — NUNCA `res.json()` (R-086, AP-S05), (2) Autenticação via Supabase JWT no header Authorization (R-042), (3) Header `Authorization: Bearer ${BLOB_READ_WRITE_TOKEN}` para upload ao Blob (lição PM #3), (4) Validação de env vars no startup: `if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error(...)` (R-088, lição PM #2), (5) Fallback env vars: `process.env.SUPABASE_URL \|\| process.env.VITE_SUPABASE_URL` (R-083), (6) Logger estruturado desde commit 1 (R-087, lição PM #4), (7) Validação Zod do input (lição PM #6), (8) Max 5MB, default expiry 72h, (9) Sem `process.exit()` (R-041, AP-010) |

#### Tarefa F5.3-2: Vercel JSON Rewrite

| Campo | Valor |
|-------|-------|
| **Agente** | DevOps |
| **Input** | `vercel.json` |
| **Output** | Rewrite adicionado ANTES do catch-all `/(.*)`  (R-040) |
| **Critérios de aceite** | (1) `{ "source": "/api/share", "destination": "/api/share.js" }` na posição correta, (2) Function config: `"api/share.js": { "maxDuration": 30 }` |
| **PODE ser paralelizado** com F5.3-1 |

#### Tarefa F5.3-3: Share Service (Client)

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | `src/features/reports/services/shareService.js` |
| **Descrição** | Client-side: `shareReport(blob, options)` envia blob ao endpoint → retorna `{ url, expiresAt }`. `shareNative(url, title)` usa `navigator.share()`. `copyToClipboard(url)` fallback desktop. |
| **Dependências** | F5.3-1 |

#### Tarefa F5.3-4: Integração no ReportGenerator

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Input** | `ReportGenerator.jsx`, `shareService.js` |
| **Output** | Botão "Compartilhar" adicionado ao ReportGenerator |
| **Critérios de aceite** | (1) Botão ao lado de "Baixar", (2) Mostra link gerado com botão "Copiar", (3) Info de expiração visível, (4) Mobile: Web Share API, Desktop: clipboard |
| **Dependências** | F5.3-3 |

#### Tarefa F5.3-T1: Testes da Share API

| Campo | Valor |
|-------|-------|
| **Agente** | Tester |
| **Output** | `api/__tests__/share.test.js` |
| **Cenários** | (1) Upload com sucesso, (2) Sem auth rejeita (401), (3) Arquivo muito grande rejeita, (4) Formato inválido rejeita |
| **Nota** | Mock `@vercel/blob` no nível do módulo |
| **Dependências** | F5.3-1 |

---

### F5.7 — Modo Consulta Médica (8 SP)

**Branch:** `feature/fase-5/modo-consulta`

#### Tarefa F5.7-1: Consultation Data Service

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | `src/features/consultation/services/consultationDataService.js` |
| **Descrição** | Agrega todos os dados clínicos em formato pronto para consulta: medicamentos ativos com dosagens, aderência 30/90d, status de estoque, info de emergência, status de prescrições, titulações ativas. Retorna objeto estruturado único. |
| **Critérios de aceite** | (1) Sem chamadas Supabase — usa APENAS dados do cache/context, (2) `parseLocalDate()` (R-020), (3) Inclui `generatedAt` timestamp, (4) Reutiliza `prescriptionService` (F5.9) e `emergencyCardService` (F5.8) |
| **PODE ser paralelizado** com F5.5-1 |
| **Dependências** | F5.3-3 (precisa do shareService) |

#### Tarefa F5.7-2: Consultation Mode View

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | `src/features/consultation/components/ConsultationView.jsx`, `ConsultationView.css` |
| **Descrição** | Tela read-only otimizada para mostrar ao médico: (1) Header do paciente, (2) Tabela de medicamentos ativos, (3) Resumo de aderência, (4) Alertas de estoque, (5) Status de prescrições, (6) Progresso de titulação. Barra inferior com "Gerar PDF" e "Compartilhar". |
| **Critérios de aceite** | (1) Fontes grandes (mínimo 16px body), (2) Alto contraste (fundo branco, texto escuro), (3) Sem elementos interativos exceto PDF/Share/voltar, (4) Layout landscape-friendly, (5) Usa `useDashboardContext()`, (6) Framer Motion para transições |
| **Dependências** | F5.7-1 |

#### Tarefa F5.7-3: Integração na Navegação

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | Novo case `'consultation'` em `App.jsx`, novo `src/views/Consultation.jsx` |
| **Critérios de aceite** | (1) Acessível do Dashboard via "Modo Consulta" CTA, (2) Também em Settings, (3) Analytics event trackeado |
| **Arquivos modificar** | `src/App.jsx`, `src/views/Dashboard.jsx`, `src/views/Settings.jsx` |
| **Dependências** | F5.7-2 |

#### Tarefa F5.7-T1: Testes do Consultation Data Service

| Campo | Valor |
|-------|-------|
| **Agente** | Tester |
| **Output** | `src/features/consultation/services/__tests__/consultationDataService.test.js` |
| **Cenários** | (1) Agregação completa, (2) Dados parciais (sem emergency card), (3) Sem protocolos ativos |
| **Dependências** | F5.7-1 |

---

### F5.5 — Notificações Proativas de Estoque no Bot (3 SP)

**Branch:** `feature/fase-5/bot-estoque-proativo`

#### Tarefa F5.5-1: Lógica de Alerta Proativo

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Input** | `server/bot/tasks.js` (linhas ~630-706 — `checkUserStockAlerts`) |
| **Output** | `server/bot/tasks.js` modificado |
| **Descrição** | Estender `checkUserStockAlerts` com tier "proativo": estoque estimado para acabar em 8-14 dias → mensagem suave "Lembrete de reposição". Novo formatter `formatProactiveStockMessage(medicines)`. |
| **Critérios de aceite** | (1) Novo tipo `'proactive_stock_alert'` na deduplicação, (2) Segue padrão `formatStockAlertMessage`, (3) MarkdownV2 escapado (R-031), (4) Callback data <64 bytes (R-030), (5) Usa `shouldSendNotification` (R-032), (6) Logging estruturado (R-087) |
| **PODE ser paralelizado** com F5.7-1 |

#### Tarefa F5.5-T1: Testes do Alerta Proativo

| Campo | Valor |
|-------|-------|
| **Agente** | Tester |
| **Output** | `server/bot/__tests__/proactiveStockAlerts.test.js` |
| **Cenários** | (1) 14 dias dispara proativo, (2) 7 dias dispara existente, (3) 0 dispara crítico, (4) Deduplicação funciona |
| **Dependências** | F5.5-1 |

---

### ▓▓▓ GATE 5.3 ▓▓▓

| Check | Verificação |
|-------|------------|
| Links de compartilhamento funcionam | Teste manual: gerar PDF → compartilhar → abrir link |
| Modo Consulta renderiza dados completos | Teste manual em viewport mobile |
| Bot envia alertas proativos | Verificar logs do bot |
| `api/share.js` responde corretamente | `curl POST` manual |
| Env vars documentadas | DevOps verifica |
| `validate:full` passa | `npm run validate:full` |
| Merge | DevOps |

---

## 8. Sprint 5.4 — Analytics Avançado

**Escopo:** 18 SP | **Features:** F5.10, F5.6
**Justificativa:** Análise de custo é simples (reutiliza `unit_price`). Interação medicamentosa é a mais complexa e arriscada — fica por último para não desestabilizar features anteriores.

---

### F5.10 — Análise de Custo do Tratamento (5 SP)

**Branch:** `feature/fase-5/analise-custos`

#### Tarefa F5.10-1: Cost Analysis Service

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | `src/features/costs/services/costAnalysisService.js` |
| **Descrição** | (1) `getMonthlyCost(medicines, protocols, stocks)` → custo mensal total, (2) `getCostPerMedicine(medicineId, protocols, stocks)` → breakdown por medicamento, (3) `getCostProjection(months, ...)` → estimativa futura, (4) `getCostHistory(stocks, months)` → gastos reais de compras. |
| **Critérios de aceite** | (1) Usa `unit_price` existente (default 0 no schema), (2) Trata medicamentos sem preço ("Preço não informado"), (3) `parseLocalDate()` (R-020), (4) Formatação BRL: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`, (5) Funções puras |

#### Tarefa F5.10-2: Cost Dashboard Widget

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | `src/features/costs/components/CostWidget.jsx`, `CostWidget.css` |
| **Descrição** | Widget compacto no Dashboard: custo mensal total, expansível para breakdown por medicamento. Estado "Sem dados de preço" quando nenhum `unit_price` preenchido. |
| **Critérios de aceite** | (1) Formato de widget existente (StockAlertsWidget, InsightCard), (2) Usa `useDashboardContext()`, (3) Visível SOMENTE quando ≥1 medicamento tem `unit_price > 0` |
| **Arquivos modificar** | `src/views/Dashboard.jsx` |
| **Dependências** | F5.10-1 |

#### Tarefa F5.10-3: Cost Detail View

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | `src/features/costs/components/CostDetail.jsx`, `CostDetail.css`, `src/views/Costs.jsx` |
| **Descrição** | Página completa de análise de custos com gráfico de tendência mensal, breakdown por medicamento, projeção de custos, e exportação (reutiliza `exportService`). |
| **Critérios de aceite** | (1) Novo case `'costs'` em `App.jsx`, (2) Acessível do widget e de Settings |
| **Arquivos modificar** | `src/App.jsx` |
| **Dependências** | F5.10-2 |

#### Tarefa F5.10-T1: Testes do Cost Analysis Service

| Campo | Valor |
|-------|-------|
| **Agente** | Tester |
| **Output** | `src/features/costs/services/__tests__/costAnalysisService.test.js` |
| **Cenários** | (1) Cálculo com preços, (2) Sem preços, (3) Preço parcial, (4) Projeção futura, (5) Formatação BRL |
| **Dependências** | F5.10-1 |

---

### F5.6 — Alertas de Interação Medicamentosa (13 SP)

**Branch:** `feature/fase-5/interacoes-medicamentosas`

> ⚠️ **RISCO MAIS ALTO DA FASE 5** — Feature mais complexa, dados externos (ANVISA).
> Disclaimer obrigatório em TODAS as interfaces: "Consulte seu médico. Este alerta é informativo."

#### Tarefa F5.6-1: Base de Dados de Interações + Schema

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | `src/features/interactions/data/interactionDatabase.js`, `src/schemas/interactionSchema.js` |
| **Descrição** | **Schema Zod**: `{ drug_a, drug_b, severity: 'grave'\|'moderada'\|'leve', description, recommendation, source }`. **Database**: JSON estático com ≥100 interações comuns no Brasil. Lookup por princípio ativo (`active_ingredient` do `medicineSchema`). |
| **Critérios de aceite** | (1) Severidade em português (R-021): `['grave', 'moderada', 'leve']`, (2) Busca case-insensitive + accent-insensitive, (3) Fonte (source) em cada interação, (4) Arquivo <200KB (PWA cache), (5) Schema Zod valida cada entrada |

#### Tarefa F5.6-2: Interaction Check Service

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | `src/features/interactions/services/interactionService.js` |
| **Descrição** | `checkInteractions(medicines)` → cross-reference de `active_ingredient` contra database → retorna `[{ medicine1, medicine2, severity, description, source }]`. `checkNewMedicineInteractions(newMedicine, existingMedicines)` → verifica uma medicina nova contra existentes. |
| **Critérios de aceite** | (1) O(n²) aceitável (<20 medicamentos típico), (2) Trata `active_ingredient` ausente (skip, sem erro), (3) Deduplica A→B e B→A, (4) Retorna ordenado por severidade (grave primeiro), (5) Funções puras |
| **Dependências** | F5.6-1 |

#### Tarefa F5.6-3: Componentes de Alerta de Interação

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Input** | `interactionService.js`, `SmartAlerts`, `MedicineForm.jsx` |
| **Output** | `src/features/interactions/components/InteractionAlert.jsx`, `InteractionAlert.css`, `InteractionDetailModal.jsx` |
| **Descrição** | **Dashboard**: alertas integrados ao SmartAlerts com cores por severidade (grave=vermelho, moderada=laranja, leve=amarelo). **Modal de detalhe**: par de medicamentos, severidade, descrição, recomendação, fonte. **MedicineForm**: warning ao cadastrar medicamento com interações conhecidas. Dispensável pelo usuário. |
| **Critérios de aceite** | (1) Integra com SmartAlerts existente, (2) Modal com Framer Motion, (3) Warning no MedicineForm (dispensável), (4) Disclaimer em português em TODAS as interfaces |
| **Arquivos modificar** | `src/views/Dashboard.jsx`, `src/features/medications/components/MedicineForm.jsx` |
| **Dependências** | F5.6-2 |

#### Tarefa F5.6-T1: Testes do Interaction Service

| Campo | Valor |
|-------|-------|
| **Agente** | Tester |
| **Output** | `src/features/interactions/services/__tests__/interactionService.test.js` |
| **Cenários** | (1) Sem interações, (2) Interação única, (3) Múltiplas interações, (4) `active_ingredient` ausente, (5) Deduplicação A↔B, (6) Ordenação por severidade |
| **Dependências** | F5.6-2 |

#### Tarefa F5.6-T2: Testes da Base de Dados

| Campo | Valor |
|-------|-------|
| **Agente** | Tester |
| **Output** | `src/features/interactions/data/__tests__/interactionDatabase.test.js` |
| **Cenários** | (1) Schema validation de todas as entradas, (2) Sem chaves duplicadas, (3) Todas as interações têm source, (4) Severity values válidos |
| **Dependências** | F5.6-1 |

---

### ▓▓▓ GATE 5.4 ▓▓▓

| Check | Verificação |
|-------|------------|
| Análise de custo exibe dados reais | Teste com `unit_price` preenchido |
| Alertas de interação disparam | Teste com par de medicamentos conhecidos |
| MedicineForm mostra warning | Teste ao cadastrar medicamento conflitante |
| Disclaimer presente em todas as telas | Revisão visual |
| `validate:full` passa | `npm run validate:full` |
| **INTEGRAÇÃO COMPLETA da Fase 5** | Todas as 10 features funcionando juntas |
| Merge final | DevOps |

---

## 9. Quality Gates

Cada sprint tem 3 checkpoints obrigatórios:

### Gate 1: Revisão de Implementação (após Coder)

- [ ] Todos os PRs passam `npm run validate:agent` (lint + test:critical, 10-min kill)
- [ ] Zero warnings de lint novos
- [ ] Gemini Code Assist review completo em cada PR
- [ ] Issues CRITICAL e HIGH do Gemini resolvidos

### Gate 2: Cobertura de Testes (após Tester)

- [ ] Novos arquivos com ≥80% cobertura de linhas
- [ ] Todos os arquivos de teste ≤300 linhas
- [ ] `npm run validate:full` passa (lint + coverage + build)
- [ ] Sem leaks de teste (memória, timers, estado)

### Gate 3: Verificação de Integração (antes de merge do sprint)

- [ ] Integração cross-feature testada manualmente
- [ ] Build funciona: `npm run build`
- [ ] Sem erros no console do browser
- [ ] Novas rotas API têm rewrites em `vercel.json`
- [ ] Env vars documentadas com fallbacks (R-083)

---

## 10. Mapa de Dependências

```
Sprint 5.1 (PARALELO onde indicado)
  F5.4-1 ─┬─ F5.4-T1
           ├─ F5.4-2 ── F5.4-T2 ── F5.4-3
  F5.8-1 ─┼─ F5.8-2 ── F5.8-T1 ── F5.8-3 ── F5.8-4
  F5.9-1 ─┴─ F5.9-T1 ── F5.9-2
  ▓ GATE 5.1 ▓

Sprint 5.2 (SEQUENCIAL)
  F5.2-1 ── F5.2-T1 ── F5.2-2
  F5.1-0 ── F5.1-1 ── F5.1-T1 ── F5.1-2 ── F5.1-T2 ── F5.1-3
  ▓ GATE 5.2 ▓

Sprint 5.3 (SHARE primeiro, depois PARALELO)
  F5.3-1 ─┬─ F5.3-T1
  F5.3-2 ─┘
  F5.3-3 ── F5.3-4
  F5.7-1 ─┬─ F5.7-T1 ── F5.7-2 ── F5.7-3
  F5.5-1 ─┴─ F5.5-T1
  ▓ GATE 5.3 ▓

Sprint 5.4 (CUSTO primeiro, INTERAÇÕES paralelo)
  F5.10-1 ── F5.10-T1 ── F5.10-2 ── F5.10-3
  F5.6-1  ── F5.6-T2 ── F5.6-2 ── F5.6-T1 ── F5.6-3
  ▓ GATE 5.4 ▓

Finalização
  Docs ── DevOps (deploy) ── Smoke Test
```

### Paralelizações Seguras

| Tarefas Paralelas | Justificativa |
|-------------------|---------------|
| F5.4-1 + F5.8-1 + F5.9-1 | Sem overlap de arquivos, features independentes |
| F5.3-1 + F5.3-2 | API endpoint e vercel.json são independentes |
| F5.7-1 + F5.5-1 | Features diferentes, arquivos diferentes |
| F5.10-1 + F5.6-1 | Features diferentes, schemas diferentes |

---

## 11. Pontos de Integração

| Conexão | De → Para | Dados |
|---------|-----------|-------|
| Calendário ← Dashboard | `useDashboardContext` → `doseCalendarService` | logs + protocols → mapa mensal |
| Emergency Card ← Dashboard | `useDashboardContext` → `EmergencyCardView` | medicamentos ativos auto-populados |
| Prescrição → SmartAlerts | `prescriptionService` → `Dashboard.jsx` | `end_date` → alertas |
| Export ← Serviços | Todos os services → `exportService` | Dados centralizados |
| PDF ← Charts | `adherenceLogic` + stock → `chartRenderer` → `pdfGeneratorService` | Stats → Canvas → Base64 → PDF |
| Share ← PDF | `pdfGeneratorService` → `shareService` → `api/share.js` | Blob → Vercel Blob → URL |
| Consulta ← Tudo | Todos os services de F5 → `consultationDataService` | Snapshot clínico |
| Bot ← Estoque | `calculateDaysRemaining` → `tasks.js` proativo | Stock → Telegram |
| Custo ← Stock | `stockSchema.unit_price` → `costAnalysisService` | Preços → cálculos |
| Interação ← Medicamentos | `medicineSchema.active_ingredient` → `interactionService` | Ingredientes → lookup |
| MedicineForm ← Interação | `interactionService` → `MedicineForm.jsx` | Nova med → check → warning |

---

## 12. Mitigação de Riscos

| Risco | Prob | Impacto | Mitigação Específica |
|-------|------|---------|---------------------|
| **jsPDF impacta bundle** | Média | Médio | Dynamic import: `await import('jspdf')`. Vite code-splitting automático. Verificar bundle size no Gate 5.2 |
| **Base ANVISA incompleta** | Alta | Alto | Disclaimer "informativo" em TODA interface. Campo `source` obrigatório. Base como arquivo JS estático (atualizável sem API) |
| **Emergency Card desatualizado** | Média | Alto | Timestamp `last_updated` visível. Sync no foreground. Visual indicator se >7 dias |
| **Schema drift** (PM #1) | Baixa | Alto | F5.8 usa localStorage + JSONB existente. F5.6 é arquivo JS estático. Somente F5.3 tem endpoint novo — validar com Zod client+server |
| **Env vars faltando** (PM #2) | Média | Alto | `api/share.js` valida env vars no startup. Fallback pattern. Pre-deployment checklist |
| **Auth faltando** (PM #3) | Média | Alto | `BLOB_READ_WRITE_TOKEN` em header. Supabase JWT para autenticação do usuário |
| **Response format** (PM #5) | Baixa | Médio | Tester valida `res.status().json()` pattern nos testes da API |
| **Memória em testes** | Média | Alto | Arquivos ≤300 linhas, cleanup obrigatório, `validate:agent` com kill switch |

---

## 13. Protocolo de Validação

### Por Tarefa (Coder executa)

```bash
npm run validate:agent   # 10-min kill switch, lint + test:critical
```

### Por Sprint (DevOps executa no Gate)

```bash
npm run validate:full    # lint + coverage + build
```

### Integração Manual (por Gate)

1. `npm run dev` → navegar para cada nova feature
2. Verificar zero erros no console
3. Testar em viewport mobile (Chrome DevTools)
4. Testar offline para Emergency Card (desabilitar rede)
5. Verificar PDF baixa corretamente
6. Verificar CSV abre no Excel/LibreOffice
7. Testar link de compartilhamento (gerar → abrir em aba anônima)

### Pré-Merge (DevOps)

1. Gemini Code Assist review completo
2. Issues CRITICAL/HIGH resolvidos
3. `npm run validate:full` passa
4. Sem warnings de lint novos
5. Cobertura ≥80% em novos arquivos

---

## 14. Estratégia de Rollback

### Por Feature

Cada feature tem branch isolada. Se quebrar:
1. NÃO mergear o PR
2. Corrigir na mesma branch
3. Re-validar com `npm run validate:agent`
4. Se impossível de corrigir no sprint → adiar para próximo sprint

### Por Sprint

Se a integração do sprint quebrar:
1. PRs permanecem sem merge
2. Identificar ponto de quebra via mapa de integração (Seção 11)
3. Corrigir integração, re-validar
4. Se impossível estabilizar → mergear apenas features independentes que funcionam

### Em Produção

1. Rollback automático do Vercel para deploy anterior
2. Revert do merge commit: `git revert <merge-commit> --no-edit`
3. Push do revert → redeploy automático
4. Post-mortem: adicionar novas regras a `.memory/rules.md` e anti-patterns a `.memory/anti-patterns.md`

---

## 15. Novos Diretórios e Arquivos

```
src/features/
  calendar/
    components/
      DoseCalendar.jsx
      DoseCalendar.css
      __tests__/DoseCalendar.test.jsx
    services/
      doseCalendarService.js
      __tests__/doseCalendarService.test.js

  emergency/
    components/
      EmergencyCardForm.jsx
      EmergencyCardView.jsx
      EmergencyCard.css
    services/
      emergencyCardService.js
      __tests__/emergencyCardService.test.js

  prescriptions/
    services/
      prescriptionService.js
      __tests__/prescriptionService.test.js

  export/
    components/
      ExportDialog.jsx
      ExportDialog.css
    services/
      exportService.js
      __tests__/exportService.test.js

  reports/
    components/
      ReportGenerator.jsx
      ReportGenerator.css
    services/
      chartRenderer.js
      pdfGeneratorService.js
      shareService.js
      __tests__/chartRenderer.test.js
      __tests__/pdfGeneratorService.test.js

  consultation/
    components/
      ConsultationView.jsx
      ConsultationView.css
    services/
      consultationDataService.js
      __tests__/consultationDataService.test.js

  costs/
    components/
      CostWidget.jsx
      CostWidget.css
      CostDetail.jsx
      CostDetail.css
    services/
      costAnalysisService.js
      __tests__/costAnalysisService.test.js

  interactions/
    components/
      InteractionAlert.jsx
      InteractionAlert.css
      InteractionDetailModal.jsx
    data/
      interactionDatabase.js
      __tests__/interactionDatabase.test.js
    services/
      interactionService.js
      __tests__/interactionService.test.js

src/schemas/
  emergencyCardSchema.js
  interactionSchema.js
  __tests__/emergencyCardSchema.test.js

src/views/
  Calendar.jsx
  Emergency.jsx
  Consultation.jsx
  Costs.jsx

api/
  share.js
  __tests__/share.test.js

Arquivos modificados:
  src/App.jsx (4 novos cases: calendar, emergency, consultation, costs)
  src/views/Dashboard.jsx (CTAs + widgets + alertas)
  src/views/Settings.jsx (links para novas features)
  src/features/medications/components/MedicineForm.jsx (warning de interação)
  server/bot/tasks.js (alertas proativos de estoque)
  vercel.json (rewrite para /api/share)
  package.json (jspdf, jspdf-autotable)
```

---

## 16. Checklist do Orquestrador

O orquestrador DEVE processar as tarefas nesta ordem exata, respeitando dependências e paralelizações:

### Sprint 5.1 — Fundação

| # | Tarefa | Agente | Paralelo com | Depende de |
|---|--------|--------|-------------|------------|
| 1 | F5.4-1 DoseCalendar Service | Coder | F5.8-1, F5.9-1 | — |
| 2 | F5.8-1 Emergency Card Schema | Coder | F5.4-1, F5.9-1 | — |
| 3 | F5.9-1 Prescription Service | Coder | F5.4-1, F5.8-1 | — |
| 4 | F5.4-T1 Testes DoseCalendar Service | Tester | F5.8-2, F5.9-T1 | F5.4-1 |
| 5 | F5.8-2 Emergency Card Service | Coder | F5.4-T1, F5.9-T1 | F5.8-1 |
| 6 | F5.9-T1 Testes Prescription Service | Tester | F5.4-T1, F5.8-2 | F5.9-1 |
| 7 | F5.4-2 DoseCalendar Component | Coder | F5.8-T1 | F5.4-1 |
| 8 | F5.8-T1 Testes Emergency Card | Tester | F5.4-2 | F5.8-1, F5.8-2 |
| 9 | F5.8-3 Emergency Card Components | Coder | F5.4-T2 | F5.8-2 |
| 10 | F5.4-T2 Testes DoseCalendar Component | Tester | F5.8-3 | F5.4-2 |
| 11 | F5.4-3 Calendar View Integration | Coder | F5.8-4 | F5.4-2 |
| 12 | F5.8-4 Emergency Card Integration | Coder | F5.4-3 | F5.8-3 |
| 13 | F5.9-2 Prescription Alert Integration | Coder | — | F5.9-1 |
| 14 | **▓ GATE 5.1 ▓** | DevOps | — | Todas acima |

### Sprint 5.2 — Exportação

| # | Tarefa | Agente | Paralelo com | Depende de |
|---|--------|--------|-------------|------------|
| 15 | F5.2-1 Export Service | Coder | — | Gate 5.1 |
| 16 | F5.2-T1 Testes Export Service | Tester | — | F5.2-1 |
| 17 | F5.2-2 Export UI Component | Coder | — | F5.2-1 |
| 18 | F5.1-0 Adicionar jsPDF | DevOps | F5.2-2 | Gate 5.1 |
| 19 | F5.1-1 Chart Renderer Service | Coder | — | F5.1-0 |
| 20 | F5.1-T1 Testes Chart Renderer | Tester | — | F5.1-1 |
| 21 | F5.1-2 PDF Generator Service | Coder | — | F5.1-1 |
| 22 | F5.1-T2 Testes PDF Generator | Tester | — | F5.1-2 |
| 23 | F5.1-3 Report Generation UI | Coder | — | F5.1-2 |
| 24 | **▓ GATE 5.2 ▓** | DevOps | — | Todas acima |

### Sprint 5.3 — Compartilhamento

| # | Tarefa | Agente | Paralelo com | Depende de |
|---|--------|--------|-------------|------------|
| 25 | F5.3-1 Share API Endpoint | Coder | F5.3-2 | Gate 5.2 |
| 26 | F5.3-2 Vercel JSON Rewrite | DevOps | F5.3-1 | Gate 5.2 |
| 27 | F5.3-T1 Testes Share API | Tester | — | F5.3-1 |
| 28 | F5.3-3 Share Service (Client) | Coder | — | F5.3-1 |
| 29 | F5.3-4 Integração no ReportGenerator | Coder | — | F5.3-3 |
| 30 | F5.7-1 Consultation Data Service | Coder | F5.5-1 | F5.3-3 |
| 31 | F5.5-1 Proactive Stock Alert Logic | Coder | F5.7-1 | Gate 5.2 |
| 32 | F5.5-T1 Testes Alerta Proativo | Tester | F5.7-T1 | F5.5-1 |
| 33 | F5.7-T1 Testes Consultation Service | Tester | F5.5-T1 | F5.7-1 |
| 34 | F5.7-2 Consultation Mode View | Coder | — | F5.7-1 |
| 35 | F5.7-3 Consultation View Integration | Coder | — | F5.7-2 |
| 36 | **▓ GATE 5.3 ▓** | DevOps | — | Todas acima |

### Sprint 5.4 — Analytics

| # | Tarefa | Agente | Paralelo com | Depende de |
|---|--------|--------|-------------|------------|
| 37 | F5.10-1 Cost Analysis Service | Coder | F5.6-1 | Gate 5.3 |
| 38 | F5.6-1 Interaction Database + Schema | Coder | F5.10-1 | Gate 5.3 |
| 39 | F5.10-T1 Testes Cost Analysis | Tester | F5.6-T2 | F5.10-1 |
| 40 | F5.6-T2 Testes Interaction Database | Tester | F5.10-T1 | F5.6-1 |
| 41 | F5.10-2 Cost Dashboard Widget | Coder | F5.6-2 | F5.10-1 |
| 42 | F5.6-2 Interaction Check Service | Coder | F5.10-2 | F5.6-1 |
| 43 | F5.10-3 Cost Detail View | Coder | F5.6-T1 | F5.10-2 |
| 44 | F5.6-T1 Testes Interaction Service | Tester | F5.10-3 | F5.6-2 |
| 45 | F5.6-3 Interaction Alert Components | Coder | — | F5.6-2 |
| 46 | **▓ GATE 5.4 ▓** | DevOps | — | Todas acima |

### Finalização

| # | Tarefa | Agente | Depende de |
|---|--------|--------|------------|
| 47 | CHANGELOG + README + RELEASE_NOTES | Docs | Gate 5.4 |
| 48 | Deploy para produção + verificação | DevOps | 47 |
| 49 | Smoke test pós-deploy | DevOps | 48 |
| 50 | Atualizar `.memory/rules.md` se novas regras | Docs | 49 |

---

*Documento gerado em: 24/02/2026*
*Referência: PRD Fase 5 v2.0, Roadmap 2026 v3.2, Post-Mortem Sprint 7*
*Próxima spec: EXEC_SPEC_FASE_5.5.md (Inteligência Preditiva)*
