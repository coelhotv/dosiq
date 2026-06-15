# Feature Specification: Pomadas / Tópicos (mg/g)

**Feature Directory**: `plans/specs/027-topical-ointments`
**Created**: 2026-06-07
**Status**: draft — não iniciar sem priorização do PO
**Tier**: 2 (provável — DB CHECK + core + UI; possivelmente decremento por grama)
**Input**: Solicitação do PO ao revisar o dropdown de unidades da 022 (líquidos). Pomadas adiadas
para épico próprio para não inchar a 022.

> **Origem:** durante a 022 (líquidos) o PO quis adicionar `mg/g` (concentração comum em pomadas)
> ao dropdown de unidades. Decisão: **adiar** — pomada tem modelo de consumo próprio (massa/grama),
> diferente de sólido (unidades) e de líquido (volume/ml). Esta spec preserva a análise de impacto
> feita na 022 para retomada futura.

---

## Context

Suportar medicamentos **tópicos** (pomadas, cremes, géis) no Dosiq. Concentração expressa em
**`mg/g`** (massa de ativo por grama de produto). Persona: paciente aplicando pomada (ex: "aplicar
uma camada fina 2×/dia") — sem contagem natural de "doses".

**Decisão arquitetural-mãe a definir (`[NEEDS CLARIFICATION]`):** como modelar o **consumo** de
pomada?
- (a) **Sem rastreio de estoque** (v1 mínimo): só cadastro + lembrete; não decrementa estoque.
- (b) **Decremento linear como sólido** (reuso imediato): trata bisnaga como "unidades"; impreciso
  (aplicação não é quantificável em g de forma confiável).
- (c) **Estoque por grama + FIFO de massa** (espelha líquidos `/ml`, mas com `/g`): bisnaga de N g,
  decremento por g aplicado. Exige generalizar `consume_stock_fifo` para `/g` além de `/ml`.

A escolha governa todo o tier. **NÃO** chutar — decidir com o PO antes de Planning.

---

## Análise de impacto herdada da 022 (mg/g no dropdown)

Verificada contra o repo em 2026-06-07 (R-270 reality-check):

| Item | Achado | Implicação p/ esta spec |
|------|--------|-------------------------|
| Detecção de líquido | É **só** `dosage_unit LIKE '%/ml'` (RPC) + `endsWith('/ml')` (medicineSchema). Não há detector por presença de `/`. | `mg/g` **nunca** vira líquido por engano ✓. Decremento cai no caminho **linear/sólido** por padrão. |
| **DB CHECK `medicines_dosage_unit_check`** | Em prod (022 Fase A) com set fixo `('mg','mcg','g','ml','ui','un','gotas','mg/ml','ui/ml')`. | **Exige migration nova** adicionando `'mg/g'`. Sem ela, INSERT `mg/g` → constraint violation. |
| Zod `DOSAGE_UNITS` | `['mg','mcg','g','mg/ml','ui/ml','ui','un']` (após 022 Fase B). | Adicionar `'mg/g'` + label + (posição sugerida: junto dos ratios). |
| `units_per_ml` refine | Só exige p/ unidades `/ml`. | `mg/g` não pede densidade ✓ (a menos que opção (c) introduza `units_per_g`). |
| `presentation` | enum já tem `'pomada'`. | Pronto ✓. |
| `doseUnit.js` `convertMetricUnit` | Trata mcg/mg/g/ml; não trata ratios. | Hint de princípio ativo p/ `mg/g` é cosmético (sem crash); refinar se exibir massa de ativo. |
| Decremento `consume_stock_fifo` | Ramo líquido só p/ `/ml`. | Se opção (c), generalizar p/ `/g` (novo branch + `intake_unit` físico tipo `g`/`aplicacao`). |

**Risco residual:** baixo para cadastro/lembrete; médio-alto se optar por estoque-por-grama
(toca a RPC viva — aplicar R-270 preflight + diff `pg_get_functiondef`, AP-217).

---

## User Scenarios (rascunho — refinar no Planning)

- **US1**: cadastrar pomada com concentração `mg/g` e forma `pomada`.
- **US2**: lembrete de aplicação tópica (sem unidade de "dose" rígida).
- **US3** (condicional à opção c): registrar aplicação e decrementar estoque por grama.

## Requirements (rascunho)

- **FR-001**: estender CHECK `medicines_dosage_unit_check` + `DOSAGE_UNITS` com `'mg/g'` (migration + Zod + label).
- **FR-002**: `presentation='pomada'` no cadastro (UI dedicada de forma — coordena com 012/022).
- **FR-003** `[NEEDS CLARIFICATION]`: modelo de consumo (a/b/c acima).

## Open Questions

1. Modelo de consumo de pomada (sem estoque / linear / por-grama-FIFO)? — bloqueia o tier.
2. Existe demanda real de rastreio de estoque de tópicos, ou cadastro+lembrete basta no v1? (YAGNI)
3. Outras unidades tópicas no mesmo épico (`%`, `mg/cm²`)?

---

> **Sequenciamento:** depende da fundação da 022 (enum `dosage_unit` extensível, `presentation`,
> parede de unidade ADR-052). Iniciar só após 022 mergeada e com priorização explícita do PO.
