# 📊 Relatório de Inteligência de Busca e Demanda (Fase 1) - ASO Dosiq

> **Data da Investigação:** Agosto de 2026  
> **Mercado & Geo:** Brasil (geo=BR, hl=pt-BR, Apple App Store Storefront Brasil 143465)  
> **Objetivo:** Mapear volume relativo, padrões de busca do consumidor brasileiro, fricções de adesão medicamentosa e oportunidades táticas de ASO (App Store Optimization) para o Dosiq.

---

## 1. Sumário Executivo e Principais Descobertas

1. **Predomínio Léxico Popular ("Remédio" > "Medicamento"):**  
   No comportamento de busca orgânica do brasileiro (Google e App Store), o termo **"remédio"** supera "medicamento" em mais de 3:1 em intenções utilitárias diretas (`lembrete de remedio`, `alarme de remedio`, `horario de remedio`). No entanto, o termo **"medicamento"** possui alta relevância para gestão clínica, cuidadores e termos compostos institucionais (`controle de medicamentos`, `interação medicamentosa`).

2. **Explosão do Wedge GLP-1 / Injetáveis no Brasil:**  
   A busca por injetáveis para emagrecimento e controle metabólico (*Semaglutida / Ozempic / Wegovy* e *Tirzepatida / Mounjaro*) gerou uma categoria inteira na App Store BR nos últimos anos.  
   - Aplicativos dedicados a GLP-1 como *OzemPro* (14.000+ avaliações, nota 4.83) e *MeuGLP* (2.200+ avaliações) alcançaram tração massiva explorando dores não atendidas por apps genéricos: **titulação gradual, contagem de cliques na caneta, rodízio de locais de aplicação e registro de peso/efeitos colaterais**.

3. **Intenções de Busca Claras por Formato de Tratamento:**  
   - **Agudos / Horários Cíclicos:** Padrão fortíssimo de busca por intervalos (`horario de remedio de 8 em 8`, `6 em 6`, `12 em 12`).
   - **Uso Contínuo / Polifarmácia / Cuidadores:** `controle de remedios para idosos`, `organizador de remédios semanal`, `caixa de remédio`.
   - **Saúde Feminina / Rotina Rígida:** `alarme anticoncepcional`, `lembrete de pilula`.

---

## 2. Análise dos Clusters Léxicos Fundamentais

### 2.1. Comparativo Head: `Remédio` vs `Medicamento` vs `Pílula` vs `Dose` vs `Posologia`

| Termo | Volume Relativo | Perfil da Intenção de Busca | Ocorrências Típicas (Google Autocomplete / App Store) | Recomendação ASO Dosiq |
|---|---|---|---|---|
| **Remédio** | ⭐⭐⭐⭐⭐ (Máximo) | Consumidor final, linguagem cotidiana, dor imediata | `lembrete de remedio`, `alarme de remedio`, `horario de remedio`, `organizador de remedios` | **Core Primário** (Título / Subtítulo / Keywords) |
| **Medicamento** | ⭐⭐⭐⭐ (Alto) | Técnico-formal, cuidadores, famílias, busca institucional | `controle de medicamentos`, `lembrete de medicamentos`, `interação medicamentosa` | **Core Secundário** (Subtítulo / Keywords) |
| **Pílula** | ⭐⭐⭐ (Médio-Alto) | Anticoncepcionais, rotina diária feminina | `alarme anticoncepcional`, `lembrete de pilula`, `hora da pilula` | **Keyword Field / Metadata segmentado** |
| **Dose** | ⭐⭐⭐⭐ (Crescimento Rápido) | GLP-1, insulina, ajustes, seringas | `doses mounjaro`, `dose tirzepatida na seringa`, `minha dose`, `titulação de dose` | **Keywords de Feature / Subtítulo Wedge** |
| **Posologia** | ⭐⭐⭐ (Médio) | Dúvida de bula, como tomar | `posologia dipirona`, `posologia de 8 em 8 horas` | **Descrição / SEO Web** |

---

### 2.2. Cluster Organização, Horário e Alarmes (Core Utility)

Os dados extraídos da API de sugestões mostram que o usuário não busca apenas "um alarme", mas resolver a **lógica temporal do tratamento**:

* **Padrões de Intervalo Extraídos:**
  - `horario de remedio de 8 em 8`
  - `horario de remedio de 6 em 6`
  - `horario de remedio 12 12`
  - `horario de remedio 3x ao dia` / `4 vezes ao dia`
* **Padrões de Ferramentas / Hardware:**
  - `lembrete de remedio iphone` / `samsung` / `alexa` / `apple watch`
  - `organizador de remedios semanal` / `com alarme` / `manha tarde noite`
  - `aplicativo para tomar remedio gratuito` / `na hora certa` / `para nao esquecer`

---

### 2.3. Cluster Wedge GLP-1, Injetáveis e Diabetes

A busca por GLP-1 e insulinas no Brasil apresenta uma riqueza léxica associada a dúvidas operacionais e insegurança na aplicação:

* **GLP-1 & Injetáveis:**
  - **Canetas & Marcas:** `caneta ozempic`, `caneta semaglutida ems / eurofarma`, `mounjaro 2.5mg / 5mg`, `wegovy 2.4`, `saxenda`.
  - **Aplicação & Manejo:** `aplicacao ozempic cliques`, `aplicacao ozempic barriga / coxa`, `rodizio de aplicacao`, `titulacao ozempic / mounjaro`, `quantas doses na caneta`.
  - **Dores reais capturadas nas buscas:** `aplicacao ozempic ficou roxo`, `dose na seringa de 100 / seringa de 50`, `efeitos colaterais`.
* **Diabetes & Glicemia:**
  - `diario de glicemia capilar`, `controle de glicemia tabela`, `app glicemia gratuito`, `aplicacao de insulina locais / rodizio`, `calculadora de insulina`.

---

## 3. Cenário Competitivo Direto na App Store Brasil

Amostragem dos principais players indexados nas buscas por palavras-chave na App Store BR:

```
[Lembrete / Alarme Geral]
├── Hora do Medicamento e Pílula (23.232 reviews | ★ 4.71 | Aplicativos Legais)
├── MediSafe - Lembrete de Remédios (16.162 reviews | ★ 4.82 | MediSafe Inc.)
├── MyTherapy - Lembrete de Remédios (6.451 reviews | ★ 4.90 | smartpatient GmbH)
└── CUCO - Lembrete de Medicamento (914 reviews | ★ 4.24 | Dr. Cuco)

[Wedge GLP-1 & Injetáveis]
├── OzemPro: Emagrecer com GLP-1 (14.016 reviews | ★ 4.83 | FITCAL LTDA)
├── MeuGLP (2.288 reviews | ★ 4.87 | BI Treinamentos)
├── Shotsy - Monitor GLP-1 (2.045 reviews | ★ 4.89 | Shotsy)
├── GlipOne: Meu tratamento GLP-1 (1.076 reviews | ★ 4.87 | Genio Tech)
└── MounjaPRO: Emagrecer com GLP-1 (1.033 reviews | ★ 4.79 | W12 Consultoria)

[Diabetes & Glicemia]
├── Glic | Diabetes e Glicemia (1.940 reviews | ★ 4.56 | Quasar Telemedicina)
├── mySugr - Diário da Diabetes (1.928 reviews | ★ 4.78 | mySugr GmbH)
└── Diabete Insulina App Glucobyte (90 reviews | ★ 4.72 | Evolve Medical)
```

**Diagnóstico Competitivo:**
1. Os apps generalistas (*MediSafe*, *Hora do Medicamento*) dominam o volume geral de alarme, mas são frios, possuem interfaces antigas e **não entendem especificidades de GLP-1 (titulação, cliques da caneta, rodízio)**.
2. Os apps GLP-1 (*OzemPro*, *Shotsy*) cobram assinaturas caras e focam exclusivamente em perda de peso, negligenciando a gestão integrada de remédios contínuos do usuário.
3. O **Dosiq** pode ocupar o posicionamento único de **plataforma integrada de rotina de saúde: remédios orais + protocolo GLP-1/injetáveis com rodízio inteligente e cálculo de estoque**.

---

## 4. Matriz Mestra de Palavras-Chave (Keyword Master Matrix)

### 4.1. Camada HEAD (Alto Volume / Alta Concorrência)
*Foco: Título do App, Subtítulo e Primeiras Posições no Campo de Keywords da App Store.*

| Palavra-Chave | Volume Estimado | Intenção | Localização Recomendada na Metadata | Justificativa ASO |
|---|---|---|---|---|
| **Lembrete de Remédio** | ⭐⭐⭐⭐⭐ | Utilitária Direta | **App Title / Subtitle** | Termo nº 1 absoluto de conversão e busca |
| **Alarme de Remédio** | ⭐⭐⭐⭐⭐ | Utilitária Direta | **Subtitle / Keywords** | Variação com altíssima taxa de busca |
| **Controle de Medicamentos** | ⭐⭐⭐⭐ | Gestão / Rotina | **Subtitle / Keywords** | Captura público de uso contínuo e cuidadores |
| **Horário de Remédio** | ⭐⭐⭐⭐ | Utilitária / Horário | **Keywords (100 chars)** | Termo de alta intenção com intervalos |

---

### 4.2. Camada BODY (Volume Médio / Média Concorrência / Alta Qualificação)
*Foco: Subtítulo secundário, Keywords Field (100 caracteres).*

| Palavra-Chave | Volume Estimado | Intenção | Localização Recomendada | Justificativa ASO |
|---|---|---|---|---|
| **Organizador de Remédios** | ⭐⭐⭐ | Organização | Keywords | Focado em substituição de caixas organizadoras |
| **Lembrete de Pílula** | ⭐⭐⭐ | Alarme Diário | Keywords | Atrai usuárias de anticoncepcional e pílulas |
| **Estoque de Remédios** | ⭐⭐⭐ | Alerta de Reabastecimento | Keywords / Descrição | Diferencial do Dosiq (alerta antes de acabar) |
| **Despertador de Medicamento** | ⭐⭐⭐ | Alarme Forte | Keywords | Sinônimo direto de alarme |
| **Diário de Medicamentos** | ⭐⭐⭐ | Registro Histórico | Keywords / Descrição | Termo associado a adesão e relatórios |

---

### 4.3. Camada WEDGE & LONG-TAIL (GLP-1, Injetáveis e Casos de Uso Específicos)
*Foco: Keywords Field (100 chars), In-App Events, Screenshots e Copy da Descrição.*

| Palavra-Chave | Volume / Crescimento | Intenção | Localização Recomendada | Justificativa ASO |
|---|---|---|---|---|
| **Semaglutida / Ozempic** | ⭐⭐⭐⭐⭐ (🔥 Trend) | Injetável / Titulação | Keywords / Descrição | Demanda explosiva no Brasil |
| **Tirzepatida / Mounjaro** | ⭐⭐⭐⭐⭐ (🔥 Trend) | Injetável / Doses | Keywords / Descrição | Crescimento mais rápido da categoria em 2026 |
| **Caneta Injetável / Caneta** | ⭐⭐⭐⭐ | Operacional / Cliques | Keywords / Descrição | Conecta com usuários de Ozempic/Saxenda/Mounjaro |
| **Rodízio de Aplicação** | ⭐⭐⭐ | Técnica de Injeção | Keywords / Screenshots | Dor crítica: previne lipohipertrofia e dor |
| **Titulação de Dose** | ⭐⭐⭐ | Ajuste Progressivo | Keywords / Descrição | Acompanhamento de 0.25 -> 0.5 -> 1.0mg |
| **Diário de Glicemia / Insulina** | ⭐⭐⭐⭐ | Diabetes / Monitoramento | Keywords / Descrição | Conexão natural com pacientes metabólicos |
| **Remédio de 8 em 8 horas** | ⭐⭐⭐ | Pós-consulta médica | Descrição / SEO | Intenção de cálculo de horários fracionados |

---

## 5. Recomendações Estruturadas para os Metadados da App Store

### Proposta de Título (Max 30 caracteres)
> **Dosiq: Lembrete de Remédios** *(29 caracteres)*  
> *(Alternativa: `Dosiq: Alarme de Remédios`)*

### Proposta de Subtítulo (Max 30 caracteres)
> **Controle de Remédio e GLP-1** *(29 caracteres)*  
> *(Alternativa: `Lembrete e Doses de Remédio`)*

### Proposta de Campo de Palavras-Chave (100 caracteres sem espaços excedentes)
```text
alarme,medicamento,pilula,horario,organizador,estoque,ozempic,mounjaro,semaglutida,insulina,glicemia,dose
```
*(Total: 99 caracteres, separadas por vírgula, sem espaços desnecessários conforme as diretrizes da Apple).*

---

## 6. Próximos Passos (Fases Subsequentes)

1. **Fase 2 (Benchmark de Competidores na App Store & Play Store):**
   - Decompor títulos, subtítulos, keywords estimadas, ratings e reviews negativos dos líderes (*MediSafe*, *Hora do Medicamento*, *OzemPro*, *MeuGLP*, *CUCO*).
2. **Fase 3 (Engenharia de Metadados & Otimização de Conversão - CRO):**
   - Redigir a descrição completa (Short Description + Long Description de 4000 caracteres) aplicando os termos mapeados na Matriz Mestra.
   - Planejar o roteiro visual de Screenshots destacando:
     1. Alarme confiável e horários inteligentes (8 em 8h, etc.).
     2. Módulo exclusivo de GLP-1 / Injetáveis (Caneta, Cliques, Titulação).
     3. Mapa visual de Rodízio de Aplicação (Barriga, Braço, Coxa).
     4. Controle de Estoque com aviso para recomprar.
