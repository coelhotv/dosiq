# Fase 7 — Comunicação Dual-Channel & Modo Cuidador (Dosiq 2026)

> **Versão:** 1.1 — Revisão de 30/05/2026  
> **Changelog v1.0→v1.1:** P7-01 (separação 7A/7B), P7-02 (Meta Business + cenário dev sem CNPJ), P7-03 (exec spec api/webhooks.js), P7-04 (templates WhatsApp), P7-05 (role observer para médico).

Este documento especifica a engenharia de software e UX para a **Fase 7**, agora **separada em duas sub-fases independentes**:

- **Fase 7A — Modo Cuidador Completo** (100% executável por agentes IA, sem dependências externas)
- **Fase 7B — WhatsApp Bot via Meta Cloud API** (bloqueada por Meta Business verification + MEI)

---

## ⚠️ Prerequisitos Administrativos (Ação Humana — PO)

> A Fase 7B depende de ações administrativas que **não podem ser executadas por agentes IA**. Devem ser iniciadas **em paralelo com a Fase 6 ou antes**.

| # | Ação | Responsável | Prazo | Status |
|---|------|------------|-------|--------|
| 1 | Abrir MEI (CNAE 6201-5/01 — Desenvolvimento de software) | PO | 1-2 dias (online, gratuito) | ⬚ |
| 2 | Criar Meta Business Account com CNPJ do MEI | PO | Após #1 | ⬚ |
| 3 | Submeter verificação empresarial Meta Business | PO | Semana 1 após #2 | ⬚ |
| 4 | Registrar número de telefone dedicado para WhatsApp Business | PO | Após #3 | ⬚ |
| 5 | Criar e submeter templates de mensagem para aprovação (ver §2.2) | PO + Dev | Após #4 | ⬚ |
| 6 | Obter aprovação dos templates pela Meta | Automático | 2-8 semanas após #5 | ⬚ |
| 7 | Testar sandbox do WhatsApp Business API | Dev | Após #6 | ⬚ |

> **Nota sobre CNPJ:** O PO é desenvolvedor individual sem CNPJ registrado. A recomendação é abrir MEI (gratuito, online, ativação em 1-2 dias). Sem CNPJ, a Meta NÃO concederá verificação empresarial. **Alternativa:** Enquanto aguarda, focar no Telegram (já operacional em produção, zero burocracia).

---

# FASE 7A — Modo Cuidador Completo

> **Executabilidade por agentes:** ✅ 100% — sem dependências externas.  
> **Prerequisito:** Fase 6 concluída.  
> **Referência de design:** [DRAFT_CAREGIVER_MODE.md](./DRAFT_CAREGIVER_MODE.md)

## 1. O Novo "Modo Cuidador" (Iniciando no Cuidador)

Para anular a barreira de exclusão digital da terceira idade, a Cuidadora (Ana Paula) realiza todas as tarefas complexas de configuração de dados, deixando ao paciente (Dona Maria) apenas a visualização simplificada e as confirmações.

### 💻 W7.1 — Fluxo de Criação e Setup por QR Code (UX)

| Superfície | Status |
|-----------|--------|
| Mobile (Cuidador) | 🆕 Novo — fluxo de criação de perfil + QR Code |
| Mobile (Paciente) | 🆕 Novo — fluxo "Sou Paciente" + scanner |
| PWA (Cuidador) | 🆕 Novo — dashboard de gestão |

1.  **No painel da filha (Web ou App):**
    *   Ana Paula clica em "Gerenciar Novo Paciente" e cadastra a mãe.
    *   Ela insere os medicamentos ativos da mãe, definindo doses e horários.
    *   Ao finalizar, o sistema exibe um **QR Code grande e legível** e um código de 6 dígitos (ex: `A7X-92B`).
2.  **No celular da mãe (Dona Maria):**
    *   O Dosiq é instalado e aberto na tela de primeiro uso.
    *   Aparecem duas opções grandes: `[ Sou Paciente ]` e `[ Sou Cuidador ]`.
    *   Ao clicar em `[ Sou Paciente ]`, o app abre a câmera nativa de leitura de QR Code.
    *   Ao escanear a tela do celular da filha (ou digitar o código), o app da Dona Maria é preenchido instantaneamente com todos os remédios e horários programados.

### 🔒 W7.2 — Consentimento LGPD & Revogação Soberana
*   **O Aceite:** Assim que o código é verificado no celular do paciente, uma caixa de diálogo em tela cheia exibe os termos de conformidade e consentimento:
    > *"Sua filha Ana Paula quer te ajudar a cuidar da rotina de saúde. Você autoriza que ela veja se você tomou as doses e faça alterações de horários?"*
    > `[ Sim, eu autorizo ]` `[ Não, manter privado ]`
*   **A Revogação:** No app da Dona Maria, um botão visível e acessível em *Configurações > Cuidadores* permite clicar em **"Revogar Acesso do Cuidador"**. Isso deleta a linha de relacionamento de chaves estrangeiras no banco, reverte o aplicativo da idosa para o modo local standalone e desliga imediatamente qualquer sincronização via RLS do Supabase.

### 🌐 W7.3 — Painel Cuidador Multi-Paciente

| Superfície | Status |
|-----------|--------|
| Mobile (Cuidador) | 🆕 Novo — dropdown multi-perfil na barra superior |
| PWA (Dashboard) | 🆕 Novo — dashboard desktop consolidado |

*   **App Nativo:** O app nativo do cuidador herda a navegação multi-perfil. Na barra superior, um menu dropdown permite à filha (ou cuidador profissional) alternar rapidamente entre a visão das agendas de seus múltiplos dependentes cadastrados.
*   **Painel Web Desktop:** Um dashboard otimizado para navegadores desktop que exibe indicadores consolidados de todos os pacientes assistidos em tempo real:
    *   Últimas doses tomadas e alarmes com atrasos.
    *   Status do saldo de estoque estimado de cada paciente.
    *   Gráficos simples e consolidados de progresso semanal.

### 👨‍⚕️ W7.4 — Médico Observador (Role Observer)

| Superfície | Status |
|-----------|--------|
| Mobile | ❌ N/A (médico usa desktop) |
| PWA | 🆕 Novo — dashboard read-only para médico |

*   **O que é:** Um médico que o paciente autoriza a acompanhar sua adesão em tempo real. **Leitura apenas** — não registra doses nem edita medicamentos.
*   **Vinculação:** O paciente (ou cuidador gestor) gera um link de convite com `role='observer'`. O médico acessa `dosiq.app/doctor/dashboard` (sem necessidade de instalar app).
*   **Dashboard:** Lista de pacientes vinculados, cada um mostrando: adesão 7d, último medicamento tomado, tendência de adesão.
*   **RLS:** Políticas de segurança filtram automaticamente: `role='observer'` → apenas SELECT, nunca INSERT/UPDATE/DELETE.

---

## 🔒 2. Modelo de Dados & Regras de Segurança (RLS)

A tabela de conexões e permissões no Supabase gerencia a consistência das operações.

```sql
-- Convites/códigos de setup temporários (TTL 72h, rate-limited)
CREATE TABLE caregiver_invites (
  code CHAR(6) PRIMARY KEY,
  caregiver_user_id UUID NOT NULL REFERENCES auth.users(id),
  patient_profile_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  CONSTRAINT max_attempts CHECK (attempts <= 5)
);

-- Tabela principal de vínculos ativos
CREATE TABLE caregiver_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  caregiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'manager' CHECK (role IN ('manager', 'observer')),
  notification_channel TEXT DEFAULT 'whatsapp' CHECK (notification_channel IN ('whatsapp', 'telegram', 'both', 'none')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(patient_id, caregiver_id)
);
```

### Regras Críticas de RLS no Supabase
*   **Manager (Cuidador Gestor):** Permissão total de mutação (inserir tratamentos, alterar dosagem, registrar doses) sobre o ID do paciente vinculado.
*   **Observer (Médico):** Apenas SELECT em `protocols`, `medicines`, `dose_instances`, `medicine_logs`. Nenhuma mutação.
*   **Registro de Doses (`dose_logs` / `dose_instances`):** Permissão de inserção/atualização tanto pelo paciente (localmente) quanto pelo cuidador manager (remotamente). Dose registrada por cuidador tem `source='caregiver'`.
*   **Revogação:** A deleção da linha na tabela `caregiver_links` bloqueia instantaneamente todas as consultas subsequentes ao banco por RLS, sem cache residual de credenciais.

---

# FASE 7B — WhatsApp Bot via Meta Cloud API

> **Executabilidade por agentes:** ⚠️ Parcial — bloqueada por Meta Business verification (ação humana).  
> **Prerequisito:** Fase 7A concluída + Meta Business verification aprovada (ver §Prerequisitos).  
> **Enquanto aguarda:** Manter Telegram como canal primário de bot (já operacional em produção).

## 3. Motor de Alertas Híbrido (WhatsApp & Telegram)

Para proteger o limite gratuito de 1.000 conversas mensais na Meta Cloud API, os alertas do WhatsApp funcionam como uma **camada de contingência secundária**.

```
  08:00 - Dose Programada
            │
            ▼
  [ ALARME NATIVO PERSISTENTE no Celular do Paciente ] (AlarmManager/Critical Alerts)
            │
            ├─► Check-in em 15 min? ──► [ FIM ]
            │
            ▼ (Não tomado)
  [ Alarme Sonoro Repetitivo (Nagging) ] (Grátis, Ilimitado)
            │
            ├─► Check-in em 15 min? ──► [ FIM ]
            │
            ▼ (Não tomado após 30 min)
  [ Disparo do Webhook do Backend ]
            │
            ▼
  [ Notifica Cuidadora no WhatsApp/Telegram ] (Consome cota do Bot)
  "Atenção: Dona Maria ainda não tomou a Losartana das 08:00. Deseja lembrá-la?"
```

### 🤖 W7.5 — WhatsApp Bot via Meta Cloud API
*   **Adapter Pattern:** Refatoração de `tasks.js` no backend para herdar a interface `INotificationChannel`. Criação do `WhatsAppAdapter` que mapeia mensagens recebidas e converte para a sintaxe do WhatsApp Business API.
*   **Conformidade de Janelas:** Alertas automáticos utilizam templates pré-aprovados pela Meta fora da janela de 24h. Interações abertas só ocorrem após o cuidador responder ativamente ao bot.

### 📋 W7.6 — Templates WhatsApp para Pré-Aprovação Meta

Cada template deve ser submetido para aprovação pela Meta **antes** de poder ser usado fora da janela de 24h:

| Template ID | Categoria | Texto | Variáveis |
|------------|-----------|-------|-----------|
| `dose_atrasada` | UTILITY | "Olá {{1}}! {{2}} ainda não registrou o medicamento {{3}} agendado para as {{4}}. Que tal dar uma ligadinha?" | cuidador_nome, paciente_nome, medicamento, horario |
| `estoque_critico` | UTILITY | "Atenção {{1}}: o estoque de {{2}} de {{3}} acaba em {{4}} dias." | cuidador_nome, medicamento, paciente_nome, dias |
| `digest_semanal` | UTILITY | "📊 Resumo semanal de {{1}}: adesão {{2}}% ({{3}}/{{4}} doses). {{5}}" | paciente_nome, percentual, tomadas, total, observacao |
| `receita_vencendo` | UTILITY | "Receita de {{1}} de {{2}} vence em {{3}} dias. Lembre de agendar renovação." | medicamento, paciente_nome, dias |

### 🔀 W7.7 — Roteador Unificado de Serverless (`api/webhooks.js`)

> **⚠️ Esta é uma refatoração significativa** — requer exec spec própria antes de implementar.

*   **O que é:** Agrupa os webhooks de entrada do Telegram e WhatsApp no mesmo endpoint físico para economizar slots da Vercel (limite 12 functions).
*   **Arquitetura:** O arquivo direciona as requisições internamente para os respectivos adaptadores da pasta `api/_adapters/`.
*   **Impacto:** Toca no endpoint `api/telegram.js` existente (em produção), por isso precisa de migração cuidadosa com feature flag.
*   **Exec Spec necessária:** Definir roteamento por header/path, rollback plan, feature flag para toggle entre endpoint antigo e novo.

---

## 📋 Qualidade & Critérios de Aceitação (QA Gates)

### Fase 7A
*   **Gate G1 (QR Code):** O módulo de leitura do QR Code usando a câmera do dispositivo deve inicializar e decodificar chaves criptográficas em < 600ms em aparelhos Android de teste (API 24).
*   **Gate G2 (Core):** A lógica de geração e validação de tokens temporários deve viver puramente em `@dosiq/core/repositories/createCaregiverRepository.js`.
*   **Gate G3 (Dashboard Web):** O Painel Web do cuidador deve renderizar dados em tempo real utilizando SWR, invalidando caches adjacentes após mutações de posologia feitas pela filha.
*   **Gate G4 (Observer RLS):** Médico com `role='observer'` NÃO consegue fazer INSERT/UPDATE/DELETE em nenhuma tabela. Testar com RLS ativo.
*   **Gate G5 (Multi-paciente):** Cuidador com 3+ pacientes consegue alternar perfis e ver dados isolados entre pacientes.

### Fase 7B
*   **Gate G6 (Adapter):** WhatsAppAdapter implementa `INotificationChannel` e é testável com mock do Meta Cloud API.
*   **Gate G7 (Templates):** Todos os templates listados em §W7.6 estão pré-aprovados pela Meta antes de ir para produção.
*   **Gate G8 (Cota):** Implementar counter de conversas mensais com alert quando atingir 80% da cota (800/1000).

---

*Backlog unificado de comunicação e suporte familiar - Dosiq 2026.*  
*Versão 1.1 — Separação 7A/7B, Meta Business checklist, médico observador, templates WhatsApp.*
