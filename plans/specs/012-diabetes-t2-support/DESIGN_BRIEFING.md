# Design Briefing — Expansão dosiq para Diabetes Tipo 2

> **Para:** time de design (agentes IA) que vai desenhar mocks de exemplo.
> **De:** Planning da spec 012 (épico diabetes T2).
> **Objetivo:** explorar **como poderia ser** a UX de três áreas novas. São mocks de
> exploração — não são specs finais de implementação. Liberdade criativa dentro das travas abaixo.
> **Plataforma-alvo do mock:** mobile-first (React Native / Expo). Web é espelho, desenhe depois.

---

## 1. Contexto em uma frase

O dosiq deixa de ser só "lembrete de remédio" e passa a registrar **causa** (a dose: insulina,
GLP-1) e **efeito** (o biomarcador: glicemia, peso, pressão), lado a lado no tempo — para o
paciente e o médico enxergarem a relação. Tudo com fricção mínima.

**Persona v1 = diabético Tipo 2**, foco em público **idoso**. Pode ter visão cansada, pouca
intimidade com app, mão menos firme. Desenhe para ele primeiro.

---

## 2. Travas não-negociáveis (leia antes de desenhar)

Estas regras **mudam o que pode aparecer na tela**. Violar = mock rejeitado.

| Trava | O que significa no design |
|-------|---------------------------|
| **Linha SaMD (regulatório)** | O app **NUNCA** sugere, calcula ou recomenda dose. **NUNCA** mostra "meta", "alvo", faixa ideal, verde/vermelho de "bom/ruim", nem alerta tipo "glicemia alta". Glicemia é **só um número registrado**. Sem semáforo clínico. Sem julgamento. |
| **Zero Cognitive Noise** | Densidade baixa. Um diabético T2 idoso registra poucos eventos/dia. Não encha a tela. Hierarquia clara, um foco por tela. |
| **Mobile-first / idoso** | Toques grandes, texto legível, teclado numérico nativo, poucos passos. Nada de gesto escondido como única via. |
| **Transparência radical** | Se um registro falha, diga **o que falhou e por quê**, em português claro. Nunca uma tela que finge sucesso. Mock deve prever o estado de erro. |
| **Terminologia** | Usar **"tratamento"**, nunca "protocolo". Evitar pronomes possessivos ("seu/sua") no texto de UI. |
| **Wordmark** | "dosiq" sempre minúsculo. |
| **Sem meta-tracking de saúde** | Não desenhe gráfico de tendência com "linha de meta". Tendência descritiva (só os pontos no tempo) é OK; linha-alvo não. |

> Regra de bolso: se o mock **insinua** que um número é bom ou ruim, ou sugere o que fazer com a
> dose, passou da linha. O dosiq **mostra e registra**, o médico interpreta.

---

## 3. Vocabulário do domínio (para os mocks)

- **Biomarcador**: medida do corpo. v1 foca **glicemia** (mg/dL). Modelo já nasce genérico para
  **peso** (kg), **pressão arterial** (mmHg), **batimentos** (bpm) — desenhe pensando que outros
  tipos vão entrar depois, sem redesenho.
- **Contexto da glicemia** (manual, escolhido pelo paciente): ex. **jejum**, **pré-refeição**,
  **pós-refeição**, **ao deitar**. É um rótulo, não um cálculo.
- **Dose**: o evento de medicação (insulina diária em UI, GLP-1 semanal em mg, pílulas orais).
- **Timeline**: a linha do tempo única onde doses e biomarcadores aparecem juntos, ordenados por
  horário real.

---

## 4. As três UX a desenhar

### UX-A — Fast-logging de biomarcador (a tela mais importante)

**Job-to-be-done:** "acabei de medir minha glicemia, quero registrar em 3 segundos."

Cenário típico: paciente fura o dedo, olha o glicosímetro, pega o celular. O registro precisa ser
quase tão rápido quanto ler o aparelho.

Desenhar:
- **Entrada do valor** com teclado numérico nativo (`decimal-pad`). Foco automático no campo.
  ⚠️ Teclado PT-BR emite **vírgula** — o campo deve aceitar `5,5` naturalmente (peso/decimais).
- **Tipo de biomarcador**: v1 default = glicemia. Mostrar como trocar para peso/pressão de forma
  óbvia mas sem poluir (glicemia é o caso 90%).
- **Contexto** (jejum / pré / pós / ao deitar): seleção rápida, 1 toque, opcional. Não obrigar.
- **Quando**: default = agora. Permitir ajustar horário (medi há 1h e esqueci de registrar).
- **Unidade**: exibida, fixa por tipo (glicemia → mg/dL). Não pedir ao usuário digitar unidade.
- **Confirmação**: feedback claro de "registrado", e o **estado de erro** (sem conexão, valor
  inválido) — mensagem específica, não genérica.

Explorar formatos: **bottom-sheet** (sobe de baixo, padrão já usado no app) vs tela cheia. Dar 1-2
variações. Lembre: **sem** "sua glicemia está alta/normal". Só registra o número.

---

### UX-B — Timeline híbrida (doses + biomarcadores juntos)

**Job-to-be-done:** "quero ver, no meu dia, o que tomei e o que medi, na ordem que aconteceu."

Esta é a tela que dá sentido ao épico: dose e efeito no mesmo eixo temporal.

Desenhar:
- **Lista única ordenada por horário real** do dia (e navegação por dias).
- **Dois tipos de card visualmente distintos mas irmãos**:
  - card de **dose** (já existe no app — insulina/GLP-1/pílula, com a unidade de tomada correta:
    "10 UI", "0,5 mg", "1 comprimido");
  - card de **biomarcador** (novo — ex. "Glicemia 110 mg/dL · jejum · 07:12").
- A correlação é **só visual/temporal** — não desenhe uma linha ligando "dose X causou glicemia Y".
  Sem elo causal explícito. O olho do paciente/médico faz a leitura.
- **Sem julgamento de cor clínica** no biomarcador. Cor pode diferenciar *tipo de evento*
  (dose vs medida), nunca *qualidade do valor*.
- Estado vazio do dia (nada registrado) e estado denso (vários eventos) — desenhe ambos.

Explorar: como o card de biomarcador convive com o card de dose sem virar ruído. Ícone de relógio
vs ícone de gota/medida. Agrupamento por período do dia (manhã/tarde/noite) é uma possibilidade.

---

### UX-C — Navegação e área de biomarcadores

**Job-to-be-done:** "quero entrar numa área e ver meu histórico de medidas ao longo do tempo."

Desenhar:
- **Como se chega lá**: ponto de entrada na navegação principal. O fast-logging (UX-A) precisa
  estar a 1 toque de qualquer lugar relevante (ex. botão flutuante / ação rápida).
- **Tela da área de biomarcadores**:
  - histórico de medidas (lista cronológica, filtrável por tipo: glicemia / peso / pressão);
  - **visão de tendência descritiva** — pontos no tempo (ex. glicemia dos últimos 7/30 dias).
    ⚠️ **Sem linha de meta/alvo. Sem zona verde/vermelha.** Só os pontos e o eixo de tempo.
    Pode mostrar média do período (número descritivo), não "ideal".
  - distinção por **contexto** (jejum vs pós-refeição) como filtro/agrupamento, se ajudar a leitura.
- **Multi-biomarcador**: a área deve comportar mais de um tipo (glicemia hoje; peso/pressão depois)
  sem redesenho. Pense na arquitetura da navegação para crescer.
- Ponte com a **timeline** (UX-B): da área de biomarcadores dá pra pular pro dia na timeline?

---

## 5. Entregáveis esperados do time de design

1. Mocks (telas estáticas ou protótipo) das três UX: **A (fast-logging)**, **B (timeline híbrida)**,
   **C (área/navegação)**.
2. Para UX-A e UX-B, **1-2 variações** de layout para comparar.
3. Estados além do "feliz": **vazio** e **erro/falha de registro** (transparência radical).
4. Anotação curta de cada tela dizendo qual trava da Seção 2 ela respeita (especialmente SaMD).

---

## 6. Fora de escopo (não desenhar)

- Qualquer cálculo/sugestão de dose ou bolus (diabetes Tipo 1, carboidrato, CGM dinâmico).
- Metas glicêmicas, faixas-alvo, alertas clínicos de "alto/baixo".
- Import automático de glicosímetro/wearable (HealthKit/Google Fit) — é futuro; só deixe a
  arquitetura visual aberta a "origem do dado" sem desenhá-la agora.
- Telas de cadastro de medicamento injetável e validade biológica (são outra fase — Fase A —
  e não são o foco deste briefing de exploração de UX).

---

*Fonte: `plans/specs/012-diabetes-t2-support/spec.md` (User Stories 3 e a timeline da Fase C).
Dúvida de escopo ou de trava → perguntar antes de assumir; trava SaMD não admite "interpretação
criativa".*
