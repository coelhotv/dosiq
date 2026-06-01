# Feature Specification: Patient Dose History

**Feature Directory**: `plans/specs/003-patient-dose-history`  
**Created**: 2026-06-01  
**Status**: Migrated Draft  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` §M1.1

---

## Context

Para que o paciente (particularmente idosos com rotinas complexas de múltiplos medicamentos) consiga acompanhar o que já tomou ou esqueceu no dia e nos dias anteriores, é fundamental expor uma visualização de histórico cronológico legível. Esta feature provê um calendário compacto em linha na Home do aplicativo móvel nativo e uma aba de histórico detalhada, permitindo também mutações retroativas caso o usuário tenha esquecido de registrar o check-in na hora exata.

---

## User Scenarios & Testing

### User Story 1 - Visualização de Dose Zones do Dia (Priority: P1)
**Why this priority**: Crucial para o paciente ver o status atual de suas doses sem atrito de navegação.
**Independent Test**: Carregar a Home do aplicativo, verificar se a lista exibe as doses pendentes, tomadas e atrasadas separadas por período (Manhã, Tarde, Noite, Madrugada).

**Acceptance Scenarios**:
1. Given que Dona Maria abriu o app de manhã, When visualizar a timeline principal, Then deve ver a lista de doses de hoje ordenadas cronologicamente, com chips coloridos de fácil identificação baseados no status (`taken`, `missed`, `pending`, `skipped_user`).

### User Story 2 - Registro Retroativo e Reversão (Priority: P1)
**Why this priority**: Permite corrigir erros comuns de esquecimento ou cliques acidentais.
**Independent Test**: Clicar em um registro de dose histórico pendente e registrar como tomado às 14:00 (retroativo); ou clicar em uma dose tomada por engano e reverter para pendente, validando no Supabase a alteração.

**Acceptance Scenarios**:
1. Given que Dona Maria esqueceu de registrar a Losartana das 08:00, When ela clicar no registro correspondente no calendário e selecionar "Tomei com atraso", Then o status deve atualizar para `taken` com o timestamp retroativo e recalcular o heatmap de aderência.
2. Given uma dose marcada como tomada por engano, When Dona Maria abrir a sheet de detalhes e clicar em "Desfazer Registro", Then o status da `dose_instances` correspondente deve voltar para `pending` ou `missed` de acordo com a hora local.

---

## Edge Cases

- **TimeZone e Boundaries locais (GMT-3):** As instâncias de doses devem ser computadas no fuso horário do usuário. Operações que alteram status na virada do dia devem usar `parseLocalDate()` para evitar que uma dose das 23:30 seja gravada no dia seguinte.
- **Conflito de Mutação Local vs. Remota (Cuidador):** Se o paciente e o cuidador alterarem a mesma dose simultaneamente, a mutação deve usar controle de concorrência por otimização de cache (invalidação SWR imediata).

---

## Requirements

### Functional Requirements

- **FR-001:** Exibir calendário expansível em linha na Home com área de toque mínima de 60px para cada dia (acessibilidade para idosos).
- **FR-002:** Exibir lista cronológica de doses baseada exclusivamente na tabela `dose_instances` (status: `taken`, `missed`, `pending`, `skipped_user`).
- **FR-003:** Permitir abertura de modal/bottom sheet nativa ao tocar em uma instância para registro retroativo e exclusão/desfazer de logs.
- **FR-004:** Toda mutação de histórico deve invalidar de imediato os snapshots e caches locais de aderência diária e semanal (`useMutation`).

### Key Entities

- **DoseInstance:** Tabela materializada central do refactor Fase 3 (`dose_instances`), contendo campos de status e taken_at.

---

## Success Criteria

- **SC-001:** FPS estável ≥ 55fps na rolagem e alternância de dias do calendário.
- **SC-002:** Invalidação e sincronização de dados de histórico em < 200ms após mutação retroativa.
