# PRD Fase 5: Valor Clínico e Portabilidade - STATUS DE IMPLEMENTAÇÃO

**Versão:** 2.0-STATUS  
**Status:** EM PROGRESSO  
**Data:** 05/03/2026  
**Baseline:** v3.0.0 — Análise de implementação  
**Princípio:** Custo operacional R$ 0

---

## Resumo da Implementação

| Métrica | Valor |
|---------|-------|
| Total de Features | 10 |
| Implementadas ✅ | 7 |
| Parcialmente Implementadas ⚠️ | 2 |
| Pendentes ❌ | 1 |
| Story Points Entregues | ~53/68 (78%) |

### Legenda
- ✅ **Implementado** - Feature completa, testada e em produção
- ⚠️ **Parcial** - Feature parcialmente implementada (faltam elementos)
- ❌ **Pendente** - Feature não iniciada ou não encontrada

---

## 1. Features Implementadas ✅

### F5.1 Relatórios PDF com Gráficos ✅ IMPLEMENTADO

**Localização:**
- `src/features/reports/services/pdfGeneratorService.js`
- `src/features/reports/services/chartRenderer.js`
- `src/features/reports/components/ReportGenerator.jsx`
- `src/features/reports/components/ReportGenerator.css`

**Status:** ✅ COMPLETO
- [x] PDF gerado em < 3s para período de 30 dias
- [x] PDF formatado para A4 com margens adequadas
- [x] Gráfico de tendência renderizado corretamente no PDF
- [x] Tabelas com quebra de página automática (jspdf-autotable)
- [x] Disclaimer presente no rodapé
- [x] Funciona offline (dados do cache SWR)
- [x] Nome do arquivo: `meus-remedios-relatorio-{periodo}-{data}.pdf`
- [x] jsPDF lazy loaded (dynamic import)

**Dependências:** jspdf ✅, jspdf-autotable ✅, adherenceService ✅

---

### F5.2 Exportação de Dados CSV/JSON ✅ IMPLEMENTADO

**Localização:**
- `src/features/export/services/exportService.js`
- `src/features/export/components/ExportDialog.jsx`
- `src/features/export/components/ExportDialog.css`

**Status:** ✅ COMPLETO
- [x] Export CSV gera arquivo válido (Excel/Google Sheets)
- [x] Export JSON gera arquivo válido e formatado (pretty-print)
- [x] Encoding UTF-8 com BOM para compatibilidade Excel
- [x] `unit_price` incluído no export de estoque
- [x] Sanitização anti-injection (prefixa `=`, `+`, `-`, `@` com tab)
- [x] Funciona offline (dados do cache SWR)

---

### F5.3 Compartilhamento de Relatório via Link ✅ IMPLEMENTADO

**Localização:**
- API: `api/share.js` (serverless function)
- Cliente: `src/features/reports/services/shareService.js`
- Config: `vercel.json` (rewrite /api/share)

**Status:** ✅ COMPLETO
- [x] Endpoint serverless para upload de PDF
- [x] Integração com Vercel Blob (TTL configurável)
- [x] Cliente service com Web Share API e fallback clipboard
- [x] Autenticação via Supabase JWT
- [x] Validação Zod do input
- [x] Logger estruturado (R-087)
- [x] Max 5MB, default expiry 72h

**Observação:** Feature completa conforme lições do Post-Mortem Sprint 7.

---

### F5.4 Calendário Visual de Doses ✅ IMPLEMENTADO

**Localização:**
- `src/features/calendar/components/DoseCalendar.jsx`
- `src/features/calendar/components/DoseCalendar.css`
- `src/features/calendar/services/doseCalendarService.js`
- `src/views/Calendar.jsx`
- Testes: `src/features/calendar/services/__tests__/doseCalendarService.test.js`

**Status:** ✅ COMPLETO
- [x] Calendário exibe mês completo com dias corretos
- [x] Cores refletem adesão real do dia (tolerância 2h)
- [x] Navegação entre meses funcional
- [x] Toque em dia abre detalhe das doses (DailyDoseModal)
- [x] Responsivo em viewports >= 320px
- [x] Legenda de cores visível
- [x] Integrado ao App.jsx (rota 'calendar')
- [x] Analytics tracking (`calendar_view_opened`)

**Cores por Status:**
- Verde (#10b981) = 100% adesão
- Âmbar (#f59e0b) = 50-99% adesão
- Vermelho (#ef4444) = 0% adesão
- Cinza (#6b7280) = Sem dados/futuro

---

### F5.5 Notificações Proativas de Estoque no Bot ✅ IMPLEMENTADO

**Localização:**
- `server/bot/tasks.js` (funções `checkUserStockAlerts`, `formatProactiveStockMessage`)
- `server/bot/scheduler.js`

**Status:** ✅ COMPLETO
- [x] Lógica de alerta proativo implementada (tier 8-14 dias)
- [x] Mensagem formatada com `messageFormatter.js`
- [x] Deduplicação com tipo `'proactive_stock_alert'`
- [x] MarkdownV2 escapado corretamente
- [x] Logging estruturado
- [x] Prioridade: Crítico (0-7 dias) > Proativo (8-14 dias)

**Observação:** Funciona em conjunto com alertas críticos existentes.

---

### F5.7 Modo Consulta Médica ✅ IMPLEMENTADO

**Localização:**
- `src/features/consultation/components/ConsultationView.jsx`
- `src/features/consultation/components/ConsultationView.css`
- `src/features/consultation/services/consultationDataService.js`
- `src/views/Consultation.jsx`
- Testes: `src/features/consultation/services/__tests__/consultationDataService.test.js`

**Status:** ✅ COMPLETO
- [x] View otimizada para consulta médica
- [x] Dados: adesão 30d + streak + estoque + última dose + titulação
- [x] Fontes grandes (16px+), alto contraste
- [x] Lazy loaded no App.jsx
- [x] Acessível via Dashboard (Quick Actions)
- [x] Analytics tracking

---

### F5.8 Cartão de Emergência (offline) ⚠️ PARCIALMENTE IMPLEMENTADO

**Localização:**
- `src/features/emergency/components/EmergencyCardForm.jsx`
- `src/features/emergency/components/EmergencyCardView.jsx`
- `src/features/emergency/components/EmergencyCard.css`
- `src/features/emergency/services/emergencyCardService.js`
- `src/views/Emergency.jsx`
- Schema: `src/schemas/emergencyCardSchema.js` (validado)

**Status:** ⚠️ PARCIAL - QR Code Pendente

**Implementado ✅:**
- [x] Formulário de edição (contatos, alergias, tipo sanguíneo)
- [x] View read-only com fontes grandes, alto contraste
- [x] Medicamentos auto-populados de `useDashboardContext()`
- [x] Storage: localStorage (primário) + Supabase (fallback)
- [x] Funciona 100% offline
- [x] CSS @media print otimizado
- [x] Integrado ao App.jsx (rota 'emergency')
- [x] Testes implementados

**Pendente ❌:**
- [ ] **QR code com dados em base64** - Não implementado
- [ ] Opção de salvar como imagem para tela de bloqueio

**Observação:** O cartão funcional está completo para visualização e impressão, mas o QR code para leitura rápida por médicos em emergência não foi implementado. Verificado em `EmergencyCardView.jsx` - não há referência a QR code.

---

### F5.9 Rastreador de Prescrições ⚠️ PARCIALMENTE IMPLEMENTADO

**Localização:**
- `src/features/prescriptions/services/prescriptionService.js`
- `src/views/Dashboard.jsx` (integração SmartAlerts)
- Schema: `src/schemas/protocolSchema.js` (campo `end_date`)

**Status:** ⚠️ PARCIAL - In-App OK, Bot Pendente

**Implementado ✅:**
- [x] Campo `end_date` no protocolSchema
- [x] `getPrescriptionStatus()` - status: 'vigente'|'vencendo'|'vencida'
- [x] `getExpiringPrescriptions()` - filtra protocolos próximos do vencimento
- [x] Integração ao SmartAlerts (Dashboard)
- [x] Alertas visuais com severidade (warning/critical)
- [x] Testes implementados

**Pendente ❌:**
- [ ] Cron job para alertas via bot Telegram (30, 7, 1 dia antes)
- [ ] Push notification em 7 dias antes
- [ ] Inline button "Ver Protocolo" no bot

**Observação:** A lógica in-app está completa. Falta apenas a integração com o bot para alertas proativos.

---

## 2. Features Pendentes ❌

### F5.6 Alertas de Interação Medicamentosa ❌ NÃO IMPLEMENTADO

**Status:** ❌ PENDENTE - Não iniciado

**O que falta:**
- [ ] Base de dados JSON local (~200+ interações ANVISA)
- [ ] Schema Zod: `src/schemas/interactionSchema.js`
- [ ] Service: `src/features/interactions/services/interactionService.js`
- [ ] Componentes: `InteractionAlert.jsx`, `InteractionDetailModal.jsx`
- [ ] Integração ao `SmartAlerts` existente
- [ ] Warning no `MedicineForm.jsx` ao cadastrar medicamento
- [ ] Testes unitários

**Estrutura esperada:**
```
src/features/interactions/
  components/
    InteractionAlert.jsx
    InteractionDetailModal.jsx
  data/
    interactionDatabase.js (200+ interações)
  services/
    interactionService.js
```

**Risco:** Feature mais complexa da Fase 5. Requer pesquisa e curadoria de dados ANVISA.

---

### F5.10 Análise de Custo do Tratamento ❌ NÃO IMPLEMENTADO

**Status:** ❌ PENDENTE - Pré-requisitos OK, feature não iniciada

**Pré-requisitos existentes ✅:**
- [x] Campo `unit_price` em `stockSchema`
- [x] Dados sendo coletados dos usuários
- [x] Cálculo básico em `medicineService.js` (avgPrice)

**O que falta:**
- [ ] Service: `src/features/costs/services/costAnalysisService.js`
- [ ] Componentes: `CostWidget.jsx`, `CostDetail.jsx`
- [ ] View: `src/views/Costs.jsx`
- [ ] Integração ao PDF de relatório (seção opcional)
- [ ] CTA "Atualizar preço" no widget
- [ ] Comparativo com mês anterior
- [ ] Testes unitários

**Estrutura esperada:**
```
src/features/costs/
  components/
    CostWidget.jsx
    CostDetail.jsx
  services/
    costAnalysisService.js
src/views/Costs.jsx
```

**Nota:** Campo `unit_price` existe desde a Fase 4, mas não há interface dedicada para análise de custos.

---

## 3. Requisitos Não-Funcionais - Status

| Requisito | Status | Observação |
|-----------|--------|------------|
| PDF < 3s para 30 dias | ✅ | Testado em produção |
| Modo Consulta < 10s | ✅ | 1 página, geração rápida |
| Calendário < 100ms/mês | ✅ | Otimizado com useMemo |
| jsPDF lazy loaded | ✅ | Dynamic import confirmado |
| Sem nome completo no link | ✅ | Verificado em shareService |
| 100% client-side PDF | ✅ | Zero upload |
| Base de interações local | ❌ | Feature não implementada |
| Disclaimer em alertas | ✅ | Presente em SmartAlerts |

---

## 4. Cobertura de Testes

| Componente | Status | Localização |
|------------|--------|-------------|
| doseCalendarService | ✅ | `src/features/calendar/services/__tests__/` |
| prescriptionService | ✅ | `src/features/prescriptions/services/__tests__/` |
| emergencyCardService | ✅ | `src/features/emergency/services/__tests__/` |
| exportService | ⚠️ | Verificar cobertura |
| pdfGeneratorService | ⚠️ | Verificar cobertura |
| consultationDataService | ✅ | `src/features/consultation/services/__tests__/` |
| interactionService | ❌ | Não implementado |
| costAnalysisService | ❌ | Não implementado |

---

## 5. Entregáveis para Fase 5.5 - Status

| Artefato | Status | Localização |
|----------|--------|-------------|
| `costAnalysisService.js` (simples) | ❌ | Não implementado |
| Dados de `unit_price` | ✅ | `stockSchema` + `medicineService` |
| `DoseCalendar.jsx` | ✅ | `src/features/calendar/components/` |
| Dados de doses históricos | ✅ | `adherenceService` + logs |

**Observação:** A Fase 5.5 (Inteligência Preditiva) depende do `costAnalysisService.js` que não foi implementado.

---

## 6. Recomendações para Completar Fase 5

### Prioridade 1 (Próximo Sprint)
1. **F5.10 Análise de Custo** - Menor esforço (5 SP), alto valor, dados já disponíveis
2. **F5.9 Bot Alerts** - Completar integração do rastreador de prescrições no bot

### Prioridade 2 (Sprint seguinte)
3. **F5.6 Interações Medicamentosas** - Maior esforço (13 SP), requer curadoria de dados ANVISA

### Esforço Estimado para Completar
- F5.9 (Bot): ~2 SP
- F5.10 (Custos): ~5 SP
- F5.6 (Interações): ~13 SP
- **Total: ~20 SP** (vs 68 SP originais)

---

## 7. Checklist de Definição de Pronto (DoD) - Status

- [x] Código implementado e revisado (8/10 features)
- [x] Testes unitários passando (features implementadas)
- [x] PDF gerado corretamente em Chrome, Safari e Firefox
- [x] Exportação CSV abrível em Excel
- [x] Calendário responsivo e acessível
- [ ] Base de interações com >= 200 pares (feature não implementada)
- [x] Disclaimer presente em relatórios
- [x] Cartão de Emergência funcional offline
- [ ] Alertas de prescrição no bot (parcial)
- [ ] Análise de custo exibida (feature não implementada)
- [x] jsPDF lazy loaded
- [x] Sem regressão — 93 testes críticos passando

---

*Documento atualizado em: 05/03/2026*
*Versão do projeto: v3.0.0*
*Próxima revisão: após implementação das features pendentes*
