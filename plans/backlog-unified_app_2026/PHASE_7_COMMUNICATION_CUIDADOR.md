# Fase 7 — Comunicação Dual-Channel & Modo Cuidador (Dosiq 2026)

Este documento especifica a engenharia de software e UX para a **Fase 7**, focando na implementação do **Modo Cuidador** invertido, na ativação do bot do **WhatsApp via Meta Cloud API** integrado ao ecossistema existente do **Telegram**, e no gerenciamento de **Parceiros de Responsabilidade**.

---

## 1. O Novo "Modo Cuidador" (Iniciando no Cuidador)

Para anular a barreira de exclusão digital da terceira idade, a Cuidadora (Ana Paula) realiza todas as tarefas complexas de configuração de dados, deixando ao paciente (Dona Maria) apenas a visualização simplificada e as confirmações.

### 💻 W7.1 — Fluxo de Criação e Setup por QR Code (UX)
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
*   **App Nativo:** O app nativo do cuidador herda a navegação multi-perfil. Na barra superior, um menu dropdown permite à filha alternar rapidamente entre a visão das agendas de seus múltiplos dependentes cadastrados.
*   **Painel Web Desktop:** Um dashboard otimizado para navegadores desktop que exibe indicadores consolidados de todos os pacientes assistidos em tempo real:
    *   Últimas doses tomadas e alarmes com atrasos.
    *   Status do saldo de estoque estimado de cada paciente.
    *   Gráficos simples e consolidados de progresso semanal.

---

## 2. Motor de Alertas Híbrido (WhatsApp & Telegram)

Para proteger o limite gratuito de 1.000 conversas mensais na Meta Cloud API, os alertas do WhatsApp funcionam como uma **camada de contingência secundária**.

```
  08:00 - Dose Programada
            │
            ▼
  [ Push Nativo no Celular do Paciente ] (Grátis, Ilimitado)
            │
            ├─► Check-in em 15 min? ──► [ FIM ]
            │
            ▼ (Não tomado)
  [ Push Sonoro Repetitivo (Nagging) ] (Grátis, Ilimitado)
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

### 🤖 W7.4 — WhatsApp Bot via Meta Cloud API
*   **Adapter Pattern:** Refatoração de `tasks.js` no backend para herdar a interface `INotificationChannel`. Criação do `WhatsAppAdapter` que mapeia mensagens recebidas e converte para a sintaxe do WhatsApp Business API.
*   **Conformidade de Janelas:** Alertas automáticos utilizam templates pré-aprovados pela Meta fora da janela de 24h. Interações abertas só ocorrem após o cuidador responder ativamente ao bot.
*   **Roteador Unificado de Serverless (`api/webhooks.js`):**
    *   Agrupa os webhooks de entrada do Telegram e WhatsApp no mesmo endpoint físico para economizar slots da Vercel. O arquivo direciona as requisições internamente para os respectivos adaptadores da pasta `api/_adapters/`.

---

## 🔒 3. Modelo de Dados & Regras de Segurança (RLS)

A tabela de conexões e permissões no Supabase gerencia a consistência das operações.

```sql
-- Chave única garante que um paciente tem no máximo os mesmos cuidadores ativos
CREATE TABLE caregiver_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  caregiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notification_channel TEXT DEFAULT 'whatsapp' CHECK (notification_channel IN ('whatsapp', 'telegram', 'both', 'none')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(patient_id, caregiver_id)
);
```

### Regras Críticas de RLS no Supabase
*   **Escrita de Medicamentos (`protocols` / `medicines`):** O cuidador tem permissão total de mutação (inserir novos tratamentos, remover, alterar dosagem) sobre o ID do paciente vinculado.
*   **Registro de Doses (`dose_logs`):** Permissão de inserção/atualização tanto pelo paciente (localmente) quanto pelo cuidador (remotamente através do Painel Web ou bot ao receber o alerta de dose atrasada).
*   **Revogação:** A deleção da linha na tabela `caregiver_links` bloqueia instantaneamente todas as consultas subsequentes ao banco por RLS, sem cache residual de credenciais.

---

## 📋 Qualidade & Critérios de Aceitação (QA Gates)

*   **Gate G1 (Cópia/Mobile):** O módulo de leitura do QR Code usando a câmera do dispositivo deve inicializar e decodificar chaves criptográficas em < 600ms em aparelhos Android de teste (API 24).
*   **Gate G2 (Extração Core):** A lógica de geração e validação de tokens temporários deve viver puramente em `@dosiq/core/repositories/createCaregiverRepository.js`.
*   **Gate G3 (Adoção Web):** O Painel Web do cuidador deve renderizar dados em tempo real utilizando SWR, invalidando caches adjacentes após mutações de posologia feitas pela filha.

---

*Backlog unificado de comunicação e suporte familiar - Dosiq 2026.*
