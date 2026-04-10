# Exec Spec Hibrido - Addendum: Dependencias Humanas e Pre-requisitos Nao-Automatizaveis

> **Status:** Addendum normativo e prescritivo
> **Base obrigatoria:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Consumido por:** Fase 0, Fase 4 e Fase 6
> **Objetivo:** formalizar todos os pre-requisitos que dependem de acao humana, contas externas, credenciais ou validacao manual, evitando que agentes fiquem bloqueados por dependencias nao documentadas

---

## 1. Papel deste addendum

Agentes de IA nao podem:

- criar contas em Apple Developer, Google Play ou Expo
- gerar certificados de assinatura iOS
- validar builds em simulador/emulator fisicamente
- aprovar politicas de privacidade para stores
- inserir credenciais em dashboards externos

Este addendum lista explicitamente o que o maintainer humano deve fazer e quando.

---

## 2. Matriz de dependencias humanas por fase

### 2.1. Fase 0 — Guardrails

| Dependencia | Responsavel | Bloqueante para | Status |
|-------------|-------------|-----------------|--------|
| Revisao e aprovacao das 3 ADRs | Maintainer | Fase 1 | Aprovado ✅ |
| Decisao sobre remocao de `expo` do `package.json` raiz | Maintainer | Fase 1 | Aprovado ✅ |

### 2.2. Fase 1 — Workspaces

| Dependencia | Responsavel | Bloqueante para | Status |
|-------------|-------------|-----------------|--------|
| Validacao visual da web apos workspaces (`npm run dev`) | Maintainer | Fase 2 | Pendente |
| Validacao do deploy Vercel preview | Maintainer | Merge do PR | Pendente |

### 2.3. Fase 4 — Scaffold Mobile

| Dependencia | Responsavel | Bloqueante para | Status |
|-------------|-------------|-----------------|--------|
| Conta Apple Developer ($99/ano) | Maintainer | Builds iOS, TestFlight | Em aprovação Apple |
| Conta Google Play Console ($25 one-time) | Maintainer | Builds Android, Internal Testing | Pendente |
| Conta Expo / EAS | Maintainer | `eas build`, `eas submit` | Pendente |
| `bundleIdentifier` e `androidPackage` finais | Maintainer | `app.config.js` | Pendente |
| Certificados de assinatura iOS (Provisioning Profile) | Maintainer | Build iOS | Pendente |
| Keystore Android | Maintainer ou EAS managed | Build Android | Pendente |
| Validacao em iOS Simulator | Maintainer | Gate da Fase 4 | Pendente |
| Validacao em Android Emulator | Maintainer | Gate da Fase 4 | Pendente |
| EAS Secrets configuradas (SUPABASE_URL, SUPABASE_ANON_KEY) | Maintainer | Build mobile funcional | Pendente |

### 2.4. Fase 5 — MVP Produto

| Dependencia | Responsavel | Bloqueante para | Status |
|-------------|-------------|-----------------|--------|
| Validacao funcional de cada tela em device/simulator | Maintainer | Merge de cada PR | Pendente |
| Validacao de UX em iOS e Android | Maintainer | Gate da Fase 5 | Pendente |
| Decisao sobre endpoint de geracao de token Telegram para mobile | Maintainer | Sprint de vinculo Telegram | Pendente |

### 2.5. Fase 6 — Push Native e Beta

| Dependencia | Responsavel | Bloqueante para | Status |
|-------------|-------------|-----------------|--------|
| APNs key configurada no Expo/EAS | Maintainer | Push iOS | Pendente |
| FCM configurado no Expo/EAS | Maintainer | Push Android | Pendente |
| Migracao SQL de `notification_devices` aplicada | Maintainer | Dispatcher multicanal | Pendente |
| Migracao SQL de `user_settings.notification_preference` | Maintainer | Preferencias de canal | Pendente |
| Teste em device iOS real (push) | Maintainer | Gate da Fase 6 | Pendente |
| Teste em device Android real (push) | Maintainer | Gate da Fase 6 | Pendente |
| Upload de build para TestFlight | Maintainer | Beta interno iOS | Pendente |
| Upload de build para Google Internal Testing | Maintainer | Beta interno Android | Pendente |
| Beta testers selecionados e convidados | Maintainer | Inicio do beta | Pendente |

### 2.6. Fase 7 — Migracao Web

| Dependencia | Responsavel | Bloqueante para | Status |
|-------------|-------------|-----------------|--------|
| Aprovacao explicita para mover web para `apps/web` | Maintainer | Inicio da Fase 7 | Pendente |
| Validacao do deploy Vercel com novo layout | Maintainer | Merge do PR | Pendente |
| Atualizacao de Root Directory no dashboard Vercel (se necessario) | Maintainer | Deploy em producao | Pendente |

---

## 3. Protocolo de validacao agente-humano

Quando uma fase exige validacao manual:

1. **Agente prepara:** implementa, roda testes automatizados, abre PR
2. **Agente documenta:** lista exatamente o que precisa ser validado manualmente
3. **Humano valida:** executa a validacao (simulator, device, deploy preview)
4. **Humano reporta:** marca como aprovado ou lista problemas encontrados
5. **Agente registra:** documenta resultado no journal DEVFLOW

### Template de solicitacao de validacao

O agente deve incluir no PR ou em mensagem ao maintainer:

```md
## Validacao manual necessaria

- [ ] `npm run dev` abre web normalmente
- [ ] App mobile abre em iOS Simulator
- [ ] Login funciona no mobile
- [ ] Sessao persiste ao fechar e reabrir

### Como testar
1. `cd apps/mobile && npx expo start`
2. Pressionar `i` para iOS ou `a` para Android
3. Fazer login com credenciais de teste
4. Fechar o app completamente e reabrir
```

---

## 4. Checklist de pre-requisitos antes de iniciar (Fase 0)

O maintainer deve completar estes itens antes de qualquer agente comecar a executar codigo:

- [ ] Decisao: vai criar conta Apple Developer agora ou adiar para Fase 4?
- [ ] Decisao: vai criar conta Google Play Console agora ou adiar para Fase 4?
- [ ] Decisao: `bundleIdentifier` e `androidPackage` definitivos ou placeholders?
- [ ] Conta Expo criada em expo.dev
- [ ] Decisao sobre remocao de `expo` do `package.json` raiz
- [ ] Confirmacao de que o limite de serverless functions Vercel (12) esta sob controle

---

## 5. Regra de bloqueio

Se uma fase exige validacao manual e o maintainer nao estiver disponivel:

- o agente NAO deve forcar merge
- o agente NAO deve pular a validacao
- o agente PODE prosseguir com tarefas da mesma fase que nao dependam da validacao pendente
- o agente DEVE registrar no journal que ha validacao bloqueada

---

## 6. Ancoragem e validacao contra a master spec

- Este addendum formaliza o que a master spec assume implicitamente
- Este addendum nao cria novos gates — apenas documenta gates que ja existem nas fases
- Este addendum protege o fluxo de execucao contra bloqueios silenciosos
- Este addendum respeita que code agents nunca mergeiam seus proprios PRs
