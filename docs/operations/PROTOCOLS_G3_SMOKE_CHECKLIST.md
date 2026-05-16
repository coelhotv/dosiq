# G3 Smoke Checklist — Tratamentos (Web + Mobile)

> Checklist obrigatório anexado ao PR final da Fase 2 (`feat/crud-protocols` → `main`).
> PO valida em ambientes específicos antes do merge. Todos itens ✅ obrigatórios.
> Estágio: closed alpha (time interno). Reavaliar formalismo pré-beta externo.

---

## Pré-condições

- [ ] G2 mergeado em mãe (`feat/crud-protocols`)
- [ ] PR G3 atômica: somente swap web + factory (sem refactor adicional, sem outro domínio)
- [ ] `git diff main..HEAD --stat` reflete escopo da Fase 2 apenas
- [ ] `rtk npm run validate:agent` web 100% green local
- [ ] Jest mobile 100% green local (`rtk npm test --workspace @dosiq/mobile`)
- [ ] Parity tests `createProtocolRepository.test.js` + `createTreatmentPlanRepository.test.js` passando (mocked client)
- [ ] `rtk npm run build` web OK local
- [ ] ADR-045 aplicado: factories em `@dosiq/core/repositories/` (não em `shared-data/`)
- [ ] Helpers `formatDoseUnit`, `pluralizeDoseUnit`, `formatEndDate`, `formatDatePtBR` em `@dosiq/core/utils/`
- [ ] Glossário (`docs/reference/GLOSSARY.md`) revisado para garantir consistência das strings

---

## Fluxos Críticos Mobile — iOS Simulator

### Empty state
- [ ] Login com usuário sem tratamentos → vê `TreatmentEmptyState` com ilustração + CTA "Criar primeiro tratamento"
- [ ] Tap no CTA abre `ProtocolFormScreen` (create mode)

### Create
- [ ] Tap em "Selecionar medicamento" abre `MedicineSelectorSheet` (bottom sheet 85%)
- [ ] Buscar medicamento na biblioteca (filter funciona, NFD normalize OK)
- [ ] Selecionar medicamento → sheet fecha + `MedicineSelectorRow` mostra estado "selected" com "Trocar"
- [ ] Tap "Trocar" reabre sheet
- [ ] Preencher Nome do tratamento, Dose por tomada (com vírgula `1,5`), Periodicidade Diário, adicionar 2 horários (08:00, 20:00)
- [ ] Suffix do input "Dose por tomada" muda dinamicamente baseado em `medicine.dosage_unit` (ex: "ml" vs "comprimidos" vs "gotas")
- [ ] Tap em "Periodicidade: Semanal" mostra `WeekdaySelector` — togglar dias
- [ ] Plano terapêutico: variação A (select existente) funciona
- [ ] Plano terapêutico: variação B (criar novo inline) funciona — cor + emoji salvam
- [ ] Adicionar Observações
- [ ] Submit com campos válidos → toast sucesso → volta para listagem → tratamento aparece
- [ ] Submit com campos vazios → banner topo `"Preencha os campos obrigatórios"` + inline errors em PT-BR friendly Dona Maria

### Detail
- [ ] Tap em tratamento da listagem abre `ProtocolDetailScreen`
- [ ] Hero card mostra ícone correto: Pill se `medicine.type='medicamento'`, PillBottle se `'suplemento'`
- [ ] Tap no hero card navega para `MedicineDetailScreen` (Fase 1)
- [ ] Badge `✓ Estável` exibido (titration_status)
- [ ] "Em uso há N dias" calculado corretamente
- [ ] Card Dosagem & Frequência: `formatDoseUnit` rende `"2 comprimidos"` / `"15 ml"` / `"3 gotas"` corretamente conforme `dosage_unit`
- [ ] Consumo diário = `dosage_per_intake × time_schedule.length`
- [ ] Card Período: `end_date` null → mostra `"Uso contínuo"` (não "Sem prazo")
- [ ] Card Plano terapêutico aparece se há plano; mostra emoji + nome + "+ N outros tratamentos"
- [ ] Card Plano: se sem plano, mostra CTA "+ Adicionar a um plano"

### Edit
- [ ] Tap ícone editar no AppBar abre form em edit mode
- [ ] Campos preenchidos com valores atuais (dose convertida number→string)
- [ ] Trocar medicamento via sheet funciona
- [ ] Salvar alterações → toast + volta + lista reflete

### Delete (warning soft)
- [ ] Tap "Excluir tratamento" no detail abre `ProtocolDeleteSheet`
- [ ] Sheet mostra histórico: doses confirmadas / pendentes / agendadas (dados de `useProtocolStats`)
- [ ] Banner amarelo `"Excluir o tratamento NÃO apaga o histórico"` visível
- [ ] Tap Cancelar fecha sheet sem ação
- [ ] Tap Excluir confirma → toast → navigation.goBack() → listagem atualiza (tratamento sumiu)
- [ ] Histórico de doses (Tab Hoje, Calendário, Relatórios) MANTÉM doses já registradas

### Refresh / Cache
- [ ] Após criar/editar/excluir, voltar para listagem → cache invalidado, dados frescos
- [ ] Modo offline: sem rede, abrir lista → vê cache AsyncStorage com banner "stale"

### Sem pronomes (R-201)
- [ ] Header listagem: `"Tratamentos"` (não "Meus Tratamentos")
- [ ] Search bar em medicamento selector: `"Buscar em medicamentos..."` (não "meus")
- [ ] Subtitle empty: sem pronome possessivo
- [ ] CTAs: sem pronome

---

## Fluxos Críticos Mobile — Android API 24 Simulator (Crash Prevention)

> Cenário legacy de Hermes — ADR-036 (JS stack já aplicada em TreatmentsStack).

- [ ] Lista de tratamentos carrega sem crash de rn-screens
- [ ] Navegar listagem → detail → form → goBack — sem `IndexOutOfBoundsException`
- [ ] Bottom sheets abrem/fecham (MedicineSelectorSheet, ProtocolDeleteSheet, PlanInlineCreate)
- [ ] TimeSchedulePicker add/remove sem crash
- [ ] WeekdaySelector toggle sem crash

---

## Fluxos Críticos Mobile — Android moderno + iPhone físico

- [ ] Repetir os fluxos críticos iOS sim em pelo menos 1 device físico
- [ ] Haptics disparam (lightTap, selectionTap, successHaptic)
- [ ] Keyboard `decimal-pad` aparece em campos numéricos
- [ ] SafeArea respeitada em iPhone com notch

---

## Fluxos Críticos Web (após swap factory G3)

### CRUD básico
- [ ] Login com usuário com tratamentos
- [ ] Lista de tratamentos web carrega
- [ ] Criar tratamento via UI web → salva e aparece
- [ ] Editar tratamento → atualiza
- [ ] Excluir tratamento → remove

### Joins e relacionamentos
- [ ] Listagem mostra `medicine:medicines(*)` joined corretamente
- [ ] Detalhe mostra `treatment_plan:treatment_plans(*)` joined

### Cross-domain (regressão indireta)
- [ ] Tab **Hoje** — doses do dia renderizam (dependem de protocols)
- [ ] Tab **Calendário** — adesão calcula sem erro
- [ ] Tab **Relatórios** — agregação por tratamento renderiza
- [ ] **Titulação web** — `advanceTitrationStage` funciona (factory mantém método)
- [ ] **Adherence service** — `calculateProtocolAdherence(id, period)` retorna valores

### Multi-tenancy / RLS
- [ ] Usuário A → vê apenas seus tratamentos
- [ ] Logout + login B → vê apenas dele (zero vazamento)

### Console / Network
- [ ] Console limpo (sem erros em runtime)
- [ ] Network: chamadas `medicines.select`, `protocols.select`, `treatment_plans.select` retornam 200
- [ ] Payload de `create/update` matches Zod schema canônico

### Schema canônico
- [ ] Refinements cross-campo (start_date ≤ end_date; weekdays required se frequency in {semanal, personalizado}) bloqueiam payload inválido
- [ ] Mensagens de erro em PT-BR friendly Dona Maria

---

## Critério de aprovação

- [ ] Todos os checks acima ✅
- [ ] Zero regressão detectada
- [ ] Bundle size web: variação < +5% vs main pré-Fase-2 (`rtk npm run build` reporta)
- [ ] Bundle size mobile: variação < +5% (baseline a definir no Spike Pre-Fase-2 / S10)

**Após aprovação**: PO autoriza merge final mãe→main. Agente NUNCA auto-merge (R-060).

---

## Histórico

- 2026-05-16 — esqueleto criado no Spike Pre-Fase-2. Itens detalhados serão refinados durante sprints T2.1-T2.3.
