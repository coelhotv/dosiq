# Guia Pratico - Expo.dev e EAS para iOS

> **Contexto:** Dosiq hybrid/native | Rebranding Finalizado
> **Data:** 2026-04-22
> **Escopo:** configurar certificados Apple, resolver dependências de build local e gerar .ipa/.app para testes e App Store.

---

## 1. Identidade do App (iOS)

| Perfil | Nome | Bundle Identifier |
|---|---|---|
| `development` | `Dosiq Dev` | `com.coelhotv.dosiq.dev` |
| `preview` | `Dosiq Preview` | `com.coelhotv.dosiq.preview` |
| `production` | `Dosiq` | `com.coelhotv.dosiq` |

---

## 2. Pré-requisitos de Ambiente (Mac M-Series)

### 2.1. Xcode e SDK
A partir de Abril de 2026, a Apple exige o **SDK 26** (Xcode 26+).
*   Certifique-se de que o seu `apps/mobile/eas.json` tenha `"image": "latest"` para builds na nuvem.
*   Para builds locais, use o Xcode 26.

### 2.2. Caminho do Node (NVM fix)
Se você usa NVM, os scripts de build do Xcode podem falhar por não encontrar o binário do Node. 
**Solução:** Crie o arquivo `apps/mobile/ios/.xcode.env.local` com o caminho absoluto:
```bash
export NODE_BINARY="/Users/SEU_USUARIO/.nvm/versions/node/v24.14.1/bin/node"
```

---

## 3. Certificados e Chaveiro (Crucial) 🔐

O build local do EAS falha se o Mac não confiar plenamente na cadeia de certificados da Apple.

### 3.1. WWDR Certificate
Se você receber o erro `Distribution certificate... hasn't been imported successfully`, o culpado geralmente é o certificado intermediário da Apple.
*   Baixe e instale o **Apple Worldwide Developer Relations Certification Authority (G3)**.
*   Certifique-se de que ele esteja na chaveira **login** (Início).

### 3.2. Validando Identidades
Antes de buildar, rode:
```bash
security find-identity -v -p codesigning
```
Você deve ver pelo menos uma identidade válida (em verde) com o seu nome/equipe da Apple.

---

## 4. Configuração do Monorepo e EAS 🏗️

### 4.1. O problema do .easignore
Em um monorepo, o EAS CLI pode ignorar os arquivos do Firebase (`GoogleService-Info.plist`) por causa do `.gitignore` global.

**Solução:** Crie um arquivo `.easignore` na **raiz do repositório (root)** e outro em `apps/mobile/` forçando a inclusão:
```text
!apps/mobile/GoogleService-Info-development.plist
!apps/mobile/GoogleService-Info-production.plist
!apps/mobile/google-services-production.json
```

### 4.2. firebase.json
Para evitar avisos de "Firebase configuration not found" e garantir que as notificações (Messaging) funcionem, mantenha em `apps/mobile/firebase.json`:
```json
{
  "react-native": {
    "analytics_auto_collection_enabled": false,
    "messaging_auto_setup_enabled": true
  }
}
```

---

## 5. Gerando Builds iOS

### 5.1. Build Local (Recomendado para velocidade)
Gera o `.ipa` (production) ou simulador build no seu próprio Mac:
```bash
cd apps/mobile
npx eas-cli build --platform ios --profile production --local
```

### 5.2. Build na Nuvem (Cloud)
Gera o binário nos servidores da Expo:
```bash
npx eas-cli build --platform ios --profile production
```

---

## 6. Submissão e App Store Connect

### 6.1. Criptografia (Compliance)
No `app.config.js`, o Dosiq já está configurado para pular as perguntas de criptografia da Apple toda vez que você sobe um build:
```javascript
ios: {
  infoPlist: {
    ITSAppUsesNonExemptEncryption: false
  }
}
```
*   Na pergunta do TestFlight sobre algoritmos, responda: **"d. Nenhum dos algoritmos mencionados acima"**.

### 6.2. Push Notifications
*   O identificador `com.coelhotv.dosiq` deve ter o "Push Notifications" Capability ativo no Apple Developer Portal.
*   A **Push Key (.p8)** deve estar cadastrada no painel do Expo (`eas credentials`).

---

## 7. Troubleshooting Comum

| Erro | Causa Provável | Solução |
|---|---|---|
| `ENOENT: GoogleService-Info-...` | Arquivo ignorado pelo EAS | Checar se o `!` está no `.easignore` da raiz. |
| `Distribution certificate failure` | Falta do WWDR ou Certificado expirado | Instalar Apple WWDR G3 no Keychain. |
| `ReactCodegen phase failed` | Node.js não encontrado pelo Xcode | Verificar `apps/mobile/ios/.xcode.env.local`. |
| `SDK version issue (90725)` | Xcode antigo no servidor EAS | Atualizar `eas.json` para `"image": "latest"`. |

---
*Gerado em: 22 de Abril de 2026 para o projeto Dosiq.*
