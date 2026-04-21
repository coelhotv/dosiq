# PRD Fase 5: Valor Clínico e Portabilidade

**Versão:** 2.0
**Status:** DRAFT
**Data:** 21/02/2026
**Fase do Roadmap:** 5 de 7
**Baseline:** v2.8.1 — Fase 4 concluída (PWA ✅, Push VAPID ✅, Analytics ✅, Hash Router ✅, Bot Standardization ✅)
**Próxima Fase:** 5.5 — Inteligência Preditiva Client-Side (depende da Fase 5)
**Princípio:** Custo operacional R$ 0

---

## 1. Visão Geral e Objetivos Estratégicos

A Fase 5 posiciona o Dosiq como ferramenta clínica séria, não apenas um lembrete de doses. Vai além da exportação básica de dados para entregar valor real nas situações que mais importam: consultas médicas, emergências hospitalares, controle de prescrições vencendo e consciência de custo do tratamento.

**Relação com Fase 5.5:** A Fase 5 alimenta a Fase 5.5 (Inteligência Preditiva). O calendário visual (F5.4) e os dados de doses coletados aqui são a base do heatmap de padrões (I02) e do score de risco por protocolo (I04) da próxima fase. O `unit_price` do estoque coletado em F5.10 é a fonte da análise de custo inteligente (I05).

### Objetivos Estratégicos

| ID | Objetivo | Métrica Primária |
|----|----------|-----------------|
| OE5.1 | Gerar relatórios clínicos exportáveis para consultas médicas | Downloads PDF > 20% usuários/semana |
| OE5.2 | Garantir portabilidade de dados do usuário | Exports CSV/JSON > 10% usuários |
| OE5.3 | Fornecer visão mensal intuitiva do histórico de doses | Uso calendário > 30% sessões |
| OE5.4 | Aumentar segurança com alertas de interação medicamentosa | Alertas exibidos rastreados |
| OE5.5 | Proatividade na reposição de estoque via bot | Notificações de estoque enviadas |
| OE5.6 | Otimizar a preparação para consultas médicas | Modo Consulta utilizado > 20% dos usuários |
| OE5.7 | Garantir segurança em emergências com dados offline | Cartão de Emergência gerado > 15% usuários |
| OE5.8 | Prevenir descontinuação por receita vencida | Alertas de prescrição disparados antes do vencimento |
| OE5.9 | Trazer consciência de custo do tratamento | Análise de custo visualizada > 35% com `unit_price` preenchido |

### Pré-requisitos (todos já concluídos em v2.8.1)

- ✅ Fase 4 concluída: Hash Router (9 rotas), PWA (Workbox), Push Notifications (VAPID), Analytics Service, Bot messageFormatter/errorHandler
- ✅ `adherenceService` funcional com cálculo por período
- ✅ Cache SWR operacional
- ✅ `unit_price` em `stockSchema` já coletado pelos usuários existentes

---

## 2. Escopo de Features

| ID | Feature | Prioridade | Story Points | Novas Dependências |
|----|---------|------------|-------------|-------------------|
| F5.1 | Relatórios PDF com Gráficos | P0 | 13 | jspdf + jspdf-autotable (~300KB) |
| F5.2 | Exportação de Dados CSV/JSON | P0 | 5 | Nenhuma (APIs nativas) |
| F5.3 | Compartilhamento de Relatório via Link | P1 | 5 | Nenhuma |
| F5.4 | Calendário Visual de Doses | P0 | 8 | Nenhuma (SVG/CSS grid) |
| F5.5 | Notificações Proativas de Estoque no Bot | P1 | 3 | Nenhuma |
| F5.6 | Alertas de Interação Medicamentosa (ANVISA) | P1 | 13 | Nenhuma (base JSON local) |
| **F5.7** | **Modo Consulta Médica** | **P0** | **8** | **jspdf (já em F5.1)** |
| **F5.8** | **Cartão de Emergência (offline)** | **P0** | **5** | **Nenhuma (PWA cache ✅)** |
| **F5.9** | **Rastreador de Prescrições** | **P1** | **3** | **Nenhuma (campo end_date já existe)** |
| **F5.10** | **Análise de Custo do Tratamento** | **P1** | **5** | **Nenhuma (unit_price já coletado)** |

**Esforço Total:** 68 SP (+21 vs original)
**Novas dependências npm:** jspdf (~250KB), jspdf-autotable (~50KB) — lazy loaded

### Fora de Escopo

- Exportação FHIR (eliminada por complexidade)
- Integração com sistemas hospitalares
- Prescrição digital
- Qualquer feature com custo recorrente

---

## 3. Descrição Detalhada de Features

### F5.1 Relatórios PDF com Gráficos

**Título:** Geração de relatórios PDF client-side com gráficos de adesão e dados clínicos
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 5, P08

**Descrição:**
Gerar relatórios PDF completos no client-side usando jsPDF, contendo dados de adesão, estoque, timeline de titulação e gráficos de tendência. O relatório é formatado para impressão A4. Nenhum dado enviado para servidor externo.

**Nota de integração:** A Análise de Custo (F5.10) será incluída como seção opcional neste PDF. O Score de Risco por protocolo da Fase 5.5 (I04) também será incorporado quando disponível.

**Estrutura do PDF:**

| Seção | Conteúdo |
|-------|----------|
| Cabeçalho | Nome do usuário, data de geração, período |
| Resumo de Adesão | Score geral, score por protocolo, streak atual |
| Gráfico de Tendência | Adesão diária dos últimos 7/30/90 dias (SVG convertido) |
| Lista de Medicamentos | Nome, dosagem, frequência, horários |
| Histórico de Doses | Tabela com data, medicamento, horário previsto, registrado, status |
| Estoque Atual | Medicamento, quantidade atual, dias restantes estimados |
| Timeline de Titulação | Etapas concluídas, etapa atual, próxima etapa |
| Análise de Custo *(opcional)* | Custo mensal por medicamento (se `unit_price` preenchido) |
| Rodapé | Disclaimer: "Este relatório não substitui orientação médica" |

**Critérios de Aceitação:**
- [ ] PDF gerado em < 3s para período de 30 dias
- [ ] PDF formatado para A4 com margens adequadas
- [ ] Gráfico de tendência renderizado corretamente no PDF
- [ ] Tabelas com quebra de página automática
- [ ] Disclaimer presente no rodapé de todas as páginas
- [ ] Preview disponível antes de gerar/baixar
- [ ] Funciona offline (dados do cache SWR — PWA já configurado)
- [ ] Nome do arquivo: `dosiq-relatorio-{periodo}-{data}.pdf`
- [ ] jsPDF lazy loaded (dynamic import — não impacta bundle inicial 762KB)

**Dependências:** jsPDF, adherenceService, Hash Router (✅ já entregue)
**Impacto Financeiro:** R$ 0

---

### F5.2 Exportação de Dados CSV/JSON

**Título:** Exportação completa de dados do usuário em formato CSV e JSON
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 5, N01

**Requisitos Técnicos:**
- Service `src/features/dashboard/services/exportService.js`
- Métodos: `exportCSV()`, `exportJSON()`, `exportAll(format)`
- Componente em `src/features/dashboard/components/DataExport.jsx`
- Usar APIs nativas: `Blob`, `URL.createObjectURL`, `<a download>`

**Dados Exportáveis:**

| Entidade | Campos | Formato CSV | Formato JSON |
|----------|--------|-------------|-------------|
| Medicamentos | id, nome, dosagem, forma, notas | medicamentos.csv | medicamentos.json |
| Protocolos | id, nome, medicamentos, horários, titulação | protocolos.csv | protocolos.json |
| Histórico de Doses | id, medicamento, data, horário_previsto, horário_registrado, status | historico_doses.csv | historico_doses.json |
| Estoque | id, medicamento, quantidade, data_entrada, validade, unit_price | estoque.csv | estoque.json |
| Configurações | tema, notificações, onboarding | — | configuracoes.json |

**Critérios de Aceitação:**
- [ ] Export CSV gera arquivo válido abrível em Excel/Google Sheets
- [ ] Export JSON gera arquivo válido e formatado (pretty-print)
- [ ] Encoding UTF-8 com BOM para compatibilidade Excel
- [ ] `unit_price` incluído no export de estoque (relevante para análise externa)
- [ ] Funciona offline (dados do cache SWR)

**Dependências:** Nenhuma nova
**Impacto Financeiro:** R$ 0

---

### F5.3 Compartilhamento de Relatório via Link

**Título:** Gerar link temporário para compartilhar relatório com médico
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 5, N05

**Descrição:**
Link hash-based que codifica snapshot dos dados de adesão em base64 na URL. Sem armazenamento server-side. Nota: o Modo Consulta Médica (F5.7) oferece uma versão mais completa e otimizada deste caso de uso.

**Critérios de Aceitação:**
- [ ] Link gerado copiável para clipboard (Web Share API ou fallback)
- [ ] Link abre visualização read-only do relatório resumido
- [ ] Nenhum dado armazenado no servidor
- [ ] Aviso de data de geração visível
- [ ] Dados sensíveis (nome completo) não incluídos no link
- [ ] Funciona em qualquer navegador sem login

**Dependências:** F5.1 (ReportGenerator), Hash Router (✅ já entregue)
**Impacto Financeiro:** R$ 0

---

### F5.4 Calendário Visual de Doses

**Título:** Visão mensal de calendário com status de doses por dia
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 5, N08

**Nota de integração com Fase 5.5:** Este calendário usa a classificação Taken/Missed/Scheduled já implementada no Sparkline drilldown (pós-F4) como padrão visual. O heatmap de padrões (I02 da Fase 5.5) é a evolução natural deste componente — ao clicar em um dia no calendário, o usuário pode navegar para o heatmap da semana correspondente.

**Cores por Status:**

| Status | Cor | Significado |
|--------|-----|------------|
| 100% adesão | Verde (#10b981) | Todas as doses tomadas |
| 50-99% adesão | Âmbar (#f59e0b) | Algumas doses perdidas |
| 1-49% adesão | Laranja (#f97316) | Maioria das doses perdidas |
| 0% adesão | Vermelho (#ef4444) | Nenhuma dose tomada |
| Sem dados | Cinza (#6b7280) | Dia futuro ou sem protocolo |
| Hoje | Borda accent (#6366f1) | Dia atual destacado |

**Critérios de Aceitação:**
- [ ] Calendário exibe mês completo com dias corretos
- [ ] Cores refletem adesão real do dia (usando lógica de 2h de tolerância do pós-F4)
- [ ] Navegação entre meses funcional (setas e swipe)
- [ ] Toque em dia abre detalhe das doses (DailyDoseModal existente)
- [ ] Responsivo em viewports >= 320px
- [ ] Legenda de cores visível
- [ ] Performance: renderização < 100ms por mês

**Dependências:** adherenceService, Hash Router (✅)
**Impacto Financeiro:** R$ 0

---

### F5.5 Notificações Proativas de Estoque no Bot

**Título:** Bot envia alerta automático quando estoque está próximo do fim
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 5, N09

**Nota de integração com Fase 5.5:** A Fase 5.5 (I01 — Previsão de Reposição) usa consumo real vs consumo teórico desta feature. F5.5 é baseado em cálculo teórico (`time_schedule × dosage_per_intake`); I01 da Fase 5.5 refina usando consumo real dos logs. Ambos coexistem e se complementam.

**Requisitos Técnicos:**
- Usa `messageFormatter.js` existente (F4.5) para formatação MarkdownV2
- Reutiliza lógica de deduplicação existente (`deduplicationService`)
- Cron job Vercel `api/cron/stock-alerts.js` (1x/dia às 8h)
- Deep link `#/estoque` via inline button (Hash Router ✅)

**Critérios de Aceitação:**
- [ ] Alerta enviado quando estoque <= 7 dias de consumo teórico
- [ ] Mensagem inclui nome do medicamento e dias restantes
- [ ] Inline button "Ver Estoque" abre `#/estoque`
- [ ] Máximo 1 alerta por medicamento por dia (deduplicationService)
- [ ] Usa `messageFormatter.js` existente (sem formatação manual)

**Dependências:** Bot Telegram com messageFormatter (✅ F4.5), Deep Linking (✅ F4.1)
**Impacto Financeiro:** R$ 0

---

### F5.6 Alertas de Interação Medicamentosa

**Título:** Sistema de alertas de interação medicamentosa baseado em base de dados ANVISA local
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 5, N02

**Descrição:**
Sistema que verifica interações conhecidas entre os medicamentos do usuário e exibe alertas no dashboard via `SmartAlerts` existente. Base de dados JSON local (~200+ interações) derivada do Bulário Eletrônico da ANVISA (dados públicos).

**Estrutura da Base de Dados:**

```json
{
  "interactions": [
    {
      "drug_a": "losartana",
      "drug_b": "ibuprofeno",
      "severity": "moderate",
      "description": "Ibuprofeno pode reduzir o efeito anti-hipertensivo da Losartana",
      "recommendation": "Evitar uso prolongado. Consulte seu médico.",
      "source": "ANVISA - Bulário Eletrônico"
    }
  ]
}
```

**Níveis de Severidade:**

| Nível | Cor | Ação |
|-------|-----|------|
| severe | Vermelho (#ef4444) | Alerta crítico no topo via SmartAlerts |
| moderate | Âmbar (#f59e0b) | Alerta informativo no SmartAlerts |
| mild | Azul (#3b82f6) | Nota informativa (expansível) |

**Critérios de Aceitação:**
- [ ] Interações verificadas ao cadastrar novo medicamento
- [ ] Integrado ao `SmartAlerts` existente (HCC) — sem novo componente de alerta
- [ ] Alerta exibido com severidade, descrição e recomendação
- [ ] Disclaimer: "Consulte seu médico. Este alerta é informativo."
- [ ] Base de dados local (sem chamadas externas)
- [ ] Busca case-insensitive com normalização de acentos
- [ ] Base inicial >= 200 interações documentadas com fonte ANVISA

**Dependências:** SmartAlerts (✅ HCC), medicationService
**Impacto Financeiro:** R$ 0

---

### F5.7 Modo Consulta Médica ⭐ NOVO

**Título:** Resumo clínico otimizado para consultas médicas com PDF e QR code
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 5, N11

**Descrição:**
Gera em 1 toque um resumo otimizado para apresentar ao médico: adesão dos últimos 7/30 dias, timeline de titulação atual, estoque e última dose de cada protocolo. Disponível como PDF A4 (formato consulta, não histórico completo) e como QR code que codifica a URL de compartilhamento (F5.3).

**Diferenciação vs F5.1 (PDF Completo):**
- F5.1: Relatório histórico completo, configurável, para o paciente
- F5.7: Resumo de 1 página otimizado para o médico ver durante a consulta (< 30s para gerar)

**Requisitos Técnicos:**
- Componente `src/features/dashboard/components/ConsultationCard.jsx`
- Rota `#/consulta` — acessível via Quick Actions existente
- PDF gerado com jsPDF (lazy, já instalado em F5.1)
- QR code gerado com `qrcode` (tiny library, ~15KB) ou via URL encoding CSS/canvas nativo
- Dados: adesão 30d + streak + estoque + última dose + titulação atual

**Estrutura do Resumo (1 página A4):**

```
Dosiq — Resumo para Consulta
Gerado em: [data e hora]

📊 ADESÃO (últimos 30 dias): 87% | Streak: 12 dias consecutivos

💊 MEDICAMENTOS ATIVOS:
├── Losartana 50mg — 1x/dia (8h) | Última dose: ontem 8:12 | Estoque: 23 dias
├── Metformina 500mg — 2x/dia | Última dose: hoje 8:05 | Estoque: 45 dias
└── Rivotril 0,5mg — 1x/noite | Em titulação: Etapa 2/4 (15 dias) | Estoque: 8 dias

⚠️ ATENÇÃO: Estoque de Rivotril para ~8 dias

[QR Code de acesso ao relatório completo]

"Este resumo não substitui avaliação médica completa"
```

**Critérios de Aceitação:**
- [ ] Gerado em < 10s (1 página apenas)
- [ ] Botão de atalho no dashboard ("Para Consulta") na seção Quick Actions
- [ ] QR code funcional que abre o link de compartilhamento (F5.3)
- [ ] Funciona offline (dados do cache PWA)
- [ ] PDF imprimível em A4
- [ ] Inclui alerta visual se algum estoque está crítico (< 7 dias)
- [ ] Não inclui dados pessoais além do resumo (privacidade ao mostrar ao médico)

**Dependências:** F5.1 (jsPDF já instalado), F5.3 (link de compartilhamento), Push Notifications (✅ F4.3 — pode complementar)
**Impacto Financeiro:** R$ 0

---

### F5.8 Cartão de Emergência (offline) ⭐ NOVO

**Título:** Cartão imprimível com medicamentos ativos para emergências hospitalares
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 5, N12

**Descrição:**
QR code imprimível (cartão de carteira, 85×54mm) com os medicamentos ativos, dosagens e alergias do usuário. Funciona 100% sem internet — os dados são codificados no próprio QR code. Médicos do pronto-socorro podem escanear e ver os medicamentos sem que o paciente precise explicar.

**Por que é crítico:** Em emergências, usuários frequentemente estão incapacitados de informar seus medicamentos. Um cartão na carteira ou no celular (tela de bloqueio) resolve essa situação real.

**Requisitos Técnicos:**
- Dados armazenados no Service Worker cache (PWA ✅ F4.2) e localStorage
- QR code contém URL com dados em base64 (sem necessidade de servidor)
- Componente `src/features/medications/components/EmergencyCard.jsx`
- Rota `#/cartao-emergencia`
- CSS @media print otimizado para cartão de crédito (85×54mm)
- Layout de tela de bloqueio (wallpaper gerado como imagem)

**Estrutura do QR code:**

```json
{
  "v": "1",
  "n": "João",
  "m": [
    {"n": "Losartana", "d": "50mg", "f": "1x/dia"},
    {"n": "Metformina", "d": "500mg", "f": "2x/dia"}
  ],
  "a": ["Penicilina"],
  "dt": "2026-02-21"
}
```

**Critérios de Aceitação:**
- [ ] QR code legível em qualquer leitor padrão (câmera do celular)
- [ ] Link gerado pelo QR code abre página sem necessidade de login
- [ ] Funciona 100% offline (QR code não depende de servidor)
- [ ] CSS print otimizado para cartão 85×54mm
- [ ] Opção de salvar como imagem para tela de bloqueio
- [ ] Dados do QR code atualizados automaticamente ao alterar medicamentos
- [ ] Aviso de data de geração no cartão ("Atualizado em: DD/MM/AAAA")
- [ ] Campo de alergias editável (não está em `medicineSchema`, usar localStorage)

**Dependências:** PWA cache (✅ F4.2), Hash Router (✅ F4.1)
**Impacto Financeiro:** R$ 0

---

### F5.9 Rastreador de Prescrições ⭐ NOVO

**Título:** Alertas automáticos antes do vencimento de prescrições
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 5, N13

**Descrição:**
O campo `end_date` já existe em `protocolSchema.js` e é usado para definir o fim de um tratamento. Esta feature interpreta `end_date` como vencimento da prescrição e dispara alertas antecipados via bot (Telegram, e futuramente WhatsApp na Fase 6) e push notification (✅ F4.3) em 30, 7 e 1 dia antes.

**Requisitos Técnicos:**
- Cron job `api/cron/prescription-alerts.js` (1x/dia às 8h)
- Query: `protocols WHERE end_date BETWEEN now() AND now() + 30 days AND active = true`
- Usa `messageFormatter.js` existente (✅ F4.5) para mensagem do bot
- Push notification via `api/push-send.js` existente (✅ F4.3)
- In-app: card de alerta no `SmartAlerts` (HCC)
- Inline button: "Ver Protocolo" → deep link `#/protocolos/:id`

**Mensagem Bot (exemplo):**

```
⚠️ Prescrição vencendo em 7 dias

Protocolo: Losartana 50mg
Vencimento: 28/02/2026

📋 Agende sua consulta para renovar a prescrição.
```

**Critérios de Aceitação:**
- [ ] Alerta via bot em 30, 7 e 1 dia antes do `end_date`
- [ ] Push notification em 7 dias antes (se opt-in ✅ F4.3)
- [ ] Card in-app no `SmartAlerts` aparece com 30 dias de antecedência
- [ ] Apenas protocolos ativos (`active = true`) geram alerta
- [ ] Rate limit: 1 alerta/protocolo/gatilho (30d, 7d, 1d)
- [ ] Inline button abre `#/protocolos/:id` para o protocolo específico
- [ ] Zero migration de banco (campo `end_date` já existe)

**Dependências:** messageFormatter (✅ F4.5), Push Notifications (✅ F4.3), SmartAlerts (✅ HCC)
**Impacto Financeiro:** R$ 0

---

### F5.10 Análise de Custo do Tratamento ⭐ NOVO

**Título:** Análise de custo mensal do tratamento usando preços já cadastrados
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 5, N14

**Descrição:**
O campo `unit_price` já existe em `stockSchema.js` e já é coletado dos usuários. Esta feature transforma esse dado dormente em análise de custo mensal, com breakdown por medicamento e comparativo com mês anterior.

**Nota de integração com Fase 5.5:** Este componente alimenta `costAnalysisService.js` da Fase 5.5 (I05), que calcula o custo baseado em **consumo real** (logs) vs o cálculo simples aqui baseado em **consumo teórico**. Ambos coexistem: este (F5.10) é o resumo simples; I05 é a análise inteligente.

**Cálculo:**
```
custo_mensal_medicamento = consumo_teórico_mensal × unit_price_médio
custo_total_mensal = Σ custo_por_medicamento
```

**Requisitos Técnicos:**
- Service `src/features/stock/services/costAnalysisService.js` (versão simples — Fase 5.5 expande)
- Componente `src/features/stock/components/CostSummaryCard.jsx`
- Posição: aba Estoque ou seção de Settings
- Integração: seção opcional no PDF de relatório (F5.1)

**Critérios de Aceitação:**
- [ ] Visível apenas quando >= 1 medicamento tem `unit_price > 0`
- [ ] CTA "Atualizar preço" leva direto ao formulário de estoque do medicamento
- [ ] Comparativo com mês anterior (se dados disponíveis)
- [ ] Incluído como seção opcional no PDF de relatório (F5.1)
- [ ] Zero migration de banco (unit_price já em stockSchema)

**Dependências:** stockSchema (✅ unit_price existente), F5.1 (integração PDF)
**Impacto Financeiro:** R$ 0

---

## 4. Requisitos Não-Funcionais

| Requisito | Especificação | Métrica |
|-----------|--------------|---------|
| Performance | Geração de PDF completo | < 3s para 30 dias |
| Performance | Modo Consulta Médica (1 página) | < 10s |
| Performance | Renderização calendário | < 100ms por mês |
| Performance | Verificação de interações | < 50ms |
| Segurança | Dados no link compartilhado | Sem nome completo ou dados sensíveis |
| Privacidade | Geração de PDF | 100% client-side, zero upload |
| Privacidade | Base de interações | Local, sem chamadas externas |
| Privacidade | Cartão de Emergência | Dados mínimos, opt-in de alergias |
| Acessibilidade | Calendário | Navegável por teclado, cores + ícones |
| Acessibilidade | PDF | Texto selecionável (não imagem) |
| Bundle Size | jsPDF + autotable | Lazy loaded, não impacta bundle inicial (762KB atual) |

---

## 5. Plano de Testes

### 5.1 Testes Unitários (Vitest)

| Componente | Cenários |
|------------|----------|
| reportService | Gera PDF válido, inclui todas as seções, respeita período, disclaimer presente |
| exportService | CSV válido, JSON válido, UTF-8 BOM, unit_price incluído |
| shareService | Gera link, decodifica link, limite de tamanho |
| DoseCalendar | Renderiza mês correto, cores por status, navegação, tolerância 2h |
| interactionService | Detecta interação conhecida, ignora desconhecida, case-insensitive |
| ConsultationCard | Gera resumo 1 página, QR code gerado, dados corretos |
| EmergencyCard | QR code legível, dados offline, formato cartão |
| costAnalysisService | Calcula custo, não exibe sem unit_price, CTA correto |

### 5.2 Testes de Integração

| Cenário | Validação |
|---------|-----------|
| Gerar PDF + análise de custo | PDF inclui seção de custo quando unit_price presente |
| Modo Consulta + QR code | PDF gerado, QR code abre link correto |
| Cartão Emergência offline | Funciona sem internet, QR code escaneável |
| Prescrição vencendo → bot alert | Cron detecta, mensagem enviada com messageFormatter |
| Prescrição vencendo → push | Push notification recebida se opt-in |
| Calendário + DailyDoseModal | Toque em dia abre modal com doses corretas |

### 5.3 Cobertura Alvo

| Métrica | Meta |
|---------|------|
| Cobertura de linhas | > 85% (novos componentes) |
| Cobertura de branches | > 80% |
| Interações na base | >= 200 pares documentados |

---

## 6. Indicadores de Sucesso

| KPI | Baseline | Meta | Ferramenta |
|-----|----------|------|------------|
| Downloads PDF/semana | 0 | > 20% usuários | Analytics local |
| Modo Consulta utilizado | 0 | > 20% usuários | Analytics local |
| Cartão Emergência gerado | 0 | > 15% usuários | Analytics local |
| Alertas prescrição enviados | 0 | Tracking de ocorrências | Supabase/Cron logs |
| Análise de custo visualizada | 0 | > 35% com unit_price | Analytics local |
| Exports de dados | 0 | > 10% usuários | Analytics local |
| Uso calendário visual | 0 | > 30% sessões | Analytics local |
| Alertas interação exibidos | 0 | Tracking | Analytics local |
| Cobertura de testes | 93 críticos | > 120 críticos | Vitest coverage |

---

## 7. Riscos e Mitigações

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| jsPDF bundle impacta carregamento | Média | Médio | Lazy loading (dynamic import) — já previsto |
| Base ANVISA incompleta gera falsa segurança | Alta | Alto | Disclaimer claro em todos os alertas, fonte citada |
| Cartão Emergência com dados desatualizados | Média | Alto | Data de atualização visível, aviso de sincronização |
| QR code muito grande para cartão físico | Média | Baixo | Dados mínimos no QR (JSON comprimido), limite de 4KB |
| Cron de alertas falha silenciosamente | Média | Médio | Logging estruturado, DLQ existente no bot |
| unit_price não preenchido pelos usuários | Alta | Baixo | CTA contextual para preencher, feature só exibe quando disponível |

---

## 8. Cronograma de Implementação

| Ordem | Feature | Dependência | SP |
|-------|---------|-------------|-----|
| 1 | F5.4 Calendário Visual | adherenceService, Hash Router ✅ | 8 |
| 2 | F5.8 Cartão de Emergência | PWA cache ✅, Hash Router ✅ | 5 |
| 3 | F5.9 Rastreador de Prescrições | messageFormatter ✅, Push ✅ | 3 |
| 4 | F5.2 Exportação CSV/JSON | Nenhuma | 5 |
| 5 | F5.1 Relatórios PDF | jsPDF, adherenceService | 13 |
| 6 | F5.7 Modo Consulta Médica | F5.1, F5.3 | 8 |
| 7 | F5.3 Compartilhamento via Link | F5.1 | 5 |
| 8 | F5.5 Notificações Estoque Bot | messageFormatter ✅, Deep Links ✅ | 3 |
| 9 | F5.10 Análise de Custo | unit_price ✅, F5.1 | 5 |
| 10 | F5.6 Alertas Interação ANVISA | SmartAlerts ✅, base JSON | 13 |

---

## 9. Definição de Pronto (DoD)

- [ ] Código implementado e revisado
- [ ] Testes unitários passando com cobertura > 85%
- [ ] PDF gerado corretamente em Chrome, Safari e Firefox
- [ ] Exportação CSV abrível em Excel sem problemas de encoding
- [ ] Calendário responsivo e acessível (tolerância 2h respeitada)
- [ ] Base de interações com >= 200 pares documentados (fonte ANVISA)
- [ ] Disclaimer presente em relatórios e alertas de interação
- [ ] Cartão de Emergência funcional offline
- [ ] Alertas de prescrição disparando via bot e push
- [ ] Análise de custo exibida apenas com unit_price disponível
- [ ] jsPDF lazy loaded (não impacta bundle inicial 762KB)
- [ ] Sem regressão — 93 testes críticos continuam passando

---

## 10. Entregáveis para a Fase 5.5

Ao concluir a Fase 5, os seguintes artefatos estarão prontos para a Fase 5.5 (Inteligência Preditiva):

| Artefato | Usado em |
|----------|---------|
| `costAnalysisService.js` (versão simples) | Fase 5.5 I05 expande com consumo real |
| Dados de `unit_price` incentivados pelo CTA | Fase 5.5 I05 análise de custo real |
| `DoseCalendar.jsx` com padrão visual | Fase 5.5 I02 heatmap herda o padrão de cores |
| Dados de doses históricos acumulados | Fase 5.5 I01–I04 todos dependem desses dados |

---

*Documento revisado em: 21/02/2026*
*Referência: Roadmap 2026 v3.2 - Fase 5*
*Baseline: v2.8.1 (pós-Fase 4 completa)*
*Próxima revisão: após conclusão da Fase 5*
