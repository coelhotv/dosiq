# 🎨 Galeria de Benchmark Visual de UI & Catálogo de Inspirações de UX (Dosiq)

> **Data de Emissão:** 20 de Agosto de 2026  
> **Objetivo:** Catalogar padrões visuais de vanguarda dos concorrentes líderes (App Store Brasil), mapear os gaps de UX do Dosiq atual e definir especificações de componentes interativos de alta conversão.  
> **Diretório de Assets Locais:** `.agent/drafts/aso_benchmark_analysis_2026/ui_references/` e `.agent/drafts/aso_benchmark_analysis_2026/screenshots/`  
> **Local do Arquivo:** `.agent/drafts/aso_benchmark_analysis_2026/GALERIA_BENCHMARK_UI_E_REFERENCIAS_VISUAIS.md`

---

## 🎯 1. Visão Geral & Por Que Criar uma Galeria de Referências Visuais

A interface do Dosiq possui uma solidez arquitetural ímpar (React 19, TypeScript, offline-first). No entanto, aplicativos de saúde líderes no Brasil (*Monju, Canetto, SoPro, Shotsy, GlipOne, MyTherapy*) alcançam engajamento emocional superior porque transformam **dados clínicos abstratos em representações visuais táteis**.

Criamos um repositório organizado de referências visuais em `.agent/drafts/aso_benchmark_analysis_2026/ui_references/` dividido em **6 pilares de UX**:

```
.agent/drafts/aso_benchmark_analysis_2026/ui_references/
├── 01_body_map_injection_rotation/      (Silhuetas corporais e mapas de injeção)
├── 02_glp1_pharmacokinetics_halflife/   (Curvas de nível sérico e meia-vida farmacocinética)
├── 03_dose_titration_timeline/          (Linhas do tempo de titulação e escala de doses)
├── 04_symptoms_and_side_effects/        (Diários visuais de sintomas e correlação com peso)
├── 05_medical_pdf_reports/              (Preview e diagramação de relatórios clínicos)
└── 06_ios_widgets_dynamic_island/       (Widgets interativos de tela bloqueada e Live Activities)
```

---

## 🔬 2. Teardown Detalhado dos 6 Padrões Visuais de Vanguarda

---

### 📍 Pilar 1: Mapa Anatômico de Injeção Visual (*Body Silhouette Map*)

```
+-----------------------------------------------------------------------------------+
| PADRÃO OBSERVADO NOS LÍDERES (Monju / Canetto / Shotsy / SoPro)                   |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|                   [ SILHUETA ANATÔMICA 2D MINIMALISTA ]                           |
|                                                                                   |
|                            ( O )  Cabeça                                          |
|                           /  |  \                                                 |
|          Braço Esq. ( )  / [ 1 ][ 2 ] \  Braço Dir. ( )                           |
|                         |  [ 3 ][ 4 ]  |  <-- 4 Quadrantes Abdominais             |
|                          \  ---  ---  /                                           |
|                            |   |   |                                              |
|            Coxa Esq. ( 🟢 ) |   |   | ( ⚪ ) Coxa Dir.                              |
|                            |   |   |                                              |
|                                                                                   |
|  LEGENDA INTERATIVA DE CORES:                                                     |
|  🟢 Verde Pulsante : Próximo local recomendado (maior tempo de descanso)          |
|  🟡 Amarelo Claro  : Local da última aplicação (aplicado há 7 dias)               |
|  ⚪ Cinza / Neutro : Locais liberados / em descanso há >14 dias                   |
+-----------------------------------------------------------------------------------+
```

#### 🔍 Como os concorrentes fazem:
* **Canetto & Monju:** Exibem a silhueta frontal do corpo com 8 regiões mapeadas (Abdômen Superior D/E, Abdômen Inferior D/E, Coxa D/E, Braço D/E). Ao tocar no botão de registrar dose semanal, o app destaca com um ponto verde brilhante o local ideal da vez, evitando a formação de nódulos de lipodistrofia.

#### ⚖️ Como o Dosiq faz hoje (Spec 031 / ADR-072 / CON-026):
* **Fundação de Dados Impecável:** O Dosiq já possui a coluna `medicine_logs.injection_site` (TEXT nullable com CHECK de 8 valores em português: `abdomen_sup_d`, `abdomen_inf_d`, `abdomen_sup_e`, `abdomen_inf_e`, `coxa_d`, `coxa_e`, `braco_d`, `braco_e`), gerenciada de forma atômica pelas RPCs `register_dose_atomic` e `update_dose_log_atomic` (ADR-072 / CON-026).
* **Função Core Pronta:** A factory do core já expõe `getLastInjectionSite()` para resgatar o último sítio registrado.
* **O Gap é Estritamente de UX:** A interface atual exibe apenas um **dropdown/select textual** (`DoseRegisterModal.tsx` e `BulkDoseRegisterModal.tsx`).
* **Vantagem de Engenharia:** A evolução para o **BodyMapSelector SVG Neutro** é uma **mudança 100% no Frontend/UI**, com **zero migração de banco de dados, zero alteração de schema e zero risco de backend**.

#### 💡 Especificação Recomendada para o Dosiq:
* **Novo Componente:** `<BodyMapSelector value={site} onChange={setSite} lastUsedSite={lastSite} />`
* **Implementação:** Componente SVG vetorial ultra-leve (<12 KB), responsivo, com suporte a acessibilidade (VoiceOver lê o nome da região) e feedback háptico (`Haptics.impactAsync()`) ao selecionar o quadrante.

---

### 📉 Pilar 2: Curva Farmacocinética de Nível Sérico (*Blood Level Curve*)

```
+-----------------------------------------------------------------------------------+
| PADRÃO OBSERVADO NOS LÍDERES (Canetto Slide 4 / GlipOne / Monju Slide 3)          |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ Nível no Organismo ]                                [ Simular Próxima Dose ⊘ ] |
|                                                                                   |
|  mg/corpo                                          Agora                          |
|   15 |                     /\                     :                               |
|   10 |       /\           /  \           /\       :                               |
|    5 |  /\  /  \    /\   /    \    /\   /  \      : \                             |
|    0 |_/  \/    \__/  \_/      \__/  \_/    \_____:__\________                    |
|       Semana 1    Semana 2    Semana 3    Semana 4 (Projeção)                     |
|                                                                                   |
|  "57% de medicação ativa no corpo hoje (1,34 mg de Tirzepatida)"                  |
|  *Baseado na meia-vida biológica de 120h (Bula Oficial FDA/Anvisa).               |
+-----------------------------------------------------------------------------------+
```

#### 🔍 Como os concorrentes fazem:
* **Canetto (Slide 4) e GlipOne:** Apresentam um gráfico de área preenchida com gradiente verde/menta que ilustra visualmente a farmacocinética da substância: o pico de absorção nas primeiras 24–48 horas após a injeção e a curva exponencial de decaimento até o 7º dia.
* Inclui um toggle *"Simular próxima dose"* que projeta como ficará o nível caso a dose suba de 2.5mg para 5.0mg.

#### ⚖️ Como o Dosiq faz hoje:
* O Dosiq registra doses pontuais e timelines de titulação (Spec 029), mas não possui a renderização contínua da curva de decaimento sérico.

#### 💡 Especificação Recomendada para o Dosiq:
* Criar a biblioteca de cálculo farmacocinético no `@dosiq/core`:
  * Semaglutida: $t_{1/2} \approx 168\text{ horas}$ (7 dias).
  * Tirzepatida: $t_{1/2} \approx 120\text{ horas}$ (5 dias).
* Exibir o gráfico no card de tratamento do GLP-1, gerando enorme retenção (o paciente abre o app no 5º dia só para ver quanto remédio ainda tem agindo no corpo).

---

### 🩺 Pilar 3: Diário Visual de Efeitos Colaterais & Tendência de Peso

```
+-----------------------------------------------------------------------------------+
| PADRÃO OBSERVADO (SoPro Slide 3 / Canetto Slide 2)                                 |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ Calendário & Sintomas ]                            [ Correlação Peso x Dose ]  |
|                                                                                   |
|  • Náusea       [ 🟡 Moderada  (3/5) ]                Variação: -0,95 kg/semana   |
|  • Saciedade    [ 🟢 Intensa   (5/5) ]                Correlação Dose x Perda:    |
|  • Disposição   [ 🟢 Boa       (4/5) ]                [ Forte Negativa: -0.95 ]   |
|  • Constipação  [ ⚪ Nenhuma   (0/5) ]                                            |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

#### 🔍 Como os concorrentes fazem:
* **SoPro:** Usa chips interativos com escalas de 1 a 5 para registrar em 3 segundos se houve náusea ou fadiga.
* **Canetto:** Cruza os dias de sintomas com os picos da curva de meia-vida, ajudando o paciente a entender: *"Minha náusea só acontece nas primeiras 24h após a injeção de 5mg"*.

#### 💡 Especificação Recomendada para o Dosiq:
* Expandir a tabela de medidas existente para suportar um *Symptom Logger* leve, que se integra nativamente ao Relatório Médico em PDF (Spec 007).

---

### 📄 Pilar 4: Diagramação de Relatórios Médicos em PDF (*Clinical Export Preview*)

```
+-----------------------------------------------------------------------------------+
| PADRÃO OBSERVADO (MyTherapy / Canetto Slide 2)                                    |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |  DOSIQ - RELATÓRIO DE ACOMPANHAMENTO CLÍNICO                  Dr. / Paciente|  |
|  |  Período: 01/Jul/2026 - 31/Jul/2026  ·  Adesão Global: 94% (Excelente)     |  |
|  +-----------------------------------------------------------------------------+  |
|  | [1] TRATAMENTOS ATIVOS & TITULAÇÃO:                                         |  |
|  |     • Mounjaro: 2.5mg (Sem 1-4) -> 5.0mg (Sem 5-8) [Sítios: Abdômen/Coxa]   |  |
|  |     • Metoprolol 25mg: 1 cp 12/12h (Adesão: 98%)                            |  |
|  | [2] BIOMARCADORES & TENDÊNCIAS:                                             |  |
|  |     • Glicemia Média Jejum: 98 mg/dL  ·  Pós-Prandial: 132 mg/dL            |  |
|  |     • Pressão Arterial Média: 124/82 mmHg                                   |  |
|  |     • Curva de Peso: 84.2 kg -> 81.0 kg (-3.2 kg no período)                |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

#### 🔍 Como os concorrentes fazem:
* **MyTherapy:** Gera um documento formal de 2 páginas que os pacientes imprimem ou enviam por WhatsApp para o médico antes da consulta. É o recurso que mais gera reviews 5 estrelas no app.

#### 💡 Especificação Recomendada para o Dosiq:
* O Dosiq já planejou a **Spec 007 (`medical-pdf-report`)**. Incorporar a tabela de titulação (Spec 029) e o mapa de sítios (Spec 031) torna o PDF do Dosiq o mais completo da América Latina.

---

### 📱 Pilar 5: Widgets Interativos iOS & Live Activities

```
+-----------------------------------------------------------------------------------+
| PADRÃO OBSERVADO (Apple Lembretes / Medisafe / Dosiq Specs 039/041)               |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +------------------------------+       +--------------------------------------+  |
|  | WIDGET MÉDIO (Home Screen)   |       | DYNAMIC ISLAND / LIVE ACTIVITY       |  |
|  |                              |       |                                      |  |
|  | Dosiq · Hoje                 |       | (💉) Lantus 100 UI · 15:00           |  |
|  | 08:00  Metoprolol 25mg   [✓] |       | Falta 12 min    [ Tomar Agora ]      |  |
|  | 15:00  Lantus 10 UI      [✓] |       |                                      |  |
|  | 22:00  Mounjaro 5mg (Qui)[ ] |       +--------------------------------------+  |
|  +------------------------------+                                                 |
+-----------------------------------------------------------------------------------+
```

---

## 🏗️ 3. Plano de Implementação de UX no Roadmap do Dosiq

Para transformar esses insights visuais em código de produção sem inflar a complexidade:

1. **Sprint Visual GLP-1 (Conectada à Spec 031):**
   * Criar o componente vetorial `BodyMapSelector.tsx` substituindo o dropdown de texto da modal de doses por uma silhueta anatômica com toque direto.
2. **Sprint Farmacocinética (Dashboard Feature):**
   * Implementar o componente `PharmacokineticsCard.tsx` no Dashboard para medicamentos classificados como GLP-1/GIP ou Insulinas basais.
3. **Sprint PDF Clínico (Spec 007):**
   * Fechar o layout do PDF com o grid médico consolidando adesão, glicemia, PA e histórico de titulação.

---

## 📁 4. Galeria de Imagens Baixadas e Arquivadas

Todas as telas de referência dos concorrentes líderes já estão armazenadas localmente para consulta dos desenvolvedores e designers do Dosiq:

* 📂 **Silhuetas e Rotina:** `.agent/drafts/aso_benchmark_analysis_2026/ui_references/01_body_map_injection_rotation/`
* 📂 **Curvas e Farmacocinética:** `.agent/drafts/aso_benchmark_analysis_2026/ui_references/02_glp1_pharmacokinetics_halflife/`
* 📂 **Sintomas e Calendários:** `.agent/drafts/aso_benchmark_analysis_2026/ui_references/04_symptoms_and_side_effects/`
* 📂 **Relatórios e Médicos:** `.agent/drafts/aso_benchmark_analysis_2026/ui_references/05_medical_pdf_reports/`
* 📂 **Screenshots Completos dos Top Apps:** `.agent/drafts/aso_benchmark_analysis_2026/screenshots/`
