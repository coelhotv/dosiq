---
title: "OTA com EAS Update"
description: "Runbook operacional para publicar, escalonar, auditar e reverter atualizações OTA do app mobile via EAS Update."
version: "1.0.0"
status: active
category: operation
audience:
  - dev
  - ops
tags:
  - expo
  - eas-update
  - ota
  - mobile
created_at: "2026-07-27"
updated_at: "2026-07-27"
epic: "051"
---

# Guia Operacional — OTA com EAS Update

## Visão Geral

Este guia cobre a operação do canal de atualizações OTA (over-the-air) do app mobile via
`eas update`. OTA entrega **código JS/bundle** para builds já instalados, sem passar pela loja —
mas só alcança devices cujo `runtimeVersion` combina com o do update publicado.

Este guia **não cobre** setup de EAS Build/keystores para builds de loja (ver
[`GUIA_EXPO_DEV_E_EAS_ANDROID.md`](GUIA_EXPO_DEV_E_EAS_ANDROID.md)) nem o kill switch de versão
mínima (ver [`GUIA_KILL_SWITCH_VERSAO_MINIMA.md`](GUIA_KILL_SWITCH_VERSAO_MINIMA.md) — mecanismo
separado, para o que OTA **não** alcança).

Decisões que fundamentam este runbook: ADR-082 (versionamento OTA sob política `appVersion`) e
ADR-083 (code signing + publish manual PO-only). Spec dona: 051 (FR-006/012/015/019, NC2/NC3).

---

## 1. Setup (uma vez por ambiente)

### 1.1. `eas update:configure`

Roda uma vez no `apps/mobile`, cria/associa o canal de update ao projeto EAS e escreve
`updates.url` em `app.config.js`:

```bash
cd apps/mobile
npx eas-cli@latest update:configure
```

### 1.2. `runtimeVersion` sob política `appVersion` (ADR-082)

`app.config.js` deve declarar:

```js
runtimeVersion: { policy: 'appVersion' }
```

**Consequência mecânica que rege todo o resto deste guia:** o `runtimeVersion` de um build É o
`APP_VERSION` dele. Um update publicado com `channel`/`runtimeVersion` X só alcança builds
instalados com esse mesmo X. Por isso a §5 existe.

### 1.3. Channel por perfil

`eas.json` precisa de `channel` explícito em **cada** profile de build que recebe OTA —
`production` **e** `preview`:

```json
"build": {
  "preview": {
    "channel": "preview",
    "android": { "buildType": "apk" }
  },
  "production": {
    "channel": "production",
    "env": { "SENTRY_ALLOW_FAILURE": "true" },
    "android": { "buildType": "app-bundle" }
  }
}
```

⚠️ **`eas.json` hoje só tem os profiles `development` e `production`** (reconfirmado 2026-07-25).
O profile `preview` **não existe** e precisa ser criado antes do primeiro update de staging —
internal distribution, canal `preview`, para servir de alvo do smoke da §2.

### 1.4. Code signing (ADR-083) — leitura obrigatória antes de publicar pela primeira vez

O cliente **rejeita bundle não assinado**. Sem isto, comprometer a conta Expo bastaria para
entregar código malicioso a 100% da base — inaceitável num app de saúde.

```bash
npx expo-updates codesigning:generate
```

Isso gera um par de chaves. A pública é embutida no build (`app.config.js` →
`updates.codeSigningCertificate`); a privada assina cada `eas update`.

🔴 **Custódia e backup da chave privada — leia antes de gerar a chave.**

- A chave privada **nunca** entra no git (`.gitignore`). Vive apenas no Mac Mini onde o `eas
  update` é disparado.
- **Perder a chave = perder o canal OTA inteiro.** Não há como recuperar updates assinados com uma
  chave perdida — a única saída é gerar par novo, embutir o certificado público num **novo build
  de loja**, e esperar a adoção desse build para voltar a ter OTA funcional. Enquanto isso, a base
  instalada fica sem OTA (mas o app continua abrindo — assinatura só bloqueia bundle, não boot).
- **Onde mora:** Mac Mini (`~/.eas/` ou path configurado no `codesigning:generate`) — é a única
  máquina autorizada a publicar `production` (ADR-083 D3).
- **Quem tem acesso:** PO, dono do Mac Mini. Publish de `production` é exclusivo dele — conta Expo
  com 2FA, sem `EXPO_TOKEN` de CI (proibido por ADR-083 D3; reversão exige ADR novo).
- **Backup:** cópia da chave privada em local seguro fora do Mac Mini (gestor de senhas ou
  equivalente com controle de acesso), documentada e testada — um backup nunca restaurado não é
  backup. Se você é quem está configurando isso pela primeira vez e não tem esse backup
  documentado em algum lugar, pare e resolva antes de publicar o primeiro update assinado.

---

## 2. Rotina — update comum

**Staging-first, sempre.** Nunca publique direto em `production`.

```bash
cd apps/mobile

# 1. publicar em preview
npx eas-cli@latest update --branch preview --channel preview \
  --message "<descrição curta + SHA da main>"

# 2. smoke no build de preview (device/emulador com build --profile preview instalado)
#    reabrir o app: o update aplica no PRÓXIMO cold start, não instantâneo

# 3. só então, production
npx eas-cli@latest update --branch production --channel production \
  --message "<descrição curta + SHA da main>"
```

### Escada de rollout: 0 → 1 → 10 → 100%

Para updates não-críticos, escalone com `--rollout-percentage` e avance com `eas update:edit`:

```bash
npx eas-cli@latest update --branch production --channel production \
  --rollout-percentage 1 --message "..."

# observar (ver abaixo), depois avançar:
npx eas-cli@latest update:edit --branch production --rollout-percentage 10
npx eas-cli@latest update:edit --branch production --rollout-percentage 100
```

**O que observar entre cada degrau** antes de avançar:

- **Sentry** — taxa de erro segmentada por `update_id`. Um pico correlacionado ao update novo é
  sinal de parar e não avançar (ou reverter — §4).
- **PostHog** — eventos chegando com o `update_id` novo confirma que a fração do rollout está
  realmente recebendo e aplicando o bundle (não só "publicado", mas "instalado em campo").

Não há tempo mínimo fixo entre degraus — use julgamento pela volume de tráfego do degrau atual vs.
o intervalo necessário para os dois sinais acima aparecerem.

### Crítico/urgente

Quando a situação justifica (ex.: bug ativo afetando usuários agora), publique direto em 100% —
pule a escada. **Registre a justificativa** na mensagem do update e no CHANGELOG (§5): por que o
risco de pular a validação gradual foi aceito.

---

## 3. Emergência de schema (FR-019)

Gatilho: erro `42703` (coluna inexistente) ou `42501` (grant) aparecendo em produção — sinal de
que um deploy de schema quebrou um runtime que ainda não recebeu o patch de compatibilidade.

1. Listar os runtimes ativos afetados:
   ```bash
   ./scripts/fleet-versions.sh
   ```
2. **Publicar o MESMO patch em TODOS os runtimes ativos**, um `eas update` por
   `branch`/`channel` correspondente a cada `runtimeVersion` na lista. A frota é fragmentada por
   `runtimeVersion` (ADR-082) — publicar só no runtime corrente deixa a cauda (runtimes mais
   antigos ainda ativos) quebrada.

---

## 4. Rollback

```bash
# repontar o canal para uma release anterior
npx eas-cli@latest channel:edit production --branch <branch-anterior>

# ou reverter a última publicação da branch
npx eas-cli@latest update:rollback --branch production
```

🔴 **Caveat dos 2 launches.** Rollback é instantâneo **no canal** (a partir de agora, quem abrir o
app recebe o bundle anterior) — **não** é instantâneo no device. Um device que já baixou o update
ruim aplicou-o no launch N; ao reabrir agora (launch N+1) ele **verifica** o canal e baixa o
bundle revertido, mas só **aplica** no launch seguinte (N+2). Ou seja: quem já pegou o update ruim
continua rodando ele por pelo menos mais um ciclo de abertura do app após o rollback ser publicado.
Não existe forçar aplicação imediata — comunique isso a quem estiver esperando o rollback "resolver
na hora".

---

## 5. Checklist pré-publish (FR-015)

Antes de rodar `eas update` em `preview` ou `production`, confirmar todos:

- [ ] `git status` limpo (working tree sem alterações não commitadas)
- [ ] HEAD é um commit da `main`
- [ ] SHA do commit vai na `--message` do update (trilha de auditoria — ADR-083 D4)
- [ ] variáveis `EXPO_PUBLIC_*` conferidas para o ambiente-alvo (produção usa valores de produção,
      não os de preview)
- [ ] grep de secrets no bundle exportado antes do publish (PO-SEC-2):
  ```bash
  npx expo export --platform android
  grep -rE "(SUPABASE_SERVICE_ROLE|SECRET|PRIVATE_KEY)" dist/ && echo "❌ SECRET NO BUNDLE" || echo "✅ limpo"
  ```

---

## 6. Versionamento — CHANGELOG

🔴 **OTA NÃO bumpa `APP_VERSION`.** Sob a política `runtimeVersion: appVersion` (ADR-082), bump de
versão = runtime novo = update publicado nesse runtime nunca alcança nenhum build já instalado
(todos ainda rodam o runtime anterior). Um "patch" que bumpasse a versão nasceria órfão.

Entrada de CHANGELOG para cada release OTA:

```
[X.Y.Z+ota.N]
```

- `X.Y.Z` = `APP_VERSION` corrente (o runtime alvo, não muda)
- `N` = sequencial do OTA sobre esse runtime (1, 2, 3, … — reinicia a cada bump de `APP_VERSION`)
- Registrar também: `updateId` (devolvido pelo `eas update`) e o SHA da main publicado

O próximo build de loja (bump real de `APP_VERSION`) absorve os OTAs acumulados: o CHANGELOG dessa
versão referencia as entradas `+ota.N` anteriores (não duplica o conteúdo).

---

## 7. O que OTA não faz

- Não atualiza código nativo, SDK do Expo, `ios/`, `android/` — qualquer mudança nesses exige build
  de loja novo.
- Não alcança binário que não embute o cliente `expo-updates`. A v0.29.0 é a primeira versão que
  carrega esse cliente — os installs abaixo dela (21 de 25 medidos no outage do AP-314/ADR-088)
  seguem inalcançáveis por OTA até migrarem para um build que o embuta. Não há atalho: quem não
  atualiza o binário não é alcançado por nada publicado neste canal.

---

## 8. Roteiro de smoke do PR 1.6

Este guia é o roteiro de validação do cliente `expo-updates` (PR 1.6, spec 051-A): configurar
`eas update:configure`, criar o profile `preview`, publicar um update de teste em `preview` e
seguir a §2 até confirmar recepção. Não improvisar passos fora do que está documentado aqui — se um
passo do smoke não é executável seguindo só este guia, o guia está incompleto.
