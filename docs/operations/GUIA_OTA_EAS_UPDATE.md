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

Roda uma vez no `apps/mobile` e associa o projeto ao serviço de updates do EAS:

⚠️ **O CLI NÃO escreve o `updates.url` aqui.** Ele só sabe editar `app.json` estático; o config do
dosiq é **dinâmico** (`app.config.js`, RE-001), então o comando avisa e não altera nada. A `url`
(`https://u.expo.dev/<projectId>`) já está declarada à mão no `app.config.js` — se você rodar o
comando e ele reclamar do config dinâmico, **isso é o esperado**, não uma falha.

```bash
cd apps/mobile
npx eas-cli@latest update:configure
```

### 1.2. `runtimeVersion` = `APP_VERSION` (ADR-082)

`app.config.js` declara o **valor literal**, reaproveitando a constante que ele já calcula:

```js
const APP_VERSION = '0.30.0'
// ...
runtimeVersion: APP_VERSION,
```

🔴 **Não use `{ policy: 'appVersion' }` neste projeto.** A forma de política é a documentada pela
Expo, mas o `build-android.sh`/`build-ios.sh` rodam `expo prebuild` **antes** do `eas build
--local`, e a pasta `android/`/`ios/` resultante faz o EAS classificar o projeto como *bare
workflow* — onde política de runtimeVersion não é suportada e o build **aborta**:

```
CommandError: You're currently using the bare workflow, where runtime version policies are not
supported. You must set your runtime version manually.
```

O literal produz exatamente o mesmo valor que a política produziria (é a mesma constante), então a
decisão do ADR-082 fica intacta — muda só quem resolve o valor: o `app.config.js`, não o EAS.

**Consequência mecânica que rege todo o resto deste guia:** o `runtimeVersion` de um build É o
`APP_VERSION` dele. Um update publicado com `channel`/`runtimeVersion` X só alcança builds
instalados com esse mesmo X. Por isso as §6 e §7 existem.

⚠️ **O outro lado da moeda (FR-004):** com o literal, é o bump de `APP_VERSION` que cria runtime
novo — igual à política. Portanto **toda mudança em código nativo/SDK/`ios/`/`android/` obriga
bump de `APP_VERSION`**, senão um JS incompatível pode alcançar um binário antigo.

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

✅ **Feito no PR 1.6 (2026-07-27).** Os **três** profiles declaram canal explícito — nenhum canal
é implícito, e um build nunca "cai" num canal por omissão:

| Profile | Canal | Formato | Como chega no device | Para quê |
|---|---|---|---|---|
| `development` | `development` | `.apk` / `.app` simulador | instalação manual | desenvolvimento diário |
| `preview` | `preview` | `.apk` / `.app` simulador | instalação manual (internal) | **alvo do smoke de OTA**, incl. o teste destrutivo do PO-5 |
| `production` | `production` | `.aab` / `.ipa` | Play Store / TestFlight | usuários reais |

Os scripts locais aceitam os três: `bash build-android.sh preview` · `bash build-ios.sh preview`.

🔴 **O canal é declarado em DOIS lugares, e os dois são obrigatórios** — cada um serve a uma ponta:

| Onde | Campo | Serve a |
|---|---|---|
| `eas.json` | `"channel"` por profile | o **publish** — roteamento branch↔channel no servidor do EAS |
| `app.config.js` | `updates.requestHeaders['expo-channel-name']` | o **cliente** — é o que fica gravado no binário |

Declarar só no `eas.json` **não basta neste projeto**: os scripts de build rodam `expo prebuild`,
que regenera `AndroidManifest.xml`/`Expo.plist` a partir do `app.config.js` e apaga o canal que o
`eas update:configure` havia escrito. O binário sai sem `expo-channel-name`, **não escuta canal
nenhum, e nenhum update jamais o alcança**.

O modo de falha é o pior possível: **silencioso**. O app instala, abre e funciona perfeitamente —
só nunca atualiza. Nenhum erro, nenhum log. Foi assim que apareceu no smoke do PR 1.6: só a linha
de bundle na tela de Perfil, mostrando o canal vazio, denunciou.

**Como conferir num binário antes de confiar nele:**

```bash
grep -o 'UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" android:value="[^"]*"' \
  apps/mobile/android/app/src/main/AndroidManifest.xml
# esperado: {"expo-channel-name":"preview"}  (ou production/development)
```

Ou, mais direto: a tela **Perfil** do app tem que mostrar o canal depois do `·`.

🔴 **O profile `preview` NÃO é um app novo.** Mesmo `bundleIdentifier` (`com.coelhotv.dosiq`),
mesma listagem de loja, mesmo código. A única diferença é o canal gravado dentro do binário — e é
ela que faz um update publicado em `preview` **não** chegar em nenhum usuário de produção.

⚠️ **Consequência prática no Android:** o APK de preview é assinado por esta máquina e o app da
Play Store pelo Google. Assinaturas diferentes ⇒ o Android **recusa instalar por cima**.
Para o smoke: desinstalar o Dosiq da loja → instalar o APK de preview → testar → desinstalar →
reinstalar da loja. Os dados moram no Supabase, então só é preciso logar de novo.

### 1.4. Segurança do canal — code signing DESATIVADO (emenda ao ADR-083, 2026-07-27)

🔴 **Leitura obrigatória antes de publicar.** Esta seção descreve a proteção que o canal OTA
**tem** e a que ele **não tem** — e a diferença importa mais que qualquer outra coisa neste guia.

#### O que aconteceu

O ADR-083 decidiu habilitar code signing (o cliente rejeitaria qualquer bundle não assinado pela
chave do projeto). Na implementação descobriu-se que **é recurso pago**:

```
EAS Update code signing requires a subscription to the EAS Enterprise plan.
```

O `codesigning:generate` gera as chaves normalmente numa conta sem plano, e a documentação do
`expo-updates` não menciona o gate — o erro só aparece no primeiro `eas update`. Enterprise é
preço corporativo. **Decisão do PO: seguir sem assinatura, risco aceito e nomeado.**

#### O risco, sem eufemismo

**Quem obtiver acesso à conta Expo consegue entregar código arbitrário a 100% da base instalada,
sem passar por revisão de loja.** Num app de saúde que dispara alarmes de dose, esse é o pior
cenário do canal OTA. Não existe barreira criptográfica no cliente — ele aceita o que o servidor
do EAS entregar para o seu canal.

#### O que protege o canal hoje

Estes controles vinham do ADR-083 D3 como camada secundária. **Agora são a defesa inteira:**

- **2FA obrigatório na conta Expo.** É literalmente a única barreira entre um invasor e a base
  instalada. Se você lê isto e não tem certeza de que o 2FA está ativo, pare e confira agora.
- **Publish manual, exclusivo do PO, do Mac Mini.** Nenhuma automação publica.
- **Zero `EXPO_TOKEN` persistente em CI** — proibido por ADR-083 D3; reversão exige ADR novo.
  Um token de robô seria uma segunda chave da casa, sem 2FA.
- **`update:rollback` continua disponível** e não exige assinatura — mitigação *depois* do fato,
  não prevenção.

#### As chaves geradas

O par existe e está guardado: `certs/certificate.pem` (público, versionado) e a chave privada
fora da árvore do repositório, apontada por `DOSIQ_OTA_PRIVATE_KEY_PATH`.

```bash
ls -l "$DOSIQ_OTA_PRIVATE_KEY_PATH"   # deve listar o arquivo, permissão 600
```

Elas estão **dormentes** — nenhum comando as usa hoje. Ficam prontas para o dia em que houver
plano: basta descomentar `codeSigningCertificate`/`codeSigningMetadata` no `app.config.js` e
rebuildar.

⚠️ **Armadilha de reativação — não descomente sem o plano ativo.** Um binário **com** certificado
rejeita todo bundle **não** assinado. Sem plano não há como assinar. O resultado é um canal OTA
travado nos dois sentidos, e **só um novo build de loja destrava** — perdendo justamente a
capacidade que o OTA existe para dar.

#### Se um dia houver plano

Reativar é descomentar as duas linhas do `app.config.js`, reintroduzir
`--private-key-path "$DOSIQ_OTA_PRIVATE_KEY_PATH"` no `publish-ota.sh`, e **rebuildar para a
loja**. A emenda do ADR-083 é revertida sem precisar de ADR novo — a decisão original continua
sendo a preferida.

---

## 2. Rotina — update comum

**Staging-first, sempre.** Nunca publique direto em `production`.

Publique **sempre** por `publish-ota.sh`, nunca chamando `eas update` na mão — ele roda o checklist
da §5 como gate que bloqueia, em vez de lista que se lê com pressa.

⚠️ Use `--channel`, **nunca** `--branch` (a CLI recusa os dois juntos). O canal é o que está gravado
no binário; a branch é só onde o update fica guardado. Depois de um rollback que repontou o canal
para outra branch (§4), publicar por `--branch` subiria **com sucesso** e não alcançaria device
nenhum — falha silenciosa logo após um incidente. O script já usa `--channel`.

```bash
cd apps/mobile

# 1. publicar em preview
bash publish-ota.sh preview "descrição curta"

# 2. smoke no build de preview (device com o APK do profile preview instalado)
#    reabrir o app DUAS vezes: o update baixa num launch e APLICA no seguinte

# 3. só então, production
bash publish-ota.sh production "descrição curta"
```

O SHA do commit entra na mensagem automaticamente (ADR-083 D4) e o script recusa publicar com a
working tree suja — o bundle é fotografia da árvore de arquivos, e árvore suja significa código no
ar que não existe em commit nenhum.

### Escada de rollout: 0 → 1 → 10 → 100%

Para updates não-críticos, o 3º argumento é a fração inicial; avance com `update:edit`:

```bash
bash publish-ota.sh production "descrição curta" 1

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
pule a escada. **Registre a justificativa** na mensagem do update e no CHANGELOG (§7): por que o
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
cd apps/mobile

# SEM flag de branch (a CLI não aceita `--branch`: "Nonexistent flag").
# Rodado sem argumento, pergunta tudo interativamente:
npx eas-cli@latest update:rollback

# ou, direto ao ponto, passando o Update group ID DE DESTINO:
npx eas-cli@latest update:rollback <GROUP_ID> --message "rollback: <motivo>"

# ou repontar o canal para uma branch anterior
npx eas-cli@latest channel:edit production --branch <branch-anterior>
```

🔴 **O `GROUP_ID` é o DESTINO, não a coisa a desfazer.** Verificado na prática (2026-07-27, PO-2):
o comando **republica o grupo que você selecionou**, criando um novo update com o mesmo bundle. Ele
confirma isso na própria mensagem padrão — `Republish "<mensagem do grupo escolhido>"`.

Consequência: **selecionar o update mais recente é um no-op disfarçado.** Ele publica um novo
`updateId` com exatamente o código que já está no ar. O dashboard mostra atividade, o device baixa
algo, e nada muda. Numa emergência isso custa dois ciclos de launch antes de alguém perceber.
Escolha sempre o update **anterior** ao ruim.

Fluxo interativo, com o que responder em cada passo:

| Pergunta | Resposta | Por quê |
|---|---|---|
| *Which type of update would you like to roll back to?* | **Published Update** | volta para um OTA anterior. `Embedded Update` descarta TODOS os OTAs e volta ao bundle da loja — é a saída de emergência ("todo OTA está quebrado"), não o rollback do dia a dia |
| *Find update by branch or channel?* | **Channel** | canal é o que o binário escuta. Depois de um `channel:edit` o mapeamento canal→branch muda, e raciocinar por branch erra o alvo em silêncio |
| *Select a channel* | `preview` / `production` | — |
| *Load more update groups?* (lista) | o update **anterior** ao ruim | ver acima: o selecionado é o destino |
| *Provide an update message* | Enter aceita o padrão | o padrão já cita o grupo de origem — trilha de auditoria pronta |

⚠️ Se os updates candidatos tiverem a **mesma mensagem**, a lista fica ambígua (só timestamp e SHA
distinguem). Mais um motivo para a mensagem de publish ser específica — o `publish-ota.sh` anexa o
SHA justamente para isso.

ℹ️ Sem code signing (§1.4), nenhum dos dois exige chave — são as duas formas de reverter e vale ter
as duas memorizadas antes de precisar delas. Se o code signing for reativado um dia, o
`update:rollback` volta a exigir `--private-key-path`: ele publica uma **diretiva** no canal (não é
uma exclusão), e diretiva não assinada seria rejeitada pelo device, que continuaria no bundle ruim.

🔴 **Caveat dos 2 launches.** Rollback é instantâneo **no canal** (a partir de agora, quem abrir o
app recebe o bundle anterior) — **não** é instantâneo no device. Um device que já baixou o update
ruim aplicou-o no launch N; ao reabrir agora (launch N+1) ele **verifica** o canal e baixa o
bundle revertido, mas só **aplica** no launch seguinte (N+2). Ou seja: quem já pegou o update ruim
continua rodando ele por pelo menos mais um ciclo de abertura do app após o rollback ser publicado.
Não existe forçar aplicação imediata — comunique isso a quem estiver esperando o rollback "resolver
na hora".

### "2 launches" é o melhor caso, não o caso típico (T017, 2026-07-27)

`fallbackToCacheTimeout: 0` faz o boot **nunca** esperar rede — o app abre na hora, sempre. O preço:
se a checagem falhar, ela não tenta de novo naquele processo. **O ciclo inteiro é perdido.**

Medido: device sai do modo avião, Wi-Fi religado, app aberto em seguida. O update só apareceu na
**3ª** abertura. O rádio leva segundos para associar e pegar DHCP — o ícone de Wi-Fi aparece antes
de a rota existir. A 1ª abertura checou contra uma rede que ainda não roteava e falhou calada.

Ou seja, a regra real não é "2 launches", é **"2 launches com rede funcionando no instante exato
do boot"**. Metrô, elevador, dados acabando, Wi-Fi de café que exige portal: cada boot desses
queima um ciclo sem avisar ninguém.

Consequência para quem opera: ao comunicar um fix por OTA, **não prometa janela curta com base em
contagem de aberturas**. A escada de rollout (§2) e o Sentry por `update_id` são o que dizem se o
fix realmente chegou — a aritmética de launches, não.

### Rede de segurança automática — comportamento medido (PO-5, 2026-07-27)

Antes do rollback manual existe uma defesa que não depende de ninguém perceber o incidente: o
**error recovery do expo-updates**. Update que crasha no boot é marcado como ruim e o app volta
sozinho ao bundle anterior.

Medido em device Android real, publicando um `throw` no top-level do `index.ts`:

| Abertura | O que aconteceu |
|---|---|
| 1ª | roda normal — o update quebrado só foi **baixado** |
| 2ª | aplica o quebrado → **tela preta**. O app não fecha nem mostra erro: o JS morre e a shell nativa fica viva |
| 3ª | abre normal, no **bundle anterior** — recuperado sozinho |

Três coisas para levar disso:

1. **O app não fica inabrível.** É o pior cenário do OTA e ele tem fundo. Vale para o bundle
   embutido também: sem update anterior, ele volta para o que veio na loja.
2. **O custo é uma abertura preta.** Não é indolor — o usuário vê o app quebrado uma vez. A
   recuperação automática é rede de segurança, não substituto do rollback manual: publicar o
   rollback continua sendo o certo, porque ele impede que **novos** devices baixem o ruim.
3. **Tela preta ≠ app fechando.** Foi o sintoma real, e é fácil confundir com travamento comum.
   Suporte precisa saber: "ficou preto depois de uma atualização" → mandar fechar de vez e reabrir
   uma terceira vez antes de qualquer outra coisa.

---

## 5. Checklist pré-publish (FR-015)

Antes de publicar, confirmar todos. Os três primeiros o `publish-ota.sh` **já verifica e bloqueia**
sozinho — os demais dependem de você:

- [x] ~~`git status` limpo~~ · **automático** (o script aborta com a árvore suja)
- [x] ~~SHA do commit na mensagem~~ · **automático** (ADR-083 D4)
- [x] ~~canal correto~~ · **automático** (o script publica por `--channel`, não por `--branch`)
- [ ] HEAD é um commit da `main`
- [ ] variáveis `EXPO_PUBLIC_*` conferidas para o ambiente-alvo (produção usa valores de produção,
      não os de preview)
- [ ] grep de secrets no bundle exportado antes do publish (PO-SEC-2):
  ```bash
  npx expo export --platform android
  grep -rE "(SUPABASE_SERVICE_ROLE|SECRET|PRIVATE_KEY)" dist/ && echo "❌ SECRET NO BUNDLE" || echo "✅ limpo"
  ```

---

## 6. Hotfix por OTA quando a `main` já andou (R-307)

O caso comum não é "publicar o que está na main". É: a loja tem a **0.30.0**, a `main` seguiu com
features para a próxima versão, e aparece um bug de JS em produção **agora**.

🔴 **Nunca publique da `main` nesse cenário.** O `eas update` empacota a **working tree**, não um
commit — e uma `main` que andou produz um destes dois desastres:

| Situação da `main` | O que acontece | Gravidade |
|---|---|---|
| ainda **não** bumpou a versão | runtime casa, e você entrega **todas as features não lançadas** junto do fix: código não revisado, possivelmente chamando nativo que o binário instalado não tem (crash), e violação da **Apple 3.3.1** | 🔴 grave e imediato |
| **já** bumpou (ex.: 0.31.0) | runtime não casa com aparelho nenhum: publica com sucesso e **ninguém recebe** | ⚠️ silencioso |

### O fluxo correto

Faça a working tree voltar a ser o que está na loja, e só então aplique o fix:

```bash
# 1. voltar ao código exato que virou o build da loja
git checkout -b hotfix/ota-0.30.0 mobile-v0.30.0

# 2. trazer SÓ a correção (já revisada e mergeada na main)
git cherry-pick <sha-do-fix>

# 3. staging-first, sempre
bash publish-ota.sh preview "fix do cálculo de estoque"
#    ...smoke no build de preview...
bash publish-ota.sh production "fix do cálculo de estoque"

# 4. marcar o novo estado, para o PRÓXIMO hotfix partir daqui
git tag mobile-v0.30.0-ota.1 && git push origin mobile-v0.30.0-ota.1
```

O `runtimeVersion` sai `0.30.0` sozinho — o `app.config.js` **daquele commit** dizia `0.30.0`. Você
não configura nada: a árvore certa produz o runtime certo.

⚠️ **O passo 4 não é burocracia.** Sem ele, o hotfix seguinte partiria de `mobile-v0.30.0` e
**desfaria** o ota.1, porque o cherry-pick do segundo fix não traz o primeiro.

### De onde vem a tag

`build-android.sh production` e `build-ios.sh production` criam `mobile-v<APP_VERSION>` e a
publicam no origin automaticamente (R-307). Eles também **recusam buildar de árvore suja** — um
binário compilado de um estado que não existe em commit nenhum não tem como ser marcado com
honestidade.

O `publish-ota.sh` recusa `production` quando o `HEAD` não descende da tag daquela versão, e avisa
explicitamente quando a tag **não existe** (build feito antes da R-307, ou de outra máquina sem
push da tag).

### Bônus: reproduzir um build antigo

O mesmo mecanismo responde *"como refaço o build 2803 para investigar um bug?"*:

```bash
git checkout mobile-v0.28.3
npm ci                        # package-lock.json é versionado
bash apps/mobile/build-android.sh production
```

Os diretórios nativos (`android/`, `ios/`) não precisam estar guardados — o `expo prebuild` os
regenera a partir do `app.config.js` **daquele commit**.

⚠️ **Limite honesto:** isso reproduz o **código**, não o **ambiente**. Versão de Xcode, SDK do
Android e toolchain nativa não são fixados pelo repositório, então um rebuild meses depois pode
gerar um binário diferente. Para investigar bug de JS, é irrelevante; para bug nativo, anote também
as versões da toolchain junto do release.

---

## 7. Versionamento — CHANGELOG

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

## 8. O que OTA não faz

- Não atualiza código nativo, SDK do Expo, `ios/`, `android/` — qualquer mudança nesses exige build
  de loja novo.
- Não alcança binário que não embute o cliente `expo-updates`. A **v0.30.0** é a primeira versão que
  carrega esse cliente — os installs abaixo dela (21 de 25 medidos no outage do AP-314/ADR-088)
  seguem inalcançáveis por OTA até migrarem para um build que o embuta. Não há atalho: quem não
  atualiza o binário não é alcançado por nada publicado neste canal.

---

## 9. Roteiro de smoke do PR 1.6

Este guia é o roteiro de validação do cliente `expo-updates` (PR 1.6, spec 051-A): configurar
`eas update:configure`, criar o profile `preview`, publicar um update de teste em `preview` e
seguir a §2 até confirmar recepção. Não improvisar passos fora do que está documentado aqui — se um
passo do smoke não é executável seguindo só este guia, o guia está incompleto.
