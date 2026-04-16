# Guia Pratico - Google Play Console para o MVP Android

> **Contexto:** Meus Remedios hybrid/native | Fase 5 MVP de produto
> **Data:** 2026-04-14
> **Objetivo:** configurar a Google Play Console do zero para o primeiro envio Android do projeto

---

### 13.5. Status de Validação
- **Ambiente Validado**: Mac M2 (Sequoia) usando Bash. ✅
- **Resultado Estável**: Build de produção gerado localmente em ~5-8 min e aceito pela Google Play Console sem erros de assinatura ou package.

## 1. O que este guia resolve

Este documento foi escrito para um cenário de primeiro app publicado.

Ao final dele, você terá:

1. o app criado corretamente na Play Console
2. a trilha de testes configurada
3. a estrutura de release preparada
4. clareza sobre o que preencher agora e o que pode ficar para depois

---

## 2. Decisão operacional para este projeto

Como o programa da Apple ainda não foi aprovado, a estratégia correta agora é:

- avançar primeiro com Android
- usar Google Play internal/closed testing para validar o MVP
- preparar materiais de loja desde já
- deixar a publicação iOS para a etapa em que o acesso Apple estiver liberado

---

## 3. Identidade oficial do app na Play Console

Para o primeiro app publicado, mantenha uma regra rígida:

- **um app na Play Console por package de produção**

No caso deste projeto, o package de produção já está definido em `apps/mobile/app.config.js`:

```text
com.coelhotv.meusremedios
```

### Não crie o app com estes packages

- `com.coelhotv.meusremedios.dev`
- `com.coelhotv.meusremedios.preview`

Esses ficam para builds internas e ambientes auxiliares.

---

## 4. Antes de abrir a Play Console

Separe estes dados:

- nome do app: `Meus Remedios`
- e-mail de suporte que ficará público
- link da política de privacidade
- país inicial de distribuição
- se o app será gratuito ou pago
- arquivo `.aab` de produção

### Pré-requisito novo para este projeto

O repositório agora possui um rascunho inicial da política em:

- [POLITICA_DE_PRIVACIDADE.md](/Users/coelhotv/Library/Mobile%20Documents/com~apple~CloudDocs/git/meus-remedios/docs/legal/POLITICA_DE_PRIVACIDADE.md)

URL pública planejada para a ficha da loja:

- [https://meus-remedios.vercel.app/politica-de-privacidade](https://meus-remedios.vercel.app/politica-de-privacidade)

Contato público definido para suporte e privacidade:

- `contact@coelho.me`

### Decisão recomendada para o MVP

Para o primeiro lançamento:

- tipo: `App`
- monetização inicial: `Free`
- idioma principal: `Portuguese (Brazil)` se disponível na ficha, senão inglês como idioma-base técnico e conteúdo em pt-BR

---

## 5. Passo a passo - criar o app

### Passo 1 - entrar na Play Console

Acesse a conta proprietária aprovada do Google Play Console.

### Passo 2 - criar o app

Na home da Play Console:

1. clique em `Create app`
2. informe o nome do app
3. marque que é `App`, não `Game`
4. defina `Free`
5. preencha o e-mail de contato
6. aceite as declarações exigidas
7. conclua a criação

### Nome recomendado

Use:

```text
Meus Remedios
```

Evite adicionar:

- palavras soltas só para SEO
- nomes muito longos
- subtítulos no título

Exemplos a evitar:

- `Meus Remedios Controle de Medicamentos e Lembretes`
- `Meus Remedios Brasil Oficial`

---

## 6. Passo a passo - configurar App Integrity e assinatura

### Objetivo

Evitar o erro mais caro de um primeiro release: confusão com chave de assinatura.

### Caminho recomendado

Para o MVP, use assinatura gerenciada pelo Google/Play App Signing.

### O que fazer

1. abra a seção de integridade do app
2. aceite o fluxo de assinatura gerenciada
3. siga com a chave gerada/gerenciada pelo Google quando essa opção for oferecida

### Por que isso é melhor para o primeiro app

- reduz risco operacional
- simplifica submissões futuras
- combina bem com o fluxo usando EAS Build/EAS Submit

---

## 7. Passo a passo - preparar a trilha de testes correta

## 7.1. Ordem recomendada

Para este projeto, use esta ordem:

1. `Internal testing`
2. `Closed testing`
3. `Production`

## 7.2. Internal testing

Use primeiro para validar upload, instalação e fluxo principal.

### O que fazer

1. abrir `Test and release`
2. entrar em `Internal testing`
3. criar lista de testers
4. adicionar seus próprios e-mails e pessoas de confiança
5. criar a primeira release interna

### Status Atual (v0.1.0) ✅
- **Convite (Email List):** [Link de Opt-in](https://play.google.com/apps/internaltest/4701693465152183629)
- **Download App:** [Play Store Internal](https://play.google.com/store/apps/details?id=com.coelhotv.meusremedios)

## 7.3. Closed testing

Use quando o app já estiver estável o bastante para mais pessoas.

### Importante para conta pessoal nova

Se sua conta Play for pessoal criada recentemente, confirme antes se ela cai na exigência atual do Google para produção: closed test com grupo mínimo e período contínuo de teste. Isso pode afetar diretamente o cronograma do primeiro lançamento.

### O que fazer

1. criar uma trilha `Closed testing`
2. montar um grupo real de testers
3. documentar quem entrou e quando entrou
4. manter o teste ativo pelo período exigido

### Recomendações para este projeto

Monte um grupo com:

- você
- familiares
- amigos próximos
- 2 ou 3 pessoas com rotina real de medicamentos, se possível

O objetivo não é só “cumprir tabela”. É coletar:

- clareza do fluxo Hoje
- facilidade para registrar dose
- entendimento de tratamentos
- percepção de estoque

---

## 8. Passo a passo - gerar e subir o primeiro `.aab`

### Passo 1 - gerar build de produção no Expo

No diretório `apps/mobile`:

```bash
npx eas-cli@latest build --platform android --profile production
```

### Passo 2 - baixar o artefato

Ao final da build, baixe o `.aab`.

### Passo 3 - criar a release interna

Na Play Console:

1. abra `Internal testing`
2. clique em criar nova release
3. envie o `.aab`
4. aguarde o processamento
5. revise avisos e erros
6. salve
7. publique para a trilha interna

### Resultado esperado

Você terá um link de opt-in/teste para instalar o app pela Play Store.

---

## 9. Passo a passo - preencher as áreas obrigatórias da ficha

Nem tudo precisa ser perfeito agora, mas algumas áreas bloqueiam publicação.

## 9.1. Main store listing

Preencha:

- app name
- short description
- full description
- ícone
- screenshots
- feature graphic

Os textos-base estão no guia:

- `plans/backlog-native_app/GUIA_ASO_E_CONTEUDOS_PLAY_STORE.md`

## 9.2. App content

Você vai precisar revisar com atenção:

- política de privacidade
- data safety
- app access
- audience/target
- ads declaration

### Interpretação segura para o MVP

Como o app lida com autenticação, tratamentos e rotinas de saúde, trate a seção de conteúdo como crítica, não burocrática.

## 9.3. Categorization

Sugestão inicial:

- categoria: `Health & Fitness` ou `Medical`

### Recomendação prática

Se o posicionamento principal for autocuidado, rotina, adesão e organização pessoal:

- prefira `Health & Fitness`

Se o posicionamento for mais clínico/institucional:

- avalie `Medical`

Para o MVP do Meus Remedios, eu recomendo começar por `Health & Fitness`, porque tende a comunicar melhor uso cotidiano e reduzir expectativa de ferramenta clínica profissional.

---

## 10. Como preencher Data safety sem se enrolar

Todo app publicado no Google Play precisa tratar com seriedade a seção de Data safety. Em testes internos o impacto é menor, mas para trilhas mais amplas e produção esse preenchimento passa a ser parte real do caminho de publicação.

### Como pensar no caso do Meus Remedios

O app provavelmente envolve pelo menos:

- dados pessoais de conta
- dados de saúde/medicação informados pelo usuário
- dados de uso do app

### Processo recomendado

1. mapear o que o app coleta de fato
2. mapear o que o Supabase armazena
3. mapear o que bibliotecas terceiras podem transmitir
4. alinhar isso com a política de privacidade
5. só então preencher o formulário

### Regra de ouro

Nunca responda “não coleta” por intuição.

Revise:

- autenticação
- logs
- analytics, se existirem
- crash reporting, se existir
- integrações terceiras

---

## 11. App access, login e revisão do Google

Como o app exige login, prepare desde cedo o material para revisão:

- credencial de teste
- instrução curta de acesso
- explicação do que o revisor deve fazer para validar o app

Guia dedicado para isso:

- [GUIA_APP_ACCESS_PLAY_CONSOLE.md](/Users/coelhotv/Library/Mobile%20Documents/com~apple~CloudDocs/git/meus-remedios/plans/backlog-native_app/GUIA_APP_ACCESS_PLAY_CONSOLE.md)

### Sugestão prática

Crie uma conta de teste exclusiva para review, com:

- e-mail controlado por você
- senha estável
- dados de exemplo suficientes para navegar pelas telas principais

---

## 12. Assets mínimos para não travar a ficha

Prepare ao menos:

- ícone final do app
- capturas de tela Android
- feature graphic

### Checklist mínimo de screenshots

1. login
2. tela Hoje
3. registrar dose
4. tratamentos
5. estoque
6. perfil/configurações

Se possível, use device frames consistentes e texto em pt-BR.

---

## 13. Sequência recomendada de publicação para este MVP

### Fase A - preparação

1. criar app
2. configurar assinatura
3. preparar store listing
4. preencher política e conteúdo

### Fase B - teste interno

1. subir `.aab`
2. validar instalação
3. corrigir bugs críticos

### Fase C - closed testing

1. abrir grupo maior
2. coletar feedback real
3. acompanhar estabilidade por 14 dias se sua conta exigir isso

### Fase D - produção

1. revisar ficha final
2. revisar data safety
3. revisar credenciais de app access
4. enviar para produção

---

## 14. Erros comuns do primeiro app

## 14.1. Criar o app com package errado

Certo:

```text
com.coelhotv.meusremedios
```

Errado:

- usar `.dev`
- usar `.preview`
- trocar package no meio do caminho

## 14.2. Querer subir produção antes de testar o básico

Antes de pensar em produção, valide:

- login
- hoje
- dose
- tratamentos
- estoque
- perfil

## 14.3. Tratar a ficha da loja como detalhe de última hora

Errado.

A store listing influencia:

- aprovação
- clareza para usuários
- conversão

## 14.4. Não se preparar para o review de app com login

Se o revisor não conseguir entrar, o processo trava.

---

## 15. Definição de pronto

Considere a Play Console realmente pronta quando estes itens estiverem verdes:

1. app criado com `com.coelhotv.meusremedios`
2. assinatura configurada
3. internal testing funcionando
4. ficha principal preenchida
5. data safety revisada
6. política de privacidade publicada em `https://meus-remedios.vercel.app/politica-de-privacidade`
7. credenciais de review preparadas
8. estratégia de closed testing definida

---

## 16. Próximo passo

Com a console pronta, finalize os textos e assets usando:

- `plans/backlog-native_app/GUIA_ASO_E_CONTEUDOS_PLAY_STORE.md`
