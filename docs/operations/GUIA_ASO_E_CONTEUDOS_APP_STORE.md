---
title: "ASO e Conteúdos da App Store"
description: "Guia prático de otimização de busca (ASO), metadados e posicionamento de conteúdo na Apple App Store para o Dosiq."
version: "1.0.0"
status: active
category: operation
audience:
  - ops
  - dev
tags:
  - app-store
  - aso
  - marketing
created_at: "2026-04-22"
updated_at: "2026-04-22"
---

# Guia Pratico - ASO e Conteudos da App Store (Apple)
---

## 1. Diferenças Críticas: Apple vs. Google

Diferente da Play Store, a App Store exige uma abordagem mais concisa nos campos visíveis e possui um campo oculto específico para indexação:

1.  **App Name:** Limite de 30 caracteres (mais rigoroso que os 50 da Google em algumas regiões).
2.  **Subtitle:** Campo visível logo abaixo do nome, também com 30 caracteres. Crucial para conversão e ASO.
3.  **Keywords Field:** Campo oculto de 100 caracteres. Não repita palavras que já estão no Nome ou Subtítulo.
4.  **Promotional Text:** 170 caracteres. É o único campo que pode ser alterado sem enviar uma nova versão do app.

---

## 2. Metadados Recomendados (ASO)

### 2.1. App Name (30 chars)
O ideal é manter a marca limpa ou com um descritor direto.

**Recomendação Principal:**
```text
Dosiq
```
*(Simples, forte e memorável para o lançamento)*

**Alternativa (se quiser focar em busca):**
```text
Dosiq: Controle de Medicamentos
```

### 2.2. Subtitle (30 chars)
O subtítulo deve expandir o valor do app e usar palavras-chave de peso.

**Opção 1 (Foco em Organização):**
```text
Organize seus remedios e doses
```

**Opção 2 (Foco em Estoque/Rotina):**
```text
Doses, tratamentos e estoque
```

**Opção 3 (Chamada de Ação):**
```text
Controle sua rotina de remedios
```

### 2.3. Keywords Field (100 chars)
**Regras de ouro da Apple:**
*   Separe por vírgulas sem espaços (ganha-se caracteres).
*   Não use plural se o singular já estiver lá.
*   Não repita palavras do Nome ou Subtítulo.

**Sugestão de campo preenchido:**
```text
saude,remedio,medicamento,lembrete,alarme,pila,vitamina,historico,diario,cura,adesao,paciente,agenda
```

---

## 3. Descrição e Textos de Marketing

### 3.1. Promotional Text (170 chars)
Aparece acima da descrição e é ótimo para anúncios de novas funcionalidades ou chamadas sazonais.

```text
Dosiq ajuda voce a organizar sua rotina de medicamentos, registrar doses e acompanhar seu estoque diario de forma simples e intuitiva. Comece agora!
```

### 3.2. Descrição Completa
A Apple exibe apenas as primeiras 3 linhas antes do "Ler mais". O primeiro parágrafo deve ser matador.

```text
Dosiq e a forma mais simples e pratica de organizar sua rotina de medicamentos.

Com o app, voce acompanha o que precisa tomar hoje, registra doses rapidamente e controla o estoque dos seus remedios em um unico lugar. Ideal para quem busca consistencia e clareza no seu tratamento diario.

POR QUE USAR O DOSIQ?

- TELA HOJE: Um resumo claro e objetivo do que voce precisa fazer agora.
- REGISTRO RAPIDO: Marque suas doses tomadas com apenas alguns toques.
- CONTROLE DE ESTOQUE: Saiba com antecedencia quando seus medicamentos estao acabando.
- TRATAMENTOS ATIVOS: Visualize todos os seus protocolos e remedios em andamento.

Focado em quem faz uso continuo de medicamentos e deseja reduzir esquecimentos, o Dosiq prioriza a simplicidade e a experiencia do usuario.

AVISO IMPORTANTE:
O Dosiq e uma ferramenta de organizacao e acompanhamento. Ele nao substitui o aconselhamento medico profissional, diagnosticos ou tratamentos. Consulte sempre seu medico antes de tomar decisoes sobre sua saude.
```

---

## 4. Visual e Screenshots (iOS)

Na Apple, o visual tende a ser mais minimalista. As imagens devem focar em legibilidade no iPhone.

### Sequência Recomendada:
1.  **Headline:** `Sua rotina de remedios organizada` | **Tela:** Dashboard/Hoje.
2.  **Headline:** `Registre doses com rapidez` | **Tela:** Fluxo de Confirmação de Dose.
3.  **Headline:** `Controle total do seu estoque` | **Tela:** Lista de Medicamentos/Estoque.
4.  **Headline:** `Acompanhe seus tratamentos` | **Tela:** Lista de Protocolos Ativos.

---

## 5. Categoria e Classificação

*   **Categoria Principal:** Health & Fitness (Saúde e Fitness).
*   **Categoria Secundária:** Medical (Medicina) ou Productivity (Produtividade).
*   **Classificação Etária:** 4+ ou 12+ (dependendo de como a Apple interpretar a menção a medicamentos, mas geralmente 4+ se for apenas organizador).

---

## 6. Checklist de Cadastro (App Store Connect)

- [ ] Nome do App (Dosiq)
- [ ] Subtítulo (máx 30 chars)
- [ ] Keywords (máx 100 chars, sem repetição)
- [ ] URL de Suporte (Dosiq Web / Support page)
- [ ] URL de Política de Privacidade
- [ ] Icone (1024x1024 sRGB, sem transparência)
- [ ] Screenshots para iPhone 6.7" (15 Pro Max) e 6.5"
- [ ] Resposta sobre Criptografia (ITSAppUsesNonExemptEncryption: NO)

---

## 7. Revisão 2026-07-05 — alinhamento à Tese 2026 (wedge GLP-1/injetáveis)

> Contexto: `plans/strategy-2026/DESCONSTRUCAO_E_TESE_2026.md` (local-only). Decisão do PO
> em 2026-07-05: aquisição orientada ao wedge "companheiro de tratamento GLP-1/injetáveis".
> Mesma regra de marcas do guia da Play Store: **nunca** marcas comerciais (Ozempic, Wegovy,
> Mounjaro) em metadados — usar princípios ativos (INN), livres de trademark.

### 7.1. Correções no Keywords Field atual

O campo sugerido na seção 2.3 tem dois problemas:

- `pila` — typo (provavelmente "pilula"); caractere desperdiçado.
- `cura` — termo de risco (promessa médica) e de baixa intenção para este app. Remover.

### 7.2. Keywords Field revisado (100 chars, sem repetir Nome/Subtítulo)

```text
remedio,lembrete,alarme,insulina,caneta,semaglutida,tirzepatida,glicemia,diabetes,adesao,pilula
```

(97 caracteres. Troca `vitamina,historico,diario,cura,agenda,saude,paciente,medicamento` — termos
genéricos saturados ou inúteis — por termos do wedge com concorrência baixa em pt-BR.)

### 7.3. Subtitle — opção wedge para teste

```text
Doses, canetas e tratamentos
```

### 7.4. Promotional Text sazonal (170 chars, editável sem release)

Usar o campo para surfar a onda dos genéricos (patente da semaglutida expira mar/2026):

```text
Novo: suporte a canetas de aplicacao semanal, titulacao de dose e rodizio de local de
injecao. Acompanhe glicemia e peso junto com a adesao ao seu tratamento.
```

### 7.5. Bloco novo na descrição (inserir após "POR QUE USAR O DOSIQ?")

```text
FEITO PARA TRATAMENTOS INJETAVEIS:
- Canetas GLP-1 e insulina, com doses semanais ou diarias
- Titulacao: veja o cronograma de aumento gradual da dose
- Rodizio do local de aplicacao, com historico
- Diario de glicemia, peso e pressao arterial
```

### 7.6. Screenshot adicional (posição 3)

**Headline:** `Feito para canetas e injetaveis` | **Tela:** Titulação/registro de injeção.

### 7.7. Avaliações

Implementar `SKStoreReviewController` (requestReview) após momento de sucesso (streak de
adesão), nunca após alarme/erro. Volume+nota de avaliações é o principal lever de ranking
que a ficha atual ignora.

