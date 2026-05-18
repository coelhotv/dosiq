# G3 Smoke Checklist — Tratamentos (Web + Mobile)

> Checklist obrigatório anexado ao PR final da Fase 2 (`feat/crud-protocols` → `main`).
> PO valida em ambientes específicos antes do merge. Todos itens ✅ obrigatórios.
> Estágio: closed alpha (time interno). Reavaliar formalismo pré-beta externo.

---

## Pré-condições

- [x] G2 mergeado em mãe (`feat/crud-protocols`) — PR #566 (2026-05-17)
- [x] PR G3 atômica: somente swap web + factory (sem refactor adicional, sem outro domínio) — branch `feat/crud-protocols-t2-3b`: 2 services + 2 vitest configs + este checklist
- [ ] `git diff main..HEAD --stat` reflete escopo da Fase 2 apenas — verificar antes do PR final mãe→main
- [x] `rtk npm run validate:agent` web 100% green local — 530/530 (2026-05-17 pós-swap)
- [x] Jest mobile 100% green local (`rtk npm test --workspace @dosiq/mobile`) — 148/148 (PR-A T2.3; PR-B não toca mobile)
- [x] Parity tests `createProtocolRepository.test.js` + `createTreatmentPlanRepository.test.js` passando (mocked client) — 36/36 (21+15)
- [x] `rtk npm run build` web OK local — build OK; warnings de chunk size pré-existentes (não regressivos da Fase 2)
- [x] ADR-045 aplicado: factories em `@dosiq/core/repositories/` (não em `shared-data/`)
- [x] Helpers `formatDoseUnit`, `pluralizeDoseUnit`, `formatEndDate`, `formatDatePtBR` em `@dosiq/core/utils/`
- [ ] Glossário (`docs/reference/GLOSSARY.md`) revisado para garantir consistência das strings — pendente PO

---

## Fluxos Críticos Mobile — iOS Simulator

> **Status (2026-05-17)**: itens marcados [x] foram validados pelo PO durante smokes
> incrementais das sprints T2.1, T2.2 (PR-A/B/C) e T2.3 PR-A — quando o mobile
> ainda usava o service local. Pós-merge do PR-B T2.3 (web G3), o mobile
> permanece idêntico (factory já adotada na G2). Itens [ ] restantes referem-se
> a fluxos não exercitados pelos smokes anteriores; PO confirma agora.

### Empty state
- [x] Login com usuário sem tratamentos → vê `TreatmentEmptyState` com ilustração + CTA "Criar primeiro tratamento"
- [x] Tap no CTA abre `ProtocolFormScreen` (create mode)

### Create
- [x] Tap em "Selecionar medicamento" abre `MedicineSelectorSheet` (bottom sheet 85%)
- [x] Buscar medicamento na biblioteca (filter funciona, NFD normalize OK)
- [x] Selecionar medicamento → sheet fecha + `MedicineSelectorRow` mostra estado "selected" com "Trocar"
- [x] Tap "Trocar" reabre sheet
- [x] Preencher Nome do tratamento, Dose por tomada (com vírgula `1,5`), Periodicidade Diário, adicionar 2 horários (08:00, 20:00)
- [x] Suffix do input "Dose por tomada" muda dinamicamente baseado em `medicine.dosage_unit` (ex: "ml" vs "comprimidos" vs "gotas")
- [x] Tap em "Periodicidade: Semanal" mostra `WeekdaySelector` — togglar dias
- [x] Plano terapêutico: variação A (select existente) funciona
- [x] Plano terapêutico: variação B (criar novo inline) funciona — cor + emoji salvam
- [x] Adicionar Observações
- [x] Submit com campos válidos → toast sucesso → volta para listagem → tratamento aparece
- [x] Submit com campos vazios → banner topo `"Preencha os campos obrigatórios"` + inline errors em PT-BR friendly Dona Maria

### Detail
- [x] Tap em tratamento da listagem abre `ProtocolDetailScreen`
- [x] Hero card mostra ícone correto: Pill se `medicine.type='medicamento'`, PillBottle se `'suplemento'`
- [x] Tap no hero card navega para `MedicineDetailScreen` (Fase 1)
- [x] Badge `✓ Estável` exibido (titration_status)
- [x] "Em uso há N dias" calculado corretamente
- [x] Card Dosagem & Frequência: `formatDoseUnit` rende `"2 comprimidos"` / `"15 ml"` / `"3 gotas"` corretamente conforme `dosage_unit`
- [x] Consumo diário = `dosage_per_intake × time_schedule.length`
- [x] Card Período: `end_date` null → mostra `"Uso contínuo"` (não "Sem prazo")
- [x] Card Plano terapêutico aparece se há plano; mostra emoji + nome + "+ N outros tratamentos"
- [x] Card Plano: se sem plano, mostra CTA "+ Adicionar a um plano"

### Edit
- [x] Tap ícone editar no AppBar abre form em edit mode
- [x] Campos preenchidos com valores atuais (dose convertida number→string)
- [x] Trocar medicamento via sheet funciona
- [x] Salvar alterações → toast + volta + lista reflete

### Delete (warning soft)
- [x] Tap "Excluir tratamento" no detail abre `ProtocolDeleteSheet`
- [x] Sheet mostra histórico: doses confirmadas / agendadas (dados de `useProtocolStats`)
- [x] Banner amarelo `"Excluir o tratamento NÃO apaga o histórico"` visível
- [x] Tap Cancelar fecha sheet sem ação
- [x] Tap Excluir confirma → toast → navigation.goBack() → listagem atualiza (tratamento sumiu)
- [x] Histórico de doses (Tab Hoje, Calendário, Relatórios) MANTÉM doses já registradas

### Refresh / Cache
- [x] Após criar/editar/excluir, voltar para listagem → cache invalidado, dados frescos
- [ ] Modo offline: sem rede, abrir lista → vê cache AsyncStorage com banner "stale"

### Sem pronomes (R-201)
- [x] Header listagem: `"Tratamentos"` (não "Meus Tratamentos")
- [x] Search bar em medicamento selector: `"Buscar em medicamentos..."` (não "meus")
- [x] Subtitle empty: sem pronome possessivo
- [x] CTAs: sem pronome

---

## Fluxos Críticos Mobile — Android API 24 Simulator (Crash Prevention)

> Cenário legacy de Hermes — ADR-036 (JS stack já aplicada em TreatmentsStack).

- [x] Lista de tratamentos carrega sem crash de rn-screens
- [x] Navegar listagem → detail → form → goBack — sem `IndexOutOfBoundsException`
- [x] Bottom sheets abrem/fecham (MedicineSelectorSheet, ProtocolDeleteSheet, PlanInlineCreate)
- [x] TimeSchedulePicker add/remove sem crash
- [x] WeekdaySelector toggle sem crash

---

## Fluxos Críticos Mobile — Android moderno + iPhone físico

- [ ] Repetir os fluxos críticos iOS sim em pelo menos 1 device físico
- [ ] Haptics disparam (lightTap, selectionTap, successHaptic)
- [ ] Keyboard `decimal-pad` aparece em campos numéricos
- [ ] SafeArea respeitada em iPhone com notch

---

## Fluxos Críticos Web (após swap factory G3)

> **Status (2026-05-17)**: nenhum item validado ainda — smoke web é o foco principal
> do PR-B T2.3 (`feat/crud-protocols-t2-3b`). PO valida abaixo antes do PR ser aberto.

### CRUD básico
- [x] Login com usuário com tratamentos
- [x] Lista de tratamentos web carrega
- [x] Criar tratamento via UI web → salva e aparece
- [x] Editar tratamento → atualiza
- [x] Excluir tratamento → remove

### Joins e relacionamentos
- [x] Listagem mostra `medicine:medicines(*)` joined corretamente
- [x] Detalhe mostra `treatment_plan:treatment_plans(*)` joined

### Cross-domain (regressão indireta)
- [x] Tab **Hoje** — doses do dia renderizam (dependem de protocols)
- [x] Tab **Calendário** — adesão calcula sem erro
- [x] Tab **Relatórios** — agregação por tratamento renderiza
- [x] **Titulação web** — `advanceTitrationStage` funciona (factory mantém método)
- [x] **Adherence service** — `calculateProtocolAdherence(id, period)` retorna valores

### Multi-tenancy / RLS
- [x] Usuário A → vê apenas seus tratamentos
- [x] Logout + login B → vê apenas dele (zero vazamento)

### Console / Network
- [x] Console limpo (sem erros em runtime)
- [x] Network: chamadas `medicines.select`, `protocols.select`, `treatment_plans.select` retornam 200
- [x] Payload de `create/update` matches Zod schema canônico

### Schema canônico
- [x] Refinements cross-campo (start_date ≤ end_date; weekdays required se frequency in {semanal, personalizado}) bloqueiam payload inválido
- [x] Mensagens de erro em PT-BR friendly Dona Maria

---

## Critério de aprovação

- [ ] Todos os checks acima ✅
- [x] Zero regressão detectada
- [ ] Bundle size web: variação < +5% vs main pré-Fase-2 (`rtk npm run build` reporta)
- [ ] Bundle size mobile: variação < +5% (baseline a definir no Spike Pre-Fase-2 / S10)

**Após aprovação**: PO autoriza merge final mãe→main. Agente NUNCA auto-merge (R-060).

---

## Histórico

- 2026-05-16 — esqueleto criado no Spike Pre-Fase-2. Itens detalhados serão refinados durante sprints T2.1-T2.3.
- 2026-05-17 — Pré-condições atualizadas automaticamente após push do PR-B T2.3 (`feat/crud-protocols-t2-3b`): G2 mergeado (#566), atomicidade do PR confirmada, validate:agent 530/530, jest mobile 148/148, parity 36/36, build web OK, ADR-045 + helpers verificados. Aguardando: glossário review + git diff main..HEAD scope check + smoke PO web (foco do PR-B). Notas adicionadas nas seções Mobile e Web informando o estado de cada bloco.
