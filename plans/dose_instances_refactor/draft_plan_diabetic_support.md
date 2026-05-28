# Master Plan: Dosiq – Suporte Ouro a Agentes Biológicos (Diabetes)

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

O tratamento tenta simular exatamente o comportamento de um pâncreas saudável através de dois tipos de insulina:

| Tipo de Protocolo | O que é | Objetivo Físico | Frequência |
| --- | --- | --- | --- |
| **Basal (Fundo)** | Insulina de Ação Longa ou Ultralonga

 | Manter a glicose estável durante o jejum e o sono.

 | 1 ou 2 vezes ao dia. Exige extrema pontualidade.

 |
| **Bolus (Refeição)** | Insulina de Ação Rápida ou Ultrarrápida

 | Cobrir o pico de glicose que ocorre logo após comer.

 | Antes de cada refeição.

 |

**O Desafio dos Dados:** No caso da insulina Bolus, o usuário pode injetar 10 UI no almoço e 2 UI no jantar, dependendo do que ele vai comer e de como está o açúcar no sangue. Isso quebra totalmente a lógica de "1 comprimido por dia" dos bancos de dados tradicionais.


### 0.4. A Logística Biológica da Insulina

Estamos lidando com um *agente biológico*, o que muda as regras de estoque e consumo:

* **A Métrica (UI):** As doses não são medidas em miligramas, mas prescritas em UI (Unidades Internacionais), uma medida de efeito biológico. O padrão global U-100 significa que 1 ml de líquido contém exatamente 100 UI de insulina.


* **A Validade após Aberto:** Diferente de uma cartela de comprimidos que dura até o vencimento da caixa, a insulina, por ser biológica, vence em 28 a 30 dias após aberta. Isso ocorre mesmo que a caneta ou frasco ainda esteja cheio, pois a proteína perde sua eficácia.



### 0.5. O "Reason Why": Conectando o Contexto à Engenharia

Por que o Dosiq precisa dessas novas *features*? Aqui está a tradução da dor do paciente para os nossos requisitos de sistema:

* **Por que flexibilizar o Banco de Dados para aceitar *inputs* dinâmicos (`applied_amount`)?**
Porque a vida não é estática. Se o paciente for comer uma feijoada, aplicará uma dose; se for comer uma salada, aplicará outra. O Dosiq precisa permitir que ele ajuste o número de UI no exato momento do *check* do lembrete, com zero fricção na interface.
* **Por que criar uma *Timeline* unificada para Glicemia (`biomarkers_log`)?**
Um app para diabetes é inútil se rastrear apenas a insulina injetada e ignorar a Glicemia. O paciente e o médico endocrinologista precisam cruzar a quantidade aplicada com o impacto real no açúcar do sangue para tomarem decisões clínicas. Rastrear apenas o remédio conta apenas metade da história.


* **Por que criar um cronômetro de 30 dias (TTL) na previsão de estoque?**
Para salvar vidas. Um paciente que injeta insulina vencida (após 30 dias de aberta) não terá a redução de glicose esperada, correndo risco de uma cetoacidose diabética (uma complicação grave). Nosso sistema de estoque precisa avisá-lo para jogar a caneta fora por *tempo de uso*, e não apenas quando o volume zerar.

**Resumo para a Squad:** Cada linha de código que escrevemos para otimizar o *fast-logging* de glicemia ou flexibilizar o registro de doses retira uma pequena pedra da montanha de "ruído cognitivo" que o paciente diabético carrega todos os dias. O objetivo do Dosiq aqui não é apenas lembrar; é aliviar a carga de quem gerencia o próprio metabolismo.

---

## 1. Visão Arquitetural e Princípios
A transição exige mudar o Dosiq de um gerenciador de "doses estáticas" para um ecossistema de "eventos metabólicos correlacionados". O sistema precisará registrar a causa (insulina/carboidratos) e o efeito (glicemia), exigindo inputs em tempo real com fricção mínima. Mantendo a filosofia de Zero Cognitive Noise, as telas de fast-logging devem ser extremamente responsivas, garantindo performance fluida tanto no iPhone 13 quanto em dispositivos Android mais antigos.

---

## 2. Modelagem de Dados (Supabase)
O *schema* relacional precisa de adaptações e novas tabelas para suportar a variabilidade biológica.

**A. Alterações em `medications` (ou tabela equivalente):**
* **Validar:** `Biológico` (regulatory_category) - Validar a categoria regulatória define se o item possui ciclo de vida sensível ao tempo após aberto.
* **Adicionar:** `opened_at` (Timestamp/Null) - Data e hora exata em que o paciente iniciou o uso do frasco/caneta, que é diferente da data da compra.
* **Adicionar:** `shelf_life_days` (Int) - TTL do medicamento após aberto (Padrão para insulina: 30 dias) -- refletir se o `expiration_date` poderia ser reaproveitado para isso.

**B. Alterações em `doses_log` (Histórico de Consumo):**
* **Adicionar:** `planned_amount` (Float) - A dose que o alarme previu (ex: 15 UI de Basal).
* **Adicionar:** `applied_amount` (Float) - A dose que o usuário efetivamente injetou no momento (ex: 12 UI porque a glicemia estava caindo).

**C. Nova Tabela: `biomarkers_log` (Glicemia):**
* `id` (UUID, Primary Key)
* `user_id` (UUID, Foreign Key)
* `value` (Int) - Valor medido (em mg/dL).
* `measured_at` (Timestamp) - Momento da medição.
* `context` (String/Enum) - Ex: "Jejum", "Pré-Prandial" (antes de comer), "Pós-Prandial" (após comer).

---

## 3. Lógica de Domínio e Regras de Negócio

**A. Motor de Estoque Híbrido (Volume + Validade Biológica)**
O fim do estoque de uma insulina deve ser disparado pela condição que ocorrer primeiro:
1.  *Esgotamento Físico:* Somatório de `applied_amount` atingir o limite do frasco/caneta (ex: 300 UI).
2.  *Expiração Biológica:* `opened_at` + `shelf_life_days` = Data atual. Quando atingido, o app deve alertar ativamente: "Caneta expirada por tempo de uso. Inicie um novo refil."

**B. Correlação de Eventos (Timeline)**
O motor do backend precisa enviar ao frontend uma *timeline* mesclada, onde os logs de `biomarkers_log` e `doses_log` são apresentados cronologicamente, permitindo ao paciente (e ao médico no PDF) ver a Glicemia -> Dose -> Glicemia subsequente.

---

## 4. Requisitos de UX/UI (Mobile First)

* **Fast-Logging Unificado:** Um FAB (Floating Action Button) de acesso rápido na tela principal que abre um *bottom sheet* simplificado permitindo registrar, na mesma tela, a Glicose (mg/dL) e a Insulina Injetada (UI), com teclados numéricos grandes.
* **Feedback Visual de Estoque Crítico:** Diferenciar o esgotamento por volume (ícone de gota vazia) do esgotamento por validade biológica (ícone de relógio/alerta).
* **Exportação Clínica Otimizada:** O PDF exportado deve agrupar os dados por blocos de horários do dia (Madrugada, Manhã, Tarde, Noite) cruzando as doses aplicadas com os níveis de açúcar no sangue.

---

## 5. Roadmap de Implementação (Fases Recomendadas)

* **Fase 1: Schema e Fast-Logging Básico**
    * Atualizar tabelas no Supabase.
    * Implementar a capacidade de editar a quantidade no momento de confirmar o alarme.
* **Fase 2: Biometria e Timeline**
    * Criar tabela `biomarkers_log`.
    * Implementar input de glicemia no app.
    * Unificar a visualização do histórico (Timeline Híbrida).
* **Fase 3: Motor de Validade Biológica**
    * Implementar a flag `opened_at` na interface.
    * Criar o cron job / lógica de notificação que avisa sobre a perda de eficácia após 30 dias.
* **Fase 4: Exportação Médica Avançada**
    * Atualizar o gerador de PDF para mapear correlações entre insulina e glicemia.

---

## 6. Perspectivas Alternativas e Riscos (Atenção)

* **HealthKit / Google Fit:** Em vez de forçar o usuário a digitar a glicemia manualmente toda vez, considere criar integrações nativas para ler dados diretamente de sensores contínuos de glicose (CGMs como Libre ou Dexcom) via Apple Health/Google Fit. Isso reduz quase a zero o esforço do usuário.
* **Risco Regulatório (Calculadora de Bolus):** Evite, nesta etapa, construir algoritmos que sugiram ativamente a dose exata de insulina baseada na glicemia do paciente. Isso transforma o software em *Medical Device* (regulamentado de forma rigorosa pela Anvisa e FDA). Mantenha o app como uma ferramenta de **registro passivo e relatório**.

---

## 7. Action Plan Imediato
**Próximo passo técnico:** Abra a modelagem de banco de dados do Supabase e adicione a tabela `biomarkers_log` e os campos `is_biologic` e `applied_amount` no schema atual de medicamentos. Isso destrava o trabalho de frontend para as novas interfaces de registro dinâmico.