# Épico (draft): Dosiq — Suporte a Pacientes Diabéticos (Insulina + Glicemia)

> **Status:** draft de entrada para planning de épico próprio. **NÃO** é o refactor `dose_instances` em curso.
> **Revisão (2026-05-28):** documento original (consultor externo) corrigido contra o schema real do dosiq e contra o refactor `dose_instances` em andamento (ADR-048). A **Seção 0 (contexto clínico) foi preservada** — é sólida. As Seções 1-7 foram reescritas: nomes de tabela reais, campos no lugar certo, e a "parede de unidades" que o original subestimou.
> **Pré-requisito:** depende do refactor `dose_instances` (Fases 2-4) aterrissado. Os *future-proofings* FP-1..FP-4 (**ADR-050**) já preparam a fundação; este épico constrói o que sobra.
> **Decisão de roadmap:** **ADR-050** — diabetes é épico próprio pós-refactor, não fusão.
> **Atualização (2026-05-29) — ADR-052:** (1) Colunas de dose já são `numeric` em prod (`expected_dose`/`quantity_taken`/`dosage_per_intake`) → UI fracionada já cabe, **sem migration de coluna** (a parede de unidade é cap Zod + decremento de estoque + display, não o tipo da coluna). (2) A parede de unidade é **compartilhada com o épico de líquidos** — uma fundação. **Sequência: líquidos ANTES de diabetes** (líquidos destrava a unidade sem biomarcadores/TTL/SaMD; diabetes reusa). (3) FP-1 vira seam concreto na Fase 3: **modo de adesão por protocolo** (binário-evento vs exatidão-de-dose).

---

## 0. Contexto

### O.1 Paciente como "Pâncreas Artificial": O Contexto Físico e Mental do Diabetes

**Para: Time de Produto e Engenharia do Dosiq**
**Objetivo:** Compreender a jornada diária do paciente diabético (insulino-dependente) para conectarmos nossos épicos de código à realidade de quem usará o software.

Desenvolver para diabetes não é criar um "alarme de remédios". Quando o pâncreas de uma pessoa para de produzir insulina (Diabetes Tipo 1) ou o corpo cria resistência a ela (Diabetes Tipo 2 severa), **o paciente é obrigado a assumir manualmente as funções de um órgão vital 24 horas por dia**.

Abaixo, detalhamos a carga física, cognitiva e logística dessa rotina, e como isso justifica as mudanças que faremos na arquitetura do Dosiq.

### 0.2. A Rotina Física (O Ciclo Interminável)

O tratamento intensivo exige que o paciente tome decisões e execute procedimentos físicos de 4 a 8 vezes por dia. O ciclo consiste em três etapas inseparáveis:

1. **Medição (O Output):** O paciente precisa furar o dedo para medir a glicemia no sangue ou escanear um sensor no braço. Sem saber o valor atual, ele "voa às cegas".
2. **O Cálculo (A Carga Cognitiva):** Diferente de uma aspirina que tem dose fixa, o paciente precisa fazer a matemática mentalmente antes de aplicar a dose de insulina. O cálculo geralmente envolve: `(Glicemia Atual - Glicemia Alvo) / Fator de Sensibilidade + (Carboidratos / Relação Insulina-Carbo)`. Esse processo diário é exaustivo.
3. **A Injeção (O Input):** Por ser um hormônio proteico, a insulina seria destruída pelo ácido do estômago se tomada em pílulas. Por isso, ela precisa ser injetada no tecido subcutâneo.

### 0.3. A Complexidade do Tratamento: Basal e Bolus

O tratamento tenta simular o comportamento de um pâncreas saudável através de dois tipos de insulina:

| Tipo de Protocolo | O que é | Objetivo Físico | Frequência |
| --- | --- | --- | --- |
| **Basal (Fundo)** | Insulina de ação longa ou ultralonga | Manter a glicose estável durante o jejum e o sono | 1 ou 2x ao dia. **Exige extrema pontualidade** |
| **Bolus (Refeição)** | Insulina de ação rápida ou ultrarrápida | Cobrir o pico de glicose após comer | Antes de cada refeição. **Dose variável** |

**O Desafio dos Dados:** no bolus, o usuário pode injetar 10 UI no almoço e 2 UI no jantar, dependendo do que vai comer e de como está o açúcar no sangue. Isso quebra a lógica de "1 comprimido por dia" dos bancos de dados tradicionais.

### 0.4. A Logística Biológica da Insulina

Estamos lidando com um *agente biológico*, o que muda as regras de estoque e consumo:

* **A Métrica (UI):** as doses não são em miligramas, mas em UI (Unidades Internacionais), medida de efeito biológico. O padrão global U-100 significa que 1 ml contém 100 UI.
* **A Validade após Aberto:** diferente de uma cartela de comprimidos que dura até o vencimento da caixa, a insulina vence em **28 a 30 dias após aberta**, mesmo que a caneta/frasco ainda esteja cheio — a proteína perde eficácia.

### 0.5. O "Reason Why": Conectando o Contexto à Engenharia

* **Inputs dinâmicos de dose:** se o paciente comer uma feijoada, aplica uma dose; salada, outra. O Dosiq precisa permitir ajustar as UI no momento do *check* do lembrete, com fricção zero.
* **Timeline unificada (insulina + glicemia):** rastrear só a insulina conta metade da história. Paciente e endocrinologista precisam cruzar dose aplicada × impacto na glicemia para decidir.
* **Cronômetro de validade biológica (TTL):** injetar insulina vencida (>30 dias de aberta) não reduz a glicose esperada → risco de cetoacidose. O estoque precisa avisar por **tempo de uso**, não só quando o volume zera.

**Resumo para a squad:** cada linha que otimiza o *fast-logging* de glicemia ou flexibiliza o registro de dose retira uma pedra da montanha de ruído cognitivo do paciente. O objetivo aqui não é só lembrar; é aliviar a carga de quem gerencia o próprio metabolismo.

---

## 1. Visão Arquitetural e Princípios

Diabetes move o Dosiq de "gerenciador de doses estáticas" para "registro de eventos metabólicos correlacionados": registrar a **causa** (insulina/carboidratos) e o **efeito** (glicemia), com inputs em tempo real e fricção mínima, mantendo *Zero Cognitive Noise* e performance fluida em iPhone 13 e Androids antigos.

**O que o refactor `dose_instances` já entrega de graça (ADR-050):**

| Necessidade diabética | Já existe no dosiq (pós-refactor) |
|---|---|
| Dose planejada (basal: alarme prevê 15 UI) | `dose_instances.expected_dose` (congelada na geração) |
| Dose aplicada (bolus: injetou 12 UI) | `medicine_logs.quantity_taken` (registrada no ato, editável) |
| Elo planejada↔aplicada | `medicine_logs.dose_instance_id` (em prod desde PR-F2.1) |
| Tolerância apertada p/ basal | `dose_instances.tolerance_minutes` por instância (FP-2) |
| Linha do tempo cross-meia-noite | timeline event-agnóstica da Fase 4 (FP-3) |

→ **O par `planned_amount`/`applied_amount` do plano original já existe**, com outros nomes. Este épico **não** recria isso; foca no que sobra: **unidades, glicemia, validade biológica**.

---

## 2. Modelagem de Dados (Supabase) 

### A. `medicines` (definição do medicamento)
* **Forma de administração:** hoje `medicines.type` no DB = CHECK `('medicamento','suplemento')` (categoria), **não** forma farmacêutica. Não há flag clara de "injetável". **Decidir:** adicionar `form`/`is_injectable`, ou derivar de `dosage_unit='ui'`. (A camada Zod tem `MEDICINE_TYPES` com `injecao`, mas pode não estar persistida como coluna — **verificar no planning**.)
* **`shelf_life_days` (int, nullable):** TTL após aberto (insulina ≈ 30). Fica na **definição** porque é propriedade do produto. **NÃO** reaproveitar `expiration_date` (validade da caixa, data fixa) — são conceitos distintos.

### B. `stock` (lote físico)
* **`opened_at` (timestamptz, nullable):** Cada caneta/frasco é uma linha de `stock` com sua própria abertura. O TTL biológico é `opened_at + medicines.shelf_life_days`, calculado por lote.

### C. `dose_instances` / `medicine_logs` (dose planejada/aplicada)
* **Sem colunas novas para o par planned/applied** — já coberto por `expected_dose` (instance) e `quantity_taken` (log). **FP-1.**
* **Parede de unidades (FP-4 — o trabalho real):** hoje `quantity_taken` = nº de comprimidos (limite Zod 100); estoque decrementa contagem de cp (`consume_stock_fifo`). Insulina = UI/volume. Precisa de:
  - dose e estoque expressos na **unidade de administração** (`medicines.dosage_unit`, que já inclui `'ui'`);
  - caminho de decremento **unit-aware** (UI aplicadas → volume da caneta), em paralelo ao pill-cêntrico;
  - revisar o limite Zod 100 (bolus raramente >100 UI, mas a semântica "100 comprimidos" é inválida para UI);
  - `formatDoseUnit` deixar de retornar sempre "unidade(s)" (ADR-046) e respeitar UI/ml/cp.

### D. Nova tabela: `biomarkers_log` (glicemia) — net-new genuíno
```sql
CREATE TABLE public.biomarkers_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  type         text NOT NULL DEFAULT 'glicemia',   -- extensível (pressão, peso...)
  value        numeric NOT NULL,                    -- mg/dL para glicemia
  unit         text NOT NULL DEFAULT 'mg/dL',
  measured_at  timestamptz NOT NULL,
  context      text,        -- jejum | pre_prandial | pos_prandial | madrugada | aleatorio
  source       text NOT NULL DEFAULT 'manual',      -- manual | cgm_healthkit | cgm_googlefit
  notes        text,
  created_at   timestamptz DEFAULT now()
);
-- Grants obrigatórios (CLAUDE.md): REVOKE anon; GRANT authenticated+service_role; RLS user_id=auth.uid()
```
Enums em português (R-021). `source` permite futura ingestão de CGM sem migration.

---

## 3. Lógica de Domínio e Regras de Negócio

### A. Motor de estoque híbrido (volume + validade biológica)
Fim do estoque de uma insulina dispara pelo que ocorrer **primeiro**:
1. **Esgotamento físico:** somatório de UI aplicadas atinge o volume do lote (ex.: 300 UI). Reusa o motor de estoque atual, mas na unidade UI (FP-4).
2. **Expiração biológica:** `stock.opened_at + medicines.shelf_life_days ≤ hoje`. Alerta ativo: "Caneta vencida por tempo de uso — inicie um novo refil."

O sistema de status de estoque atual (4 tiers por dias-de-suprimento, ADR-018) ganha um **eixo paralelo** de expiração-por-abertura. Não substitui; coexiste.

### B. Adesão precisa de modo por protocolo (impacto na Fase 3 do refactor)
- **Basal:** binário (tomou/não tomou, dose fixa) — adesão atual funciona.
- **Bolus:** dose variável + refeição pode ser pulada → "% de adesão" pelo denominador atual **mente**. Precisa de modo "adesão binária de evento" vs "exatidão de dose", **por protocolo**. (FP-1 já garante que a adesão não assume `aplicada==planejada`.)

### C. Correlação de eventos (timeline híbrida)
A timeline da Fase 4 (event-agnóstica, FP-3) recebe `biomarkers_log` como um tipo de evento ao lado de `dose`. Ordenação por instante absoluto já planejada → glicemia → dose → glicemia subsequente, sem reescrever a timeline.

---

## 4. Requisitos de UX/UI (Mobile First)

* **Fast-logging unificado:** FAB → bottom sheet único registrando glicemia (mg/dL) e insulina aplicada (UI) na mesma tela, teclados numéricos grandes. (Reusar o `FormSelect`/bottom-sheet nativo já hardenizado — AP-180.)
* **Densidade do "hoje":** um T1 usa basal (1-2x) **e** bolus (3x) simultâneos → 5-8 eventos/dia. O dashboard precisa disso sem virar ruído (tensão com Zero Cognitive Noise — agrupar por refeição/período ajuda). `treatment_plans` já agrupa multi-protocolo.
* **Feedback de estoque crítico:** diferenciar esgotamento por **volume** (gota vazia) de **validade biológica** (relógio/alerta).
* **Edição de dose no check:** o "Tomar" abre input editável da quantidade aplicada (FP-1; já existe no LogForm — formalizar e dar destaque para insulina).
* **Exportação clínica:** PDF aproximando-se de formatos reais (AGP — perfil glicêmico ambulatorial) cruzando dose × glicemia por bloco do dia. "Agrupar por período" é o piso, não o teto.

---

## 5. Roadmap do Épico (após o refactor `dose_instances`)

* **E1 — Parede de unidades (UI/volume):** dose e estoque unit-aware; `formatDoseUnit` por unidade; revisar limite Zod; modelar forma injetável. *É o bloco mais profundo — sem ele o resto exibe/calcula errado.*
* **E2 — Glicemia (`biomarkers_log`) + fast-logging + timeline híbrida** (habilitada por FP-3).
* **E3 — Validade biológica:** `stock.opened_at` + `shelf_life_days` + alerta dedicado + UI de "abrir caneta".
* **E4 — Exportação médica (AGP-like).**
* **E5 (opcional, alto valor/alto custo):** integração CGM (Libre/Dexcom) via HealthKit/Google Fit (`source='cgm_*'`).

---

## 6. Riscos e Perspectivas (atenção)

* **🔴 Linha SaMD (dispositivo médico):** sugerir ativamente a dose de insulina a partir da glicemia torna o app **dispositivo médico regulado** (ANVISA/FDA). **Manter registro passivo + relatório.** Até armazenar carboidratos para a fórmula de bolus aproxima da linha — **decidir conscientemente o que NÃO logar/calcular.**
* **Criticidade de notificação:** esquecer basal pode causar cetoacidose. Confiabilidade (DLQ/retry) deixa de ser conveniência e vira **responsabilidade clínica** — eleva a barra de qualidade da stack de notificação.
* **Dados de saúde:** glicemia é dado clínico sensível; reforçar RLS, disclaimers e tratar acurácia da entrada manual.
* **CGM:** maior valor (glicemia automática, fricção ~zero) e maior custo de engenharia (nativo, somos Expo/RN — viável, não trivial).

---

## 7. Perguntas Abertas (decidir no planning do épico)

1. **Agendamento por relógio vs. por refeição:** bolus é "antes do café/almoço/jantar", não "08:00". Modelar como horário aproximado fixo ou como evento-de-refeição? (`time_schedule` hoje é cronológico.)
2. **Persona-alvo:** T1 (insulino-dependente, jovem/cuidador, tech-savvy) vs T2 (mais velho, pílula+basal, público atual + foco idoso ADR-023). Por qual começar?
3. **Forma injetável no schema:** adicionar coluna `form`/`is_injectable` ou derivar de `dosage_unit='ui'`? Verificar se `MEDICINE_TYPES` (Zod) está persistido.
4. **Carb counting:** logar carboidratos (útil clinicamente) aproxima da linha SaMD — entra ou fica fora?
5. **Eventos não-agendados:** hipoglicemia/resgate (glicose, glucagon) — registrar como evento de emergência? Intersecta o cartão de emergência existente.
6. **Limite Zod de `quantity_taken`:** novo teto/validação por unidade (UI vs cp)?
7. **Rotação de sítio de injeção** (lipo-hipertrofia): logar atributo de local? Provável v2+.
8. **Formato do PDF clínico:** quão perto do AGP padrão precisamos chegar para ser útil ao endocrinologista?

---

## 8. Action Plan (corrigido)

**Não** começar mexendo no schema agora. Sequência correta:
1. **Terminar o refactor `dose_instances`** (Fases 2-4) — ele corrige bug ativo e constrói a fundação (FP-1..FP-4 já garantidos por ADR-050).
2. **Abrir planning do épico de diabetes** com este draft como entrada, resolvendo as perguntas da §7.
3. **Primeiro bloco técnico real = E1 (parede de unidades)** — é o gargalo que destrava E2-E4. Só então `biomarkers_log` e fast-logging.
