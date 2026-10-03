---
title: "Release Train e Procedência de Builds"
description: "Como o app mobile separa builds alpha (TestFlight / closed testing) do fechamento de release: procedência registrada em ledger, tag mobile-v<versão> só no fechamento do train (release-tag.sh) e o que cada script exige."
version: "1.0.0"
status: active
category: operation
audience:
  - dev
  - ops
tags:
  - mobile
  - release
  - versioning
  - git-tags
  - testflight
  - closed-testing
created_at: "2026-10-02"
updated_at: "2026-10-02"
---

# Guia Operacional — Release Train e Procedência de Builds

> Regra de origem: **R-307** (`.agent/memory/rules/mobile_and_platform/R-307.md`), com a emenda de
> 2026-10-02 que moveu a tag do *build* para o *fechamento do release train*. Este guia é o
> runbook; a regra é o porquê.

---

## 1. Resumo em 30 segundos

| Evento | Comando | Cria tag? | O que registra |
|---|---|---|---|
| **Build alpha** — `production` para TestFlight / closed testing, quantas vezes precisar | `bash build-ios.sh production` · `bash build-android.sh production` | **Não** | procedência: qual commit virou o binário (sidecar `.json` + ledger) |
| **Fechar o release train** — a versão planejada acumulou as features e o build a promover está decidido | `bash release-tag.sh <versão>` | **Sim** — `mobile-v<versão>` | a tag, no commit **compilado** |
| **OTA em `preview` / `device`** — testar o mecanismo de OTA | `bash publish-ota.sh preview …` | Não | — |
| **OTA em `production`** — hotfix de JS em versão já fechada | `bash publish-ota.sh production …` | Não | exige a tag do train (§6) |

**A ideia:** perfil `production` ≠ release. O mesmo perfil serve a muitos builds alpha de uma versão
em desenvolvimento; só o **fechamento do train** merece um marco permanente no git. Antes, o build já
criava a tag, e isso transformava cada alpha em colisão de tag ou em bump de versão forçado.

---

## 2. Conceitos

### 2.1. Build alpha × release train

- **Build alpha:** qualquer build `production` que sobe para uma faixa de teste fechada (TestFlight,
  closed testing). A versão (`APP_VERSION`) está em desenvolvimento — pode haver vários.
- **Release train:** a versão **planejada**, que acumula features ao longo de várias entregas e é
  promovida para produção nas lojas. Fecha quando se decide **qual build** representa o release.

### 2.2. Procedência × tag

Duas perguntas diferentes, dois mecanismos:

| Pergunta | Mecanismo | Quando existe |
|---|---|---|
| *Qual commit virou **este binário**?* | sidecar `<artefato>.json` + `builds.jsonl` | **todo** build `production` |
| *Qual commit **é o release** v0.34.0?* | tag anotada `mobile-v0.34.0` | **só** ao fechar o train |

A tag continua respondendo **uma** pergunta (R-307 §3b): *qual código virou o binário promovido*. Por
isso ela marca o commit **compilado**, nunca o `HEAD` do dia — e é **normal** que fique alguns
commits atrás da `main`.

### 2.3. Por que a tag importa (e por que não pode ser por build)

O gate do **OTA de produção** usa a tag como âncora: o `eas update` empacota a **working tree**, e
publicar da `main` que já andou entregaria features não lançadas junto do fix (código não revisado,
possivelmente chamando nativo que o binário instalado não tem, e violação da Apple 3.3.1). A árvore
precisa voltar a ser "loja + fix" — e a tag é o ponto de retorno. Se cada alpha criasse tag, a âncora
deixaria de significar "release".

### 2.4. A versão e o número de build

`buildNumber` (iOS) e `versionCode` (Android) derivam da versão: `major*10000 + minor*100 + patch`
(`apps/mobile/app.config.js`). TestFlight e Play Console recusam upload com número repetido — então
**cada upload alpha precisa de uma `APP_VERSION` nova**, com ou sem tag. A convenção de bump está na
R-221 §4 / `docs/standards/CHANGELOG_AND_RELEASES.md`.

---

## 3. Fluxos

### 3.1. Build alpha (o dia a dia)

```bash
cd apps/mobile
git push origin <branch>               # o commit precisa estar no origin (gate abaixo)
bash build-ios.sh production           # → .ipa, submit ao TestFlight
bash build-android.sh production       # → .aab em ~/local/dev-builds/ (upload manual na Play Console)
```

O que cada script faz de relevante para a procedência:

1. **Antes de compilar:** exige working tree **limpa**, `HEAD` **publicado no origin** e
   `SENTRY_AUTH_TOKEN`. Não olha tag.
2. **Depois que o artefato existe:** grava a procedência (§4) e imprime um lembrete de que a tag
   **não** foi criada.
3. Se o build da **outra plataforma** da mesma versão veio de **outro commit**, imprime um **aviso**
   (não bloqueia). Quem exige coerência é o fechamento do train (§3.2).

> iOS e Android de uma versão **devem** sair do mesmo commit. Se não saírem (ex.: o `HEAD` andou
> entre um build e outro), o aviso aparece e o §3.2 pedirá que você escolha o commit.

### 3.2. Fechar o release train

Quando a versão planejada está pronta e o build a promover está decidido:

```bash
cd apps/mobile
bash release-tag.sh 0.34.0
```

O script:

1. **Descobre o commit compilado** no ledger. iOS e Android precisam coincidir; se só uma plataforma
   tem build registrado, usa essa (e diz). Se divergirem ou o ledger não resolver, **recusa** e pede
   `--commit <sha>`.
2. **Sanidade:** o `app.config.js` *daquele* commit declara exatamente `0.34.0`; o commit está no
   origin; a tag não existe em **outro** commit.
3. Mostra o resumo (tag, versão, commit, origem do SHA, se está na `main`) e pede confirmação
   (`--yes` pula).
4. Cria a tag **anotada** `mobile-v0.34.0` e a publica com `--no-verify` (não reroda a suíte de
   testes para um push que só leva a tag).

```bash
bash release-tag.sh 0.34.0 --commit 1a2b3c4d   # escolher o commit à mão
bash release-tag.sh 0.34.0 --yes               # sem confirmação
```

É **idempotente**: rodar de novo no mesmo commit só confirma. Tag já existente em **outro** commit é
erro duro — a versão já foi fechada com outro código; **bumpe** `APP_VERSION`, **nunca mova a tag**.

### 3.3. OTA depois do fechamento

`publish-ota.sh production` só publica se `HEAD` **descende** de `mobile-v<APP_VERSION>`. O fluxo de
hotfix (branch cortado da tag + cherry-pick) está em `GUIA_OTA_EAS_UPDATE.md` §6 — não mudou.

- **Versão ainda sem tag** (train aberto) → o OTA de `production` é **recusado**, de propósito. Para
  testar o *mecanismo* de OTA use os canais **`preview`** e **`device`**, que existem para isso.
- A mensagem do script distingue os dois casos (train aberto × build antigo sem tag) e diz o que
  fazer.

### 3.4. Reproduzir um build

| Quero reproduzir… | Faça |
|---|---|
| o build de uma versão **fechada** | `git checkout mobile-v<versão>` → `npm ci` → `bash build-*.sh production` |
| um build **alpha** (sem tag) | descubra o SHA no ledger/sidecar (§4) → `git checkout <sha>` → `npm ci` → `bash build-*.sh production` |

⚠️ Reproduz o **código**, não o ambiente (Xcode, SDK Android e toolchain nativa não são fixados pelo
repositório).

---

## 4. Procedência: sidecar e ledger

Gravados por `record_build_provenance` (`apps/mobile/lib-release-tag.sh`) **só em builds
`production`**, depois que o artefato existe. Um JSON por build:

```json
{"ts":"2026-10-02T23:12:04Z","version":"0.33.6","platform":"ios","profile":"production","sha":"40fac9f50b742bb1c601672104d1e78d42a01daf","branch":"feat/minha-feature","artifact":"dosiq-v0.33.6-production.ipa"}
```

| Campo | Significado |
|---|---|
| `ts` | UTC do registro |
| `version` | `APP_VERSION` do build |
| `platform` | `ios` · `android` |
| `profile` | sempre `production` hoje |
| `sha` | commit **completo** compilado (`git rev-parse HEAD`) |
| `branch` | branch no momento do build |
| `artifact` | nome do arquivo gerado |

**Onde:**

| Artefato | Caminho |
|---|---|
| sidecar | `~/local/dev-builds/<artefato>.json` — ex.: `dosiq-v0.33.6-production.ipa.json` |
| ledger (append-only) | `~/local/dev-builds/builds.jsonl` (sobrescrevível com `DOSIQ_BUILD_LEDGER`) |

**Perguntas que o ledger responde:**

```bash
# todos os builds de uma versão
grep '"version":"0.33.6"' ~/local/dev-builds/builds.jsonl
# commit do último build iOS production da 0.33.6
grep -F '"version":"0.33.6","platform":"ios","profile":"production"' ~/local/dev-builds/builds.jsonl | tail -1
```

**Limites (declarados, não escondidos):**

- O ledger é **local da máquina** e **não é versionado** — builds feitos em outra máquina não estão
  nele. Para esses, `release-tag.sh --commit <sha>` resolve.
- Builds anteriores a 2026-10-02 **não têm** ledger. Para eles valem as tags criadas no regime antigo
  (§7).
- Os campos têm ordem fixa de propósito: `ledger_latest_sha` usa `grep` literal sobre o prefixo
  `"version":…,"platform":…,"profile":"production"`. Não reordene sem ajustar a função.

---

## 5. O que cada comando exige

| Comando | Árvore limpa | `HEAD` no origin | Tag | Registra procedência | Cria tag |
|---|---|---|---|---|---|
| `build-ios.sh production` / `build-android.sh production` | ✅ | ✅ | não olha | ✅ | ❌ |
| `build-* development/preview/device` | — | — | — | — | ❌ |
| `release-tag.sh <v>` | — | ✅ (do commit escolhido) | recusa se existir em **outro** commit | — | ✅ |
| `publish-ota.sh preview` | ✅ | ⚠️ avisa | — | — | ❌ |
| `publish-ota.sh production` | ✅ | ✅ | **exige** `HEAD` descendente da tag da versão | — | ❌ |

`HEAD` no origin é pré-condição do `--no-verify` no push da tag: o commit já passou pelo hook
`pre-push` (a suíte `test:critical`) quando foi publicado, então a tag não precisa rodar a suíte de
novo — e antes, rodava, **duas vezes** por release (uma por plataforma).

---

## 6. Casos especiais

### 6.1. iOS e Android de commits diferentes

Acontece quando o `HEAD` anda entre os dois builds (um commit de docs, por exemplo). Os builds
avisam; o `release-tag.sh` recusa até você escolher:

```bash
bash release-tag.sh 0.34.0 --commit <sha-que-representa-o-release>
```

Escolha o commit cujo **código** virou o binário promovido. Se o delta entre os dois é só
docs/scripts, qualquer um serve — mas a escolha é sua e fica registrada na tag.

### 6.2. Build feito antes do squash do PR

Se você builda do branch do PR (smoke antes do merge) e o PR é *squash-mergeado*, o commit compilado
**não está na história da `main`** — só o squash está, com a mesma árvore. O `release-tag.sh` mostra
`Na main: NÃO (squash do PR?)` e **aceita**: a tag marca o commit **compilado** (R-307 §3b). O fluxo
de hotfix OTA parte da **tag**, não da `main`, então segue funcionando.

### 6.3. Versão já fechada

Tag existente em outro commit significa que aquela versão já foi fechada com outro código. A saída é
**bumpar `APP_VERSION`** (R-221 §4). Mover a tag faria ela apontar para código que não é o do binário
de loja — a única coisa que a tag existe para dizer.

### 6.4. Hotfix OTA já aplicado

`mobile-v<versão>-ota.N` (tag manual, `GUIA_OTA_EAS_UPDATE.md` §6) continua sendo o marco de cada OTA
de produção aplicado. Empurre-a com `git push --no-verify origin <tag>` — o commit já foi publicado.

---

## 7. Mudança de regime (migração)

Até 2026-10-02 o `build-*.sh production` criava `mobile-v<versão>` **a cada build**. Consequências
para quem lê o histórico:

- Tags existentes (`mobile-v0.30.0`, `mobile-v0.30.1`, `mobile-v0.33.4`, `mobile-v0.33.6`) foram
  criadas **pelo build**, no regime antigo. Continuam válidas como âncora de OTA.
- `mobile-v0.33.6` aponta para `40fac9f` — o commit do branch do PR #852, compilado antes do squash
  (`a573996e`). É o caso do §6.2.
- A partir daqui, uma tag nova significa **release train fechado**, não "um build foi feito".

---

## 8. Troubleshooting

| Mensagem | Causa | Ação |
|---|---|---|
| `❌ Build de loja exige working tree limpa.` | há arquivo modificado/não rastreado | commite ou stashe; o SHA registrado precisa corresponder ao binário |
| `❌ O commit … não está em nenhum branch do origin.` | `HEAD` só existe local | `git push origin <branch>` e rode de novo |
| `❌ Não consegui consultar o origin (offline?)` | sem rede para o `git fetch` | reconecte; não dá para provar a publicação offline |
| `⚠️ O build ios/android de vX foi feito de OUTRO commit` | `HEAD` andou entre as plataformas | informativo; ao fechar o train use `--commit` (§6.1) |
| `❌ Nenhum build production de vX no ledger` | build antigo, ou de outra máquina | `release-tag.sh <v> --commit <sha>` |
| `❌ iOS e Android … commits DIFERENTES` | idem §6.1 | escolha com `--commit` |
| `❌ O commit … declara APP_VERSION='Y', não 'X'` | `--commit` errado, ou versão errada | confira o SHA e a versão |
| `❌ A tag mobile-vX já existe em OUTRO commit` | versão já fechada com outro código | bumpe `APP_VERSION`; nunca mova a tag |
| `publish-ota.sh`: `HEAD não descende de mobile-vX` | train aberto, ou `main` que já andou | train fechado → `release-tag.sh X`; só testando OTA → canal `preview`/`device`; hotfix → `GUIA_OTA_EAS_UPDATE.md` §6 |
| `⚠️ Não consegui publicar a tag no origin` | rede/permissão | repita o comando impresso (`git push --no-verify origin <tag>`) |

---

## 9. Referências

- **R-307** — procedência do binário (regra; emenda 2026-10-02) · **R-221** — SQP / bump de versão ·
  **R-314** — canal de entrega (OTA × loja) · **ADR-082** — `runtimeVersion = APP_VERSION` · **ADR-083**
  — OTA assinado / auditoria
- `GUIA_OTA_EAS_UPDATE.md` — publicação, rollout, rollback e hotfix de OTA
- `GUIA_EXPO_DEV_E_EAS_IOS.md` §5.1 · `GUIA_EXPO_DEV_E_EAS_ANDROID.md` §13.2 — os scripts de build
- Código: `apps/mobile/lib-release-tag.sh` · `apps/mobile/release-tag.sh` · `apps/mobile/build-ios.sh` ·
  `apps/mobile/build-android.sh` · `apps/mobile/publish-ota.sh`
