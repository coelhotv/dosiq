# Arquitetura Git — Mac Mini M2 (gitdir externo + iCloud)

Setup usa **gitdir externo** para isolar objetos git do daemon de sync do iCloud.

## Estrutura de diretórios

```
~/git-icloud/dosiq/              ← working tree (iCloud sincroniza os arquivos fonte)
  .git                           ← ARQUIVO (não dir): "gitdir: ../../../../../local_git/dosiq/.git"

~/local_git/dosiq/.git/          ← gitdir REAL (fora do iCloud — sem locks do daemon)
  config → remotes: origin (GitHub) + bridge (iCloud_server bare)

~/Library/.../git_server/dosiq.git/  ← bridge bare repo (relay via iCloud entre máquinas)

~/local/test-native-dosiq/       ← worktree para testes Expo/native (fora do iCloud)
```

## Por que gitdir externo?

iCloud sincroniza tudo em `~/git-icloud/`, causando locks em `index`/`COMMIT_EDITMSG`, corrupção de pack files e lentidão. Solução: `.git` é um arquivo texto apontando para `~/local_git/dosiq/.git/` (fora do iCloud).

## gsync — sincronização origin + bridge

```
1. git fetch origin + bridge
2. Auto-repair: se bridge SHA ≠ origin SHA → force-push origin → bridge
3. git pull --rebase origin $branch  (origin é fonte da verdade)
4. git push origin $branch
5. git push bridge origin/$branch    (espelha SHAs — nunca rebasa para bridge)
```

**Regra crítica:** bridge sempre espelha origin (mesmo SHA). Nunca `git pull bridge` como fonte.

## gsync-native (`~/.local/bin/gsync-native.sh`)

1. Valida `~/local_git/dosiq` acessível — **BLOQUEANTE**
2. Chama `gsync` de `~/git-icloud/dosiq`
3. Atualiza native worktree: `git fetch origin + reset --hard origin/$branch`
4. Copia credenciais (`.env.*`, `google-services.json`) do iCloud para o worktree

## Diagnóstico rápido

```bash
cat ~/git-icloud/dosiq/.git                          # confirma gitdir externo
cat ~/local_git/dosiq/.git/config                    # ver remotes
git fetch bridge origin --quiet && git log --oneline bridge/main -3 origin/main -3
# Se SHAs diferentes: git push bridge origin/main:refs/heads/main --force
source ~/.bashrc && gsync                            # re-sync completo
```

## Proibido

- Nunca criar `.git/` como diretório em `~/git-icloud/dosiq/` — quebra gitdir, iCloud sincroniza objetos
- Nunca `git push bridge $branch` diretamente — sempre via `gsync`
- Nunca ignorar o check de `~/local_git/dosiq` no `gsync-native`
