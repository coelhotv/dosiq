# Guia de Implementação: Health Command Center

Este documento estabelece as diretrizes técnicas, funcionais e operacionais para a implementação do **Health Command Center**, conforme definido na Proposta de Redesign UX e Especificação Técnica.

---

## 1. Engenharia de Software

### 1.1 Arquitetura de APIs & Dados
A implementação baseia-se no consumo proativo de dados do Supabase através do cache SWR.

- **Novos Schemas (Zod):**
  - `dashboardContextSchema`: Validação do estado consolidado (scores, próximos alertas, criticidade).
  - `batchRegistrationSchema`: Extensão do `logBulkCreateSchema` para suporte a registros vinculados a protocolos específicos.
- **Lógica de Integração:**
  - O `useDashboardContext` deve orquestrar a leitura paralela de `medicines`, `protocols` e `logs` dos últimos 30 dias.
  - **Custo Zero:** Proibido disparar novas queries SQL para cálculos de score. Utilize `Array.reduce` sobre os dados em memória (cache).

### 1.2 Componentização UI (Atomic Design)
Os componentes devem ser criados em `src/components/dashboard/`.

| Componente | Responsabilidade | Props Principais | Estados |
|------------|------------------|------------------|---------|
| `HealthScore` | Gráfico circular (SVG) + Label | `score: number`, `trend: 'up'\|'down'` | Loading (Skeleton), Error |
| `SmartAlertCard` | Card de alerta contextual | `type: 'critical'\|'warning'`, `cta: string`, `onAction: func` | Dismissed, Processing |
| `AccordionTreatment` | Container de protocolos | `protocol: object`, `isExpanded: boolean` | Collapsed, Expanded |
| `SwipeRegisterItem` | Item individual com gesto | `medicineId: string`, `onSuccess: func` | Idle, Dragging, Success |

- **Padrões de Interação:**
  - **Swipe:** Threshold de 70% da largura para disparo via `Framer Motion`.
  - **Accordion:** Transição suave de altura (`height: auto`) com `animate="open"`.
  - **Batch Update:** Botão "Registrar Todos em Lote" deve invocar `logService.createBulk` e invalidar o cache SWR de `logs` e `adherence`.

---

## 2. Gestão de Produto

### 2.1 Mapeamento Funcional (KPIs)
| Funcionalidade | KPI Atendido | Impacto Esperado |
|----------------|--------------|------------------|
| **Health Score** | Aderência Terapêutica | Aumento de 15% na consistência de registros. |
| **Smart Alerts** | Proatividade | Redução de 25% no tempo médio de latência (atraso de dose). |
| **Batch Registration** | Redução de Fricção | Diminuição de cliques repetitivos em protocolos complexos. |

### 2.2 Matriz de Rastreabilidade
- **REQ-01 (UX):** Visualização "At-a-glance" -> **FUNC:** Hero Section compacta com Health Score.
- **REQ-02 (UX):** Redução de erro tátil -> **FUNC:** Gesto Swipe para confirmação de dose individual.
- **REQ-03 (UX):** Organização de protocolos -> **FUNC:** Padrão Accordion para agrupamento de medicamentos.

---

## 3. Garantia de Qualidade (QA)

### 3.1 Critérios de Aceite Granulares
- **AC1:** O registro de dose via Swipe deve ser refletido na UI em menos de 100ms (Optimistic UI).
- **AC2:** O Health Score deve ser recalculado automaticamente após qualquer registro de dose.
- **AC3:** Em caso de falha na API, o estado do Swipe deve reverter (rollback) com uma notificação de erro.
- **AC4:** Alertas críticos devem aparecer no topo da lista, independente da ordem cronológica.

### 3.2 Cenários de Teste (Caminho Crítico)
1. **Dose Atrasada:** Verificar se o `SmartAlert` muda de cor para `var(--neon-pink)` após 15min de atraso.
2. **Protocolos Múltiplos:** Testar o `Batch Registration` com 5+ medicamentos simultâneos.
3. **Offline Mode:** Verificar se o registro via Swipe é enfileirado ou se apresenta feedback de "Sem Conexão" apropriado.

---

## 4. Operações e Infraestrutura (DevOps)

### 4.1 Estratégia de Branching (Git)
Seguir rigorosamente o [`docs/PADROES_CODIGO.md`](../docs/PADROES_CODIGO.md):
- **Branch:** `feature/wave-3/health-command-center`
- **Commits:** Semânticos (ex: `feat(dashboard): implement health score engine`).

### 4.2 Pipeline CI/CD (Vercel)
- **Preview Deploy:** Gerado automaticamente para cada Pull Request.
- **Production:** Deploy via merge em `main` após aprovação do `Qualidade Agent`.
- **Variáveis de Ambiente:** Garantir que `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estejam configuradas no Dashboard da Vercel.

---

## 5. Conformidade Arquitetural
- **Cores:** Usar estritamente as variáveis de [`src/styles/tokens.css`](../src/styles/tokens.css).
- **Hooks:** Respeitar o padrão `use + PascalCase`.
- **Arquitetura:** Lógica de negócio mantida em `src/services/api/` e orquestrada por `src/hooks/`.

---
*Elaborado por: Arquiteto de Soluções Sênior*
