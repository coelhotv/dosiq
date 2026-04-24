# Guia Pratico - Apple Developer e App Store Connect para iOS

> **Contexto:** Dosik hybrid/native | iOS first setup
> **Data:** 2026-04-20
> **Objetivo:** configurar a aplicação iOS no ecossistema Apple do zero, do App ID ao TestFlight

---

## 1. O que este guia resolve

Este documento foi escrito para o primeiro ciclo real de setup iOS do Dosik.

Ao final dele, você terá:

1. App ID criado corretamente no Apple Developer
2. capabilities selecionadas com critério
3. app criado no App Store Connect
4. base pronta para upload de build
5. TestFlight configurado para testes internos e externos
6. checklist de privacidade e metadados exigidos pela Apple

---

## 2. Decisão operacional para este projeto

O Dosik é um app de rotina de medicamentos, com autenticação, dados de saúde informados pelo usuário e backend próprio.

Hoje, a leitura correta para o setup Apple é:

- começar com o mínimo de capabilities possível
- habilitar apenas o que o app já usa ou vai usar no curtíssimo prazo
- evitar capabilities “por prevenção”
- deixar o App ID limpo e previsível

---

## 3. Identidade oficial do app iOS

Os identificadores atuais do projeto estão em `apps/mobile/app.config.js`.

### Bundle identifiers por ambiente

| Perfil | Nome | Bundle Identifier |
|---|---|---|
| `development` | `Dosik Dev` | `com.coelhotv.dosik.dev` |
| `preview` | `Dosik Preview` | `com.coelhotv.dosik.preview` |
| `production` | `Dosik` | `com.coelhotv.dosik` |

### Regra prática

No App Store Connect, o app público deve ser criado com:

```text
com.coelhotv.dosik
```

Não use:

- `com.coelhotv.dosik.dev`
- `com.coelhotv.dosik.preview`

Esses devem ficar reservados para ambientes auxiliares.

---

## 4. Antes de começar

Separe estes dados:

- nome do app: `Dosik`
- bundle id de produção: `com.coelhotv.dosik`
- domínio público: `https://dosiq.vercel.app`
- política de privacidade: `https://dosiq.vercel.app/politica-de-privacidade`
- e-mail público: `contact@coelho.me`
- categoria inicial sugerida: `Health & Fitness`
- idioma principal da ficha: `Portuguese (Brazil)` ou inglês base com conteúdo em pt-BR, conforme a UI disponível

---

## 5. Passo a passo - Certificates, Identifiers & Profiles

## 5.1. Criar o App ID

No Apple Developer:

1. abra `Certificates, Identifiers & Profiles`
2. entre em `Identifiers`
3. clique em `+`
4. escolha `App IDs`
5. continue
6. selecione `App`
7. preencha:
   - Description: `Dosik`
   - Bundle ID: `Explicit`
   - Bundle ID value: `com.coelhotv.dosik`
8. avance para a seleção de capabilities

### Regra crítica

Use sempre **App ID explícito**, nunca wildcard.

---

## 5.2. Quais capabilities selecionar

Para o estado atual do Dosiq, a recomendação é conservadora.

### Selecionar agora

#### Opção A - setup mínimo estrito

Não selecionar nenhuma capability especial agora.

Use esta opção se você quer apenas:

- registrar o app
- subir build
- testar no TestFlight
- adiar push nativo para o momento em que a Fase 6 iOS for implementada

#### Opção B - preparar o caminho de push

Selecionar apenas:

- `Push Notifications`

Use esta opção se você já sabe que o próximo passo real no iOS será integrar APNs/push nativo.

### Não selecionar agora

- `Associated Domains`
- `Sign In with Apple`
- `HealthKit`
- `App Groups`
- `iCloud`
- `NFC Tag Reading`
- `Apple Pay Payment Processing`
- `Siri`
- `Wallet`
- `Network Extensions`
- `Critical Alerts`
- `Time Sensitive Notifications`
- qualquer item de CarPlay
- qualquer item de DriverKit
- qualquer item de navegador padrão ou browser engine

### Motivo

Nada disso é necessário para:

- autenticação comum
- backend Supabase
- organização de medicamentos
- TestFlight
- publicação inicial

### App Services

Em `App Services`, para o Dosik:

- `MusicKit`: não
- `ShazamKit`: não
- `WeatherKit`: não

### Capability Requests

Em `Capability Requests`, para o Dosik:

- nenhuma agora

---

## 5.3. Salvar o App ID

Depois de selecionar apenas o necessário:

1. clique em `Continue`
2. revise
3. clique em `Register`

### Resultado esperado

O App ID de produção do iOS fica oficialmente reservado para o projeto.

---

## 6. Certificados e assinatura

Para um projeto Expo/EAS moderno, o caminho mais simples costuma ser deixar a automação do EAS cuidar da assinatura quando possível.

### Regra prática para o primeiro ciclo

Você não precisa sair criando tudo manualmente antes do tempo, desde que:

- o App ID exista
- o bundle identifier esteja correto
- a conta Apple esteja funcional

### O que validar agora

- o bundle identifier de produção existe
- o time Apple correto está selecionado
- você tem permissão suficiente na conta

---

## 7. Passo a passo - criar o app no App Store Connect

Depois do App ID, o próximo passo é o registro comercial/distribuição no App Store Connect.

### Passo 1

Entre em `App Store Connect`.

### Passo 2

Abra `Apps`.

### Passo 3

Clique em `+` e escolha `New App`.

### Passo 4

Preencha:

- Platforms: `iOS`
- Name: `Dosik`
- Primary Language: preferencialmente `Portuguese (Brazil)` se disponível
- Bundle ID: `com.coelhotv.dosik`
- SKU: use algo estável, por exemplo:

```text
dosik-ios
```

### Regra do SKU

O SKU é interno. Não precisa ser bonito. Precisa ser:

- único
- estável
- fácil de reconhecer

---

## 8. Informações iniciais do app no App Store Connect

Assim que o app existir, você vai preencher os blocos básicos.

## 8.1. App Information

Preencha primeiro:

- Name
- Subtitle
- Category
- Content Rights, se aplicável
- Age Rating
- Privacy Policy URL

### Recomendação inicial

- Name: `Dosik`
- Subtitle: algo curto como `Controle doses e estoque`
- Category: `Health & Fitness`
- Privacy Policy URL: `https://dosiq.vercel.app/politica-de-privacidade`

## 8.2. Age Rating

O age rating é obrigatório.

Para o Dosik, a tendência natural é rating baixo, desde que o app não tenha:

- conteúdo sexual
- violência
- jogos de azar
- conteúdo adulto

Você deve responder ao questionário com honestidade e deixar o sistema calcular a classificação.

### Recomendação prática

- não forçar override
- não marcar Kids category

---

## 9. App Privacy e Privacy Nutrition Label

Esse é um dos blocos mais importantes da Apple.

Você vai precisar declarar:

- quais tipos de dados o app coleta
- se esses dados são ligados ao usuário
- se são usados para tracking

### Leitura segura para o Dosik

Hoje, a tendência do app é incluir pelo menos:

- contato: e-mail
- identificadores de conta
- dados de saúde/fitness informados pelo usuário
- possivelmente dados de uso mínimos, se houver

### Recomendação crítica

Não responder “não coleta dados” por intuição.

Revise antes:

- autenticação
- Supabase
- logs
- Firebase, se estiver embutido em iOS
- qualquer SDK terceiro

## 9.1. App Tracking Transparency (ATT) ⚠️

**CRÍTICO:** Se o seu app coleta User ID ou Device ID e você pretende exibir anúncios ou usar dados para rastreamento (roadmap de monetização), a Apple EXIGE o pop-up de permissão.

- Se marcou "Sim" para Tracking no questionário, o app DEVE implementar `expo-tracking-transparency`.
- Se não implementou o pop-up, marque "Não" para Tracking no questionário (mesmo coletando IDs para Analytics).
- Rejeição Comum: **Guideline 5.1.2(i)**. Resolva implementando o ATT no código ou ajustando o formulário para "Não Rastreia para fins publicitários".

---

## 10. App Access e conta de review

Como o app exige login, prepare material de review desde o início.

Use como base:

- `plans/backlog-native_app/GUIA_APP_ACCESS_PLAY_CONSOLE.md`

Mesmo sendo um guia pensado para Google Play, a lógica também serve para Apple review:

- conta de teste dedicada
- dados de exemplo já cadastrados
- instruções curtas de login
- fluxo principal navegável sem configuração manual longa

### Recomendação

Crie uma conta exclusiva de review com:

- e-mail dedicado
- senha estável
- pelo menos 1 tratamento ativo
- pelo menos 1 item em estoque
- conteúdo na tela principal

---

## 11. Build iOS e upload para Apple

Depois do setup de Apple Developer + App Store Connect, o fluxo normal será:

1. gerar build iOS
2. enviar build
3. esperar processamento
4. usar o build em TestFlight

## 11.1. Regra de Versão vs. Build

No App Store Connect, você verá dois campos de versão:
- **Versão da Loja (Marketing):** O "nome" da versão que o usuário vê (ex: 1.0). Edite no portal para bater com seu código.
- **Versão do Binário (Build):** O valor real do `app.config.js` (ex: 0.1.1).

## 11.2. Como fazer o Upload do Binário (.ipa)

Diferente do Google, a Apple **não possui botão de upload de arquivo no navegador**. Use um destes métodos:

### Método A: EAS Submit (Recomendado)
Use a CLI do Expo para enviar o arquivo gerado localmente:
```bash
npx eas-cli submit --platform ios --path ./apps/mobile/build-xyz.ipa
```

### Método B: App Transporter (Visual)
1. Baixe o app **Transporter** na Mac App Store.
2. Faça login com sua conta Apple Developer.
3. Arraste o arquivo `.ipa` para dentro do app e clique em **Entregar**.

### Método C: Xcode
Se estiver buildando via Xcode, use o menu `Product > Archive` e depois `Distribute App`.

---

- bundle identifier igual ao app criado no App Store Connect
- versão coerente
- build number incremental

### Identidade atual do projeto

Hoje o projeto já define:

- `version`
- `ios.buildNumber`
- `ios.bundleIdentifier`

em `apps/mobile/app.config.js`

---

## 12. TestFlight - ordem recomendada

## 12.1. Internal Testing

Use primeiro para validar:

- instalação
- login
- navegação principal
- comportamento em iPhone real

### Grupo sugerido

- você
- uma ou duas pessoas de confiança
- eventualmente um dispositivo secundário seu

## 12.2. External Testing

Use depois que o app já estiver estável.

Para external testing:

- crie grupo externo
- adicione build
- preencha `What to Test`
- forneça informações de review beta se solicitado

### Regra importante

O primeiro build para testers externos pode passar por beta review da Apple.

---

## 13. Checklist de metadados para a ficha da App Store

Você vai precisar preparar:

- nome
- subtítulo
- descrição
- palavras-chave
- categoria
- screenshots
- app icon
- URL de política de privacidade
- suporte

### Conteúdos que já podem ser reaproveitados

Use como base:

- `plans/backlog-native_app/GUIA_ASO_E_CONTEUDOS_PLAY_STORE.md`

Parte desse material pode ser adaptada para:

- `Subtitle`
- `Description`
- `Promotional Text`
- `Keywords`

### Atenção

No iOS, o campo de palavras-chave existe e deve ser tratado com cuidado. Não use spam. Priorize termos realmente ligados ao produto.

---

## 14. Checklist mínimo antes do primeiro TestFlight

- App ID criado com `com.coelhotv.dosik`
- capabilities definidas com critério
- app criado no App Store Connect
- política de privacidade publicada
- age rating respondido
- app privacy revisada
- conta de review preparada
- build iOS com version/build number coerentes

---

## 15. Checklist mínimo antes da primeira submissão App Store

- tudo do TestFlight funcionando
- screenshots finais prontas
- descrição pronta
- subtítulo pronto
- palavras-chave revisadas
- categoria validada
- privacy nutrition label coerente com o app real
- conta de review funcional
- instruções de login claras

---

## 16. Recomendações específicas para o Dosik

Se eu estivesse configurando o projeto hoje, eu faria assim:

### Apple Developer

- criar App ID explícito `com.coelhotv.dosik`
- marcar no máximo `Push Notifications` se você quiser já preparar a fase de APNs
- deixar todo o resto desligado
- não habilitar App Services
- não solicitar Capability Requests

### App Store Connect

- criar app iOS com nome `Dosik`
- categoria inicial `Health & Fitness`
- política de privacidade apontando para `https://dosiq.vercel.app/politica-de-privacidade`
- conta de review pronta antes de qualquer submissão

### TestFlight

- começar com internal testing
- usar external testing só depois do fluxo principal estar estável

---

## 17. FAQ rápido

### Preciso marcar um monte de capabilities agora?

Não. O melhor caminho é habilitar o mínimo necessário.

### Preciso marcar App Services?

Não, para este app não há necessidade agora.

### Preciso solicitar Capability Requests?

Não.

### Posso adicionar capabilities depois?

Sim. Só lembre que mudanças podem exigir atualização de perfis de provisionamento e ajustes no projeto.

### Qual capability faz mais sentido marcar agora se eu quiser já preparar o futuro?

`Push Notifications`

### Sign in with Apple deve ser marcado agora?

Só se você realmente vai oferecer login com Apple no app.

### HealthKit deve ser marcado agora?

Não, a menos que a integração com o app Saúde seja uma feature real já entrando em implementação.

---

## 18. Próximos passos recomendados

Depois de concluir este guia:

1. finalizar App ID
2. criar app no App Store Connect
3. preparar app privacy
4. gerar build iOS
5. subir no TestFlight

Se quiser complementar este material, os documentos mais próximos são:

- `plans/backlog-native_app/GUIA_EXPO_DEV_E_EAS_ANDROID.md`
- `plans/backlog-native_app/GUIA_GOOGLE_PLAY_CONSOLE_MVP_ANDROID.md`
- `plans/backlog-native_app/GUIA_ASO_E_CONTEUDOS_PLAY_STORE.md`
- `docs/legal/POLITICA_DE_PRIVACIDADE.md`
