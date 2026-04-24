# Guia Pratico - ASO e Conteudos da App Store (Apple)

> **Contexto:** Dosiq hybrid/native | App Store Connect
> **Data:** 2026-04-22
> **Objetivo:** Estabelecer textos, metadados e posicionamento de App Store Optimization (ASO) para o lançamento na Apple App Store.

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
*Gerado em: 22 de Abril de 2026 para o projeto Dosiq.*
