# rules.md

# Roo Agent Rules

## MAIN LONG-TERM LEARNING LOOP (obrigatório)

## RULES BEGIN

### 1) No início de um conjunto de tarefas
- Leia o arquivo de memória: `@/.roo/rules/memory.md`
- Extraia 3–7 “regras locais”/aprendizados aplicáveis ao trabalho atual (ex.: “nesse repo, X costuma quebrar Y”).

### 2) Ao final de **cada** conjunto de tarefas (obrigatório)
Você deve **apendar** (append) uma nova entrada em:
`@/.roo/rules/memory.md`

**Nunca sobrescreva** o arquivo. Não edite entradas antigas, exceto se explicitamente solicitado.

#### 2.1) Formato padrão da entrada (copiar e usar sempre)
Adicione ao final do arquivo exatamente neste formato:

## Memory Entry — YYYY-MM-DD HH:MM
**Contexto / Objetivo**
- (1–3 bullets do que foi pedido e o resultado esperado)

**O que foi feito (mudanças)**
- Arquivos alterados:
  - `path/to/file.ext` — (resumo)
- Comportamento impactado:
  - (bullet)

**O que deu certo**
- (2–5 bullets: técnicas, abordagens, decisões que funcionaram)

**O que não deu certo / riscos**
- (2–5 bullets: dead ends, falhas, pontos de atenção, dívidas)

**Causa raiz (se foi debug)**
- Sintoma:
- Causa:
- Correção:
- Prevenção:

**Decisões & trade-offs**
- Decisão:
- Alternativas consideradas:
- Por que:

**Regras locais para o futuro (lições acionáveis)**
- (3–7 bullets curtos, no estilo “Se X, então Y”)

**Pendências / próximos passos**
- (bullets objetivos, com prioridade se possível)

### 3) O que NÃO vai para a memória
- Segredos/credenciais.
- Texto longo redundante.
- Discussões irrelevantes para o futuro do projeto.
- Opiniões vagas sem ação (“foi difícil”).

> If anything is uncertain, explicitly state assumptions and propose the safest next step.

## RULES END