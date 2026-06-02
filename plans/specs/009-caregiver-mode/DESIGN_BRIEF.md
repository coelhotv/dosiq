# Design Brief — Épico Modo Cuidador (009-caregiver-mode)

**Para**: Time de Design (UX/UI)
**De**: Produto / Eng — Dosiq
**Data**: 2026-06-02
**Status**: Briefing inicial — aguardando concepção de telas/fluxos/mocks
**Specs de referência**: [EPIC.md](EPIC.md) + fases `phase-1`…`phase-5`

> **Objetivo deste documento:** dar ao design o contexto, as personas, o inventário de telas e as restrições para **projetar os fluxos e mocks** que ainda não existem. Não é spec técnica — é o ponto de partida criativo. Dúvidas → seção [Perguntas ao Design](#perguntas-ao-design).

---

## 1. A grande ideia (1 parágrafo)

O Modo Cuidador **inverte a polaridade da saúde digital**: quem configura é o **cuidador** (filha, enfermeiro), quem só confirma é o **paciente idoso**. A filha cadastra remédios, monta a agenda e convida a mãe por um código/QR. A mãe abre o app já pronto e só registra "tomei". Se ela falha, a filha é **alertada** onde estiver. Um médico pode acompanhar a adesão em modo leitura. Tudo com **soberania LGPD**: a paciente revoga o acesso a qualquer momento.

---

## 2. Personas

| Persona | Quem | Contexto de uso | Dor a resolver |
|---|---|---|---|
| **Ana Paula** (cuidadora familiar) | Filha, 40s, smartphone fluente | No trabalho/em casa, gerencia a rotina da mãe | "Não sei se minha mãe tomou os remédios" |
| **Dona Maria** (paciente) | Mãe, 67+, **baixo letramento digital**, possível baixa visão/destreza | Em casa, celular básico | "App complicado, letra pequena, não entendo" |
| **Roberto** (cuidador profissional) | Enfermeiro, gerencia 3-5 pacientes | Multi-paciente no mesmo device | "Preciso alternar entre pacientes sem confundir" |
| **Dr. Carlos** (médico observador) | Médico, desktop em consultório | Antes da consulta, read-only | "Quero dado objetivo de adesão, não 'tomo tudo certo doutor'" |

> **Persona-âncora do design = Dona Maria.** Toda tela que ela vê deve passar no teste "minha avó consegue?".

---

## 3. Restrições de design (não-negociáveis)

### Acessibilidade (telas do paciente idoso)
- **Contraste ≥ 7:1** (AAA) em todas as telas vistas pela paciente.
- **Área de toque mínima 60px** (botões, opções, dropdown).
- **Tipografia grande**, hierarquia clara, mínimo de texto por tela.
- Botões primários **enormes e únicos** ("Tomei", "Sou Paciente") — evitar escolhas múltiplas simultâneas.
- Linguagem **humana e calorosa**, não clínica (ex.: *"Sua filha Ana Paula quer te ajudar"*).

### Plataformas
- **Mobile** (RN/Expo): paciente + cuidador. Retrato.
- **Web/PWA desktop**: dashboard cuidador consolidado + dashboard médico.
- Seguir **design tokens** existentes (`packages/design-tokens`) — cores/spacing/tipografia do Dosiq. Não inventar paleta nova.

### Terminologia (regra de produto)
- **NUNCA** usar "protocolo" na UI → usar **"tratamento"**.
- Evitar pronomes possessivos clínicos frios; tom acolhedor.

### LGPD (telas de consentimento/revogação)
- Consentimento **full-screen**, linguagem simples, 2 botões claros (`Sim, autorizo` / `Não, manter privado`).
- Revogação **visível e acessível** (não escondida em submenu profundo).

---

## 4. Inventário de telas a conceber (por fase)

> Prioridade segue a cadeia de gates do épico. **P1 = primeiro a desenhar.**

### 🟢 phase-2 · Setup Flow — **P1 (desenhar primeiro)**
Fluxo de onboarding e vínculo. É o "momento mágico" do épico.

| Tela / Componente | Quem vê | Notas de design |
|---|---|---|
| **Onboarding — escolha de papel** | Ambos | 2 botões gigantes: `[ Sou Paciente ]` / `[ Sou Cuidador ]`. ⚠️ **NÃO é a 1ª tela do app.** Aparece **só no contexto de convite** (device aberto via deeplink/QR). O cold-start padrão continua sendo o onboarding normal de auto-gestão (a maioria dos usuários nunca vê esta tela). |
| **Cuidador — convite gerado** | Cuidador | **QR Code grande e legível** + código 6 díg (ex. `A7X-92B`) + botão "Compartilhar Convite" (share nativo: WhatsApp/SMS/Telegram/e-mail — só canais). |
| **Paciente — scanner QR** | Paciente | Câmera nativa + **input manual alternativo** do código (caso sem QR). Erro de conexão → permitir digitar e salvar offline. |
| **Consentimento LGPD (full-screen)** | Paciente | *"Sua filha Ana Paula quer te ajudar a cuidar da rotina. Você autoriza que ela veja se você tomou as doses e mude horários?"* → `Sim, autorizo` / `Não, manter privado`. |
| **Importação concluída** | Paciente | Feedback caloroso: app já pronto com a rotina. |
| **Configurações > Cuidadores** | Paciente | Lista de cuidadores autorizados + botão **"Revogar Acesso"** (visível, com confirmação). |

**Estados a cobrir:** loading do scan, erro de câmera/permissão, sem internet (input manual), código expirado/inválido, sucesso.

### 🟢 phase-6 · Patient Cared Mode + Sinais — **P1 (desenhar junto da phase-2)**
A experiência da Maria — metade do produto. UI **simplificada AAA**, a mais importante do épico.

| Tela / Componente | Quem vê | Notas de design |
|---|---|---|
| **Home cuidado (paciente)** | Paciente | Tela limpíssima: agenda do dia + botão **"Tomei" gigante** por dose. **Esconder** edição de medicamentos/posologia. ≥7:1, toque ≥60px. |
| **Confirmar dose / retroativo** | Paciente | Confirmar "Tomei" + ajustar hora/data simples (1-2 toques). |
| **Sheet de sinais à filha** | Paciente | Atalhos grandes: "Está acabando" (por remédio), "Perdi alguns comprimidos", "Não consegui tomar". 1 toque, desfazer fácil, feedback "vamos avisar". |
| **Estado offline** | Paciente | Sinal enfileirado: "Vamos avisar quando a internet voltar." |

**Estados:** loading, offline (fila), confirmação de sinal, desfazer.

### 🟢 phase-1 · Foundation & RLS — **sem telas** (DB/backend). Pular no design.

### 🟢 phase-0 · Identity & Context — **cold-start (P1)**
| Item | Notas |
|---|---|
| **Cold-start padrão** | Onboarding normal de auto-gestão (já existe) — **garantir que o modo cuidador NÃO o substitui**. O fork de papel só no contexto de convite. |
| **Seletor de contexto** | Ver phase-3 (dropdown "Eu / Minha mãe / …"). |

### 🟡 phase-3 · Caregiver Dashboard — **P2**
| Tela / Componente | Quem vê | Notas |
|---|---|---|
| **Dashboard mono-paciente (mobile)** | Cuidador | Agenda + adesão + estoque de 1 paciente. **Esta é a versão base (não gated).** |
| **Card "Confirmar Dose" remota** | Cuidador | Ação de registrar dose pelo cuidador (`source='caregiver'`). Estado: confirmado/erro. |
| **Dashboard consolidado (web desktop)** | Cuidador | Cards por paciente: últimas doses, **alertas de atraso (>30min) piscando**, adesão semanal, estoque estimado. |
| **Seletor de contexto (header mobile)** | Qualquer conta | Dropdown "**Eu / Minha mãe / Meu pai**" — alterna contexto `self` (default) + `managed`. Não é só feature de cuidador profissional. Conta sem `managed` = sem dropdown. Expansão p/ N pacientes ⚠️ **GATED G1**. Toque ≥60px. |

### 🟡 phase-4 · Alert Engine — **P2** (poucas telas, muito copy)
| Item | Notas |
|---|---|
| **Notificações ao cuidador** (push/Telegram/e-mail) | Desenhar o **copy + layout** dos 6 eventos: dose atrasada, dose perdida, estoque crítico, receita vencendo, digest semanal, vínculo revogado. Tom: acionável e gentil (*"Que tal dar uma ligadinha?"*). |
| **Escolha de canal de notificação** | Tela em Configurações do cuidador: push / Telegram / e-mail / nenhum. |

### 🔵 phase-5 · Medical Observer — **P3 (gated G3)**
| Tela / Componente | Quem vê | Notas |
|---|---|---|
| **Dashboard médico (web desktop)** | Médico | Lista de pacientes: nome, adesão 7d, último med tomado, chip de tendência (Estável/Crescente/Queda). **Read-only — sem botões de edição.** |
| **Geração/compartilhamento de token de acesso** | Paciente/Cuidador | Gerar link temporário (TTL 24-72h) pro médico. Estado: ativo/expirado/revogar. |
| **Estado de acesso negado/expirado** | Médico | Token expirado → tela 403 amigável. |

---

## 5. Fluxos a mapear (jornadas ponta-a-ponta)

1. **Setup presencial** (ideal): filha instala app no celular da mãe → "Sou Paciente" → escaneia QR do próprio celular → mãe confirma consentimento → rotina pronta.
2. **Setup remoto** (deeplink): filha gera link → envia por WhatsApp/SMS → mãe clica → abre app (ou vai pra store) com código pré-preenchido → consentimento → pronto.
3. **Alerta de não-adesão**: dose 08:00 não registrada → 30min → filha recebe alerta no canal escolhido → filha liga → registra "Confirmar Dose" remoto → celular da mãe atualiza.
4. **Revogação soberana**: mãe vai em Configurações > Cuidadores → "Revogar Acesso" → confirma → app vira standalone, cuidador perde acesso.
5. **Multi-paciente** (Roberto, gated): alterna pacientes no dropdown → dados isolados por paciente.
6. **Médico observa** (gated): recebe link token → abre dashboard read-only → vê adesão.
7. **Sinal upstream do paciente**: Maria percebe que o remédio está acabando (ou derrubou comprimidos) → toca o atalho → filha é notificada → filha ajusta estoque/repõe.

> Para cada fluxo: mapear **happy path + estados de erro/borda** (sem internet, código expirado, permissão negada, token expirado).

---

## 6. Entregáveis esperados do design

- [ ] **Fluxogramas** das 6 jornadas (com estados de erro).
- [ ] **Wireframes** → **mocks high-fidelity** das telas P1 (phase-2) primeiro.
- [ ] **Especificação de estados** por tela (loading/vazio/erro/sucesso).
- [ ] **Copy** das notificações (6 eventos) e dos textos de consentimento/revogação.
- [ ] **Protótipo navegável** do setup flow (validar com usuário 60+ se possível).
- [ ] Mocks exportados → versionar em diretório de mocks do projeto (alinhar path com eng; demais épicos usam `MOCKS_APP_CRUD/`).

---

## 7. Perguntas ao Design

1. **Setup presencial vs remoto**: qual priorizar no protótipo? (produto aposta no presencial como ideal).
2. **QR Code**: tela do cuidador exibe QR para a câmera da mãe escanear — como tornar isso óbvio para a dupla idoso+cuidador?
3. **Modo paciente simplificado**: o quanto podemos **reduzir/esconder** da UI normal do Dosiq quando o device está em modo paciente-gerenciado? (ex.: esconder edição de medicamentos).
4. **Multi-perfil (cuidador)**: dropdown no header é suficiente ou precisa de uma tela de "meus pacientes"?
5. **Identidade visual do médico**: dashboard clínico desktop deve parecer "ferramenta profissional" ou manter a identidade calorosa do Dosiq?

---

## 8. O que NÃO está no escopo deste épico

- **Integração WhatsApp Business / bot** (entrega futura separada) — aqui WhatsApp é apenas **um dos canais de share/notificação** entre vários (push, SMS, Telegram, e-mail), não uma integração Meta.
- Prontuário clínico completo / portal B2B (trigger-gated, fora do escopo).
