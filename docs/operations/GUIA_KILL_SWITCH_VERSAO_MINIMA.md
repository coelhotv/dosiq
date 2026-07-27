---
title: "Kill switch de versão mínima"
description: "Runbook operacional para ativar, confirmar e desativar o bloqueio de boot por versão mínima do app mobile."
version: "1.0.0"
status: active
category: operation
audience:
  - dev
  - ops
tags:
  - mobile
  - kill-switch
  - version-gate
  - incident
created_at: "2026-07-27"
updated_at: "2026-07-27"
epic: "051"
---

# Guia Operacional — Kill Switch de Versão Mínima

## Visão Geral

O kill switch de versão mínima (`app_version_gate`) bloqueia o boot de builds mobile abaixo de uma
versão configurada, por plataforma. É um mecanismo separado do OTA (ver
[`GUIA_OTA_EAS_UPDATE.md`](GUIA_OTA_EAS_UPDATE.md)) e existe justamente para o que OTA **não**
alcança: binário sem `expo-updates` embutido, mudança nativa, ou runtime órfão que nenhum update JS
resolve. Decisão de desenho completa: ADR-091 (D1–D10). Spec dona: 051-A (FR-018/021).

---

## 1. Quando acionar — e sobretudo quando NÃO

**Se OTA resolve, use OTA.** O kill switch é o último recurso, não a primeira reação a um bug em
produção. Acione apenas quando:

- a mudança necessária é nativa (SDK do Expo, `ios/`, `android/`) — OTA não entrega isso;
- o runtime afetado está órfão e ninguém vai publicar update para ele;
- o binário instalado não embute `expo-updates` (builds anteriores à v0.29.0) — para esses, nem OTA
  nem kill switch alcançam; a única saída é o usuário atualizar pela loja.

Bloquear o boot de um app de medicação é uma ação com custo real para quem depende dele — trate como
last resort, não como reflexo.

---

## 2. Como acionar — dois caminhos, ambos válidos

⚠️ **A cerimônia de confirmação é DO SERVIDOR, não da tela.** O handler (`api/admin.ts` →
`versionGate`) computa a frota afetada e recusa ativar sem `acknowledge_affected_devices` batendo
exatamente com a contagem que ele mesmo calculou. Um painel que "sumisse" não removeria essa
proteção — a proteção mora no endpoint. Quem entende isso não confunde "a tela sumiu" com "a
cerimônia sumiu".

### (a) `curl` — sempre funciona, é o único caminho até o PR 1.5c

```bash
# 1. tentar ativar — o servidor RECUSA e devolve a contagem de devices afetados
curl -X PATCH "$APP_URL/api/admin?resource=versionGate" \
  -H "Authorization: Bearer $JWT_ADMIN" -H "Content-Type: application/json" \
  -d '{"platform":"android","min_supported_version":"0.29.0","is_active":true}'

# 2. reenviar com acknowledge_affected_devices = o número EXATO devolvido acima
curl -X PATCH "$APP_URL/api/admin?resource=versionGate" \
  -H "Authorization: Bearer $JWT_ADMIN" -H "Content-Type: application/json" \
  -d '{"platform":"android","min_supported_version":"0.29.0","is_active":true,"acknowledge_affected_devices":<N>}'
```

Um `<N>` errado (chutado, arredondado, de uma medição anterior) é recusado — o servidor exige o
número que ele mesmo acabou de calcular, não uma estimativa aproximada.

### (b) Painel admin web — disponível após o PR 1.5c

Mesma cerimônia (contagem → confirmação explícita), agora exibida na tela — dois passos: primeiro a
tentativa mostra a contagem, depois um segundo clique confirma. A tela **exibe** a contagem que o
servidor devolveu; não a calcula por conta própria. View: `apps/web/src/views/admin/VersionGateAdmin.tsx`,
acessível pelo menu admin em Configurações.

---

## 3. Como desfazer

```bash
curl -X PATCH "$APP_URL/api/admin?resource=versionGate" \
  -H "Authorization: Bearer $JWT_ADMIN" -H "Content-Type: application/json" \
  -d '{"platform":"android","is_active":false}'
```

**Desativar NÃO exige `acknowledge_affected_devices`.** É deliberado e assimétrico: ativar bloqueia
gente, então exige cerimônia; desativar libera gente, então tem de ser barato e imediato — sem
fricção, sem contagem, sem segundo passo. O usuário bloqueado destrava no próximo boot (ou na
próxima volta ao foreground — ver §4).

---

## 4. Comportamento garantido (o que dizer a um usuário que reclamou)

- **Fail-open em toda indeterminação.** Offline, erro de rede, timeout, config inválida, linha
  ausente para a plataforma, versão ilegível dos dois lados da comparação — em qualquer um desses
  casos o app **abre**. O gate só bloqueia no caso positivo e explícito: versão instalada
  comparável e comprovadamente abaixo do mínimo, com `is_active = true`.
- **Alarmes de dose continuam disparando com o bloqueio ativo.** A tela full-screen do alarme
  **cede por cima** do overlay do kill switch — obrigação clínica > bloqueio de update. Não é bug,
  é desenho: um usuário travado no overlay ainda recebe o alarme da dose dele.
- **Reavaliação no foreground, não só no boot.** Um app minimizado por dias ou semanas é
  reavaliado a cada volta ao primeiro plano (via `AppState`), não apenas quando o processo reinicia
  do zero. Ativar o gate afeta também quem já tem o app aberto em background, na próxima vez que
  ele voltar à frente — não é preciso esperar o usuário fechar e reabrir.
- **O overlay sempre mostra o link `https://dosiq.app`.** É a saída honesta: a versão web não tem o
  problema que causou o bloqueio (deploya via Vercel, está sempre corrente) e continua disponível
  para o usuário acessar o histórico de medicação enquanto o binário mobile está bloqueado. Essa
  URL é constante compilada no cliente — nunca vem da configuração remota do gate (ADR-091 D7): a
  saída de emergência não pode ser removível pela mesma config que aplica o bloqueio.

---

## 5. Quem escreve — e por que ninguém mais

Escrita exclusiva de `ADMIN_USER_ID` (`auth.users.id` do admin, comparado direto pelo
`verifyAdminAccess` em `server/utils/auth.ts` contra o retorno de `supabase.auth.getUser()`). Fail-
closed explícito: env ausente ⇒ **nega** todo acesso admin, nunca "se a env existir, checa" —
`ADMIN_USER_ID` faltando bloqueia o próprio admin antes de bloquear qualquer outra coisa.

**O admin é um único usuário, definido por variável de ambiente. Isso é dívida conhecida,
registrada, não descuido** (ADR-091, "Dívidas registradas"). Quando deixar de ser uma pessoa só, a
migração é para uma tabela `admin_users` gravável apenas por `service_role` — item de escala, não
vetor de segurança aberto hoje.

---

## 6. Docs puro — commit direto na main

Este guia (e seu par `GUIA_OTA_EAS_UPDATE.md`) é documentação pura: commit + push direto na `main`,
sem branch/PR. Se a branch de integração (`feature/055-w1-sdk54`) estiver aberta no momento deste
commit, **rebasear a branch logo em seguida** — senão o squash-merge da integração pode apagar o
doc (incidente conhecido, AP-234).
