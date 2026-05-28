# Epic Draft — Arquitetura de Apresentações Líquidas e Frações de Volume

Este documento serve como especificação técnica preliminar e registro permanente para o desenvolvimento do próximo épico focado no suporte completo a **Apresentações Líquidas (Xaropes, Gotas e Suspensões)** e o abatimento proporcional de volume físico em frações no Dosiq.

---

## 🔍 O Problema e Descoberta Arquitetural

Durante a sprint de evolução das unidades de dosagem, identificamos uma limitação conceitual no modelo atual:
* **Medicamentos Líquidos** possuem sua concentração terapêutica expressa em **razão** (ex: `100 mg / ml`, `50 mg / gota`).
* **Tratamentos** para esses medicamentos são definidos em **volume de consumo físico** (ex: tomar `2,5 ml` ou `15 gotas`).
* **Estoque** desses itens é adquirido em **volumes contínuos embalados** (ex: `1 frasco de 100 ml`).
* **Mecanismo de Baixa Atual:** Funciona com base em contagem de unidades discretas (`-1 unidade`). Se o usuário toma `5 ml` de um xarope de `100 ml`, o estoque deduz o saldo de forma inteira, o que é conceitualmente incorreto. O abatimento real deveria ser de `5%` do frasco (uma baixa contínua de volume).

---

## 🛠️ Mudanças Propostas de Arquitetura (Fase Futura)

### 1. Modelo de Dados (`medicines` e `stock`)

Para suportar esta complexidade, o banco de dados precisará das seguintes colunas e tipos:

* **Tabela `medicines`:**
  * `is_liquid` (boolean): Flag indicando se é uma apresentação líquida.
  * `total_volume_ml` (decimal): O volume total original do frasco (ex: `100` para 100 ml).
  * `concentration_value` (decimal): Carga de princípio ativo (ex: `100` ou `500`).
  * `concentration_unit` (enum): Unidade do princípio ativo por volume (ex: `'mg/ml'`, `'mcg/ml'`).
  * `drops_per_ml` (integer): Fator de conversão de gotas por ml (padrão de mercado: `20` gotas por 1 ml, permitindo personalizações).

* **Tabela `stock_items` (ou `purchases`):**
  * `current_volume_ml` (decimal): Rastreia o volume restante contínuo do lote/frasco (ex: inicia com `100`, baixa para `97.5` após uma dose de `2,5 ml`).

### 2. Conversões e Engine de Negócio

A engine de baixa de estoque e o motor de adesão (DLQ) precisarão calcular dinamicamente a fração de volume:

$$VolumeDeBaixa(ml) = \begin{cases} 
Dose(ml) & \text{se tomada em ml} \\
\frac{Dose(gotas)}{drops\_per\_ml} & \text{se tomada em gotas} 
\end{cases}$$

O abatimento no estoque de lotes dar-se-á deduzindo `VolumeDeBaixa` de `current_volume_ml` do frasco ativo (estratégia First-In-First-Out (FIFO) baseada no vencimento do lote).

---

## 🚦 Desafios e Diretrizes de Implementação

1. **Migração de Dados (Backward Compatibility):**
   * Registros legados precisarão de um script de migração para inferir volume físico ou serem inicializados de forma segura para não quebrar a aplicação em produção.
2. **Políticas de RLS no Supabase:**
   * Garantir que as restrições e triggers do PostgreSQL suportem baixa de estoque fracionada (decimal) sem gerar underflow ou inconsistências de dados.
3. **UX de Baixa de Frasco Inteiro:**
   * Quando o volume do frasco ativo chegar a zero, a UI deve alertar o usuário para "Abrir novo frasco" ou abater automaticamente do próximo lote disponível no inventário.
