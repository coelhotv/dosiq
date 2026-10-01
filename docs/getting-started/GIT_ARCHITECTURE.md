---
title: "Arquitetura Git"
description: "Especificação da arquitetura Git com isolamento de gitdir externo para contornar travamentos e lentidão do daemon iCloud."
version: "1.1.0"
status: active
category: setup
audience:
  - dev
tags:
  - git
  - icloud
  - local-setup
created_at: "2026-07-08"
updated_at: "2026-10-01"
---

# Arquitetura Git — Mac Mini M2 (gitdir externo + iCloud)

Setup usa **gitdir externo** para isolar objetos git do daemon de sync do iCloud.

## Estrutura de diretórios

```
~/git/dosiq/              ← working tree (iCloud sincroniza os arquivos fonte)
  .git                           ← ARQUIVO (não dir): "gitdir: ../../../../../local_git/dosiq/.git"

~/local_git/dosiq/.git/          ← gitdir REAL (fora do iCloud — sem locks do daemon)
  config → remotes: origin (GitHub) + bridge (iCloud_server bare)

~/Library/.../git_server/dosiq.git/  ← bridge bare repo (relay via iCloud entre máquinas)

```

## Por que gitdir externo?

iCloud sincroniza tudo em `~/git-icloud/`, causando locks em `index`/`COMMIT_EDITMSG`, corrupção de pack files e lentidão. Solução: `.git` é um arquivo texto apontando para `~/local_git/dosiq/.git/` (fora do iCloud).

## gsync — sincronização origin + bridge

Função de shell em `~/.bashrc` (seção "GSYNC"), agnóstica de repo. Opera na branch atual.

```
1. origin: git fetch origin $branch
2. origin: git rebase origin/$branch          (origin é fonte da verdade; falha aborta)
3. origin: git push origin $branch            (COM hooks — pre-push é o gate real)
4. bridge: git push bridge origin/$branch:refs/heads/$branch --force --no-verify
```

- **Gate:** o `.husky/pre-push` roda `npm run test:critical` e aborta o push se falhar. O `gsync` não altera o hook; agentes e `git push` manual seguem com a saída completa.
- **Saída capturada:** o `gsync` redireciona a saída do push para um log (`mktemp`). Sucesso imprime uma linha com o caminho do log; falha imprime as últimas 60 linhas + o caminho.
- **Bridge é espelho:** `--force` e `--no-verify` de propósito — o commit já passou pelo gate ao ir para o origin; re-rodar a suíte só custaria tempo. Sem `origin` configurado, faz push simples da branch para o bridge.
- **Regra crítica:** bridge sempre espelha origin (mesmo SHA). Nunca `git pull bridge` como fonte.

## gsync-native (legado)

`~/.local/bin/gsync-native.sh` (alias `gsync-native`) ainda existe, mas está **obsoleto** desde 2026-05-24: o projeto saiu do iCloud e o smoke mobile roda direto de `~/git/dosiq/apps/mobile`. Fechar sprint mobile = commit + push (`gsync`).

## Diagnóstico rápido

```bash
cat ~/git/dosiq/.git                          # confirma gitdir externo
cat ~/local_git/dosiq/.git/config                    # ver remotes
git fetch bridge origin --quiet && git log --oneline bridge/main -3 origin/main -3
# Se SHAs diferentes: git push bridge origin/main:refs/heads/main --force
source ~/.bashrc && gsync                            # re-sync completo
```

## Proibido

- Nunca criar `.git/` como diretório em `~/git/dosiq/` — quebra gitdir, iCloud sincroniza objetos
- Nunca `git push bridge $branch` diretamente — sempre via `gsync`
