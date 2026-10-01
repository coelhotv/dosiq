---
title: "Expo.dev e EAS para iOS"
description: "Guia prático de configuração de perfis, EAS Build e provisionamento de certificados para geração de builds iOS (ipa) no Dosiq."
version: "1.1.0"
status: active
category: operation
audience:
  - dev
  - ops
tags:
  - expo
  - eas
  - ios
created_at: "2026-04-22"
updated_at: "2026-10-01"
---

# Guia Pratico - Expo.dev e EAS para iOS
---

## 1. Identidade do App (iOS)

**Todos os perfis usam o mesmo Bundle Identifier** (`com.coelhotv.dosiq`) — é ele que tem o App Group
`group.com.coelhotv.dosiq` registrado no portal, e a Live Activity não funciona sem. Fonte:
`variants` em `apps/mobile/app.config.js`.

| Perfil | Nome no aparelho | Bundle Identifier | Saída | Canal OTA |
|---|---|---|---|---|
| `development` | `Dosiq dev` | `com.coelhotv.dosiq` | `.app` (simulador) | `development` |
| `preview` | sem variante própria — cai em `production` (`Dosiq`) ⚠️ | `com.coelhotv.dosiq` | `.app` (simulador) | `preview` |
| `device` | `Dosiq device` | `com.coelhotv.dosiq` | `.ipa` ad hoc | `device` |
| `production` | `Dosiq` | `com.coelhotv.dosiq` | `.ipa` | `production` |

⚠️ **Consequência do bundle único:** instalar um build `device` **substitui** o app da App Store no
aparelho (mesmos dados). Para voltar ao app real, reinstale pela loja. O nome `Dosiq device` é a
única pista visível de qual binário está instalado.

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

### 4.1. Credencial Firebase e `.easignore`
O `.easignore` ignora arquivos de ambiente e `credentials.json`, mas **libera explicitamente** os de
Firebase (eles são ignorados pelo git e o EAS local precisa deles no tarball). Hoje a credencial é
**única** para todos os perfis: `apps/mobile/GoogleService-Info.plist`. O `build-ios.sh` falha cedo
se ela não existir e a exporta em `GOOGLE_SERVICES_PLIST_PATH` (lida pelo `app.config.js`). Baixe do
Firebase Console e salve nesse path.

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

### 5.1. Script `build-ios.sh` (caminho oficial)

O script vive em `apps/mobile/build-ios.sh` (o código é a fonte da verdade; o cabeçalho tem o contrato
completo). Uso:

```bash
cd apps/mobile
bash build-ios.sh [development|preview|device|production] [--no-install]
```

O que ele faz, na ordem:

1. Valida o perfil e, em `device`/`production`, a presença do **Apple Distribution certificate** no
   keychain (`device` assina com o mesmo certificado do production — só o provisioning profile
   difere). Desbloqueia o keychain.
2. Valida `GoogleService-Info.plist` (§4.1). `production`: exige `SENTRY_AUTH_TOKEN` e confere a tag
   `mobile-v<versão>` com working tree limpa **antes** de compilar (R-307).
3. Mostra o resumo e pede confirmação (Enter).
4. Apaga `ios/` e roda `expo prebuild --platform ios --no-install`. O `rm -rf ios` é **intencional**:
   o Swift da bridge/widget de um prebuild anterior conflita com o novo.
5. `eas build --local --clear-cache`. A saída vai também para um **log**:
   `~/local/dev-builds/build-ios-<perfil>-v<versão>-<timestamp>.log`. O sucesso é decidido pela
   existência do artefato (o `ENOTEMPTY` de cleanup devolve 1 mesmo com build bom).
6. Move o artefato para `~/local/dev-builds/dosiq-v<versão>-<perfil>.<app|ipa>`. Em
   `development`/`preview` o resultado é um `tar.gz` que o script **extrai** para um `.app`.
7. `device`: **instala o `.ipa` no iPhone** via `xcrun devicectl device install app` (ver abaixo).
8. `production`: `eas submit` para o TestFlight e, depois, cria/publica a tag `mobile-v<versão>`.

**Simulador não recebe push.** Qualquer smoke que dependa de notificação no iPhone usa o perfil
`device` (ad hoc, assinado para os UDIDs de `eas device:list`).

**Instalação automática (`lib-install-device.sh`).** O alvo vem de `DOSIQ_IOS_DEVICE` (nome ou UDID de
`xcrun devicectl list devices`), definido no `~/.bashrc`. Sem a variável: 1 aparelho alcançável →
usa esse; vários → pergunta; nenhum → avisa e pula. Funciona por cabo ou Wi-Fi. `--no-install` só
gera o `.ipa`. Falha de instalação não derruba o script (o `.ipa` fica em `~/local/dev-builds/` e o
comando manual é impresso). Causas comuns: aparelho bloqueado/desconectado, ou UDID fora do
`eas device:list`.

### 5.2. Build Local direto (sem o script)
Útil só para depurar o EAS; o script acima já cobre locale, `npm` e credenciais:
```bash
cd apps/mobile
eas build --platform ios --profile production --local
```

### 5.3. Build na Nuvem (Cloud)
Gera o binário nos servidores da Expo:
```bash
eas build --platform ios --profile production
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
