# Fase 5 & 6 — Paridade Clínica & Além (Dosiq 2026)

> **Versão:** 1.1 — Revisão de 30/05/2026  
> **Changelog v1.0→v1.1:** P56-01 (tags de superfície [PORTAR]/[NOVO]), P56-02 (ref spec deeplink), P56-03 (ref R-111→R-114), P56-04 (expo-file-system no mobile), P56-05 (dependência dose_instances refactor).

> [!IMPORTANT]
> **Decommission do Expo Go (Ambiente Nativo de Builds):** Como o projeto utiliza dependências nativas (notificações locais persistentes, firebase, etc.), o app não é compatível com o Expo Go padrão. Todos os testes locais e desenvolvimento no mobile devem ser gerados e validados exclusivamente por meio de Builds de Desenvolvimento nativas (`rtk expo run:android` ou `rtk expo run:ios`).

Este documento especifica os requisitos de implementação para as **Fases 5 e 6**, focando em fechar a paridade de valor clínico entre o aplicativo nativo e a plataforma web de forma otimizada, introduzindo ferramentas analíticas, exportação segura e portabilidade médica.

> **⚠️ Dependência Crítica:** As features de adesão desta fase dependem da conclusão da [Fase 3 do refactor dose_instances](../dose_instances_refactor/EXEC_SPECS_PHASE_3.md) — que migra cálculos de adesão de `medicine_logs` (inferência) para `dose_instances` (materializado). `isProtocolFollowed`, `calculateAdherenceStats` e `getCurrentStreak` passarão a ler `dose_instances` com tolerância dinâmica por instância (`tolerance_minutes`).

---

## 1. Fase 5 — Analíticas & Histórico (Mobile-Led)

O objetivo desta fase é trazer as ferramentas de visualização de dados de saúde para o dispositivo móvel, utilizando agregação local eficiente e cache SWR.

### 📱 M1.1 — Histórico de Doses do Paciente

| Superfície | Status |
|-----------|--------|
| Mobile | 🆕 Novo — criar calendário + lista cronológica |
| PWA | ✅ Já existe — calendário em `AdherenceCalendar.jsx` (parcial, aguarda refactor Fase 3) |

*   **Interface:** Calendário compacto expansível em linha na Home do app ou em aba dedicada. Cada dia exibe uma coluna clicável com altura/largura ≥ 60px para fácil manipulação por idosos.
*   **Visualização:** Exibe lista cronológica de medicamentos tomados, perdidos e pendentes com chips coloridos de fácil assimilação visual. **Dados virão de `dose_instances`** (status: `taken`, `missed`, `pending`, `skipped_user`, `skipped_paused`).
*   **Ações:** Clicar em um registro de dose abre uma modal/sheet nativa permitindo:
    *   Registrar retroativamente (se o paciente esqueceu de marcar).
    *   Excluir/reverter um registro de dose tomado por engano.
    *   *Constraint:* Operações de mutação usam `useMutation()` do Form Kit com invalidação imediata do cache de aderência diária.

### 📱 M1.2 — Dashboard de Aderência Expandida

| Superfície | Status |
|-----------|--------|
| Mobile | 🆕 Novo — criar dashboard com ring gauge, sparkline e heatmap |
| PWA | ✅ Já existe — dashboard parcial com ring gauge básico |

*   **Visão Geral:** Substitui o indicador básico por filtros rápidos de 7, 30 e 90 dias.
*   **Elementos Visuais:**
    *   **Ring Gauge Hero:** Anel dinâmico colorido de adesão agregada.
    *   **Sparkline/Line Chart:** Gráfico de linha leve da evolução da adesão ao longo das semanas.
    *   **Heatmap Temporal:** Matriz simplificada mostrando taxas de adesão por período do dia (Manhã, Tarde, Noite, Madrugada) e dias da semana para detecção de padrões de esquecimento.
*   **Performance:** A computação deve ser realizada puramente no *client-side* sobre o cache de dados local (`cachedAdherenceService`), respeitando as regras **R-111 a R-114** (validadas no ROADMAP_v4):
    *   **R-111:** Adesão calculada client-side, zero network para dados já em cache.
    *   **R-112:** Cálculos timezone-sensitive usam `parseLocalDate()`, nunca `new Date('YYYY-MM-DD')`.
    *   **R-113:** Streak calculado sobre `dose_instances.status`, não inferência de logs.
    *   **R-114:** Invalidação de cache imediata após mutation de dose.

### 🌐 M1.3 — Modo Consulta (Visualização da Ficha Médica)

| Superfície | Status |
|-----------|--------|
| Mobile | 🆕 Novo — criar tela full-screen de alta legibilidade |
| PWA | 🔄 Refatorar — adaptar ficha existente para formato de consulta |

*   **O que faz:** Cria uma tela limpa, de alta legibilidade, com contraste aumentado (Design Acessível), pensada para o paciente mostrar ao médico durante a consulta presencial.
*   **Conteúdo:** Abas simples agrupadas:
    1.  **Medicamentos Ativos:** Lista com dosagem e posologia detalhada.
    2.  **Histórico de Doses:** Resumo dos últimos 30 dias.
    3.  **Aderência:** Ring gauge e indicadores de tendências.
    4.  **Estoque:** Status dos insumos e data prevista para reposição.
*   **Divergência de UX:**
    *   No **Mobile**: Modo full-screen travado em orientação retrato com botão de "Share Nativo" (usa o módulo nativo `Share` do React Native para enviar como texto/link).
    *   Na **Web**: Link temporário seguro (`dosiq.app/consult/patient_id?key=xxx`) gerado com token de acesso de leitura de 24h, permitindo ao médico abrir diretamente na tela de seu computador da clínica.

---

## 2. Fase 6 — Funcionalidades Avançadas & Emergência

Esta fase resolve a portabilidade médica física, segurança e conformidade de dados através de integrações híbridas web/mobile.

```
            [ Celular do Paciente ]   ── Gerencia chaves ──> [ Supabase DB ]
                      │                                             │
               Gera QR Code físico                                  │
                      │                                             │
                      ▼                                             ▼
            [ Cartão de Emergência ] ── Escaneado ──> [ Página Web Pública ]
            - Carteira / Pulseira                     - Exibe Alergias e Contatos
            - Custo zero de impressão                 - RLS bloqueia dados de rotina
```

### 🌐 F6.1 — Cartão de Emergência QR Code Público

| Superfície | Status |
|-----------|--------|
| Mobile | 🆕 Novo — gerar QR Code + ativar/desativar cartão |
| PWA | ✅ Já existe — cartão de emergência offline (`EmergencyCard`) |
| Web Pública | 🆕 Novo — página pública leve para socorristas |

*   **Cenário de Uso:** Em uma situação de acidente ou emergência, o socorrista (ou médico socorrista) escaneia um QR Code físico impresso no chaveiro, pulseira ou carteira do paciente.
*   **Implementação Técnica:**
    *   O QR Code aponta para uma rota web pública e extremamente leve: `dosiq.app/emergency/patient_id?auth_token=xxx`.
    *   Esta página abre de forma **instantânea** (sem requisições de auth pesadas, sem necessidade de login, bundle size < 50kB).
    *   Exibe dados estritamente críticos de emergência (Alergias conhecidas, Tipo sanguíneo, Contatos de emergência do cuidador primário, Medicamentos que não podem ser interrompidos ou que possuem alta contraindicação - ex: anticoagulantes).
    *   **Nota:** Spec de deep link universal **já existe** em [EXEC_SPEC_DEEPLINK_UNIVERSAL_LINKS_WEB_BANNER.md](../backlog-native_app/EXEC_SPEC_DEEPLINK_UNIVERSAL_LINKS_WEB_BANNER.md) — reutilizar para o esquema de roteamento.
*   **Segurança (LGPD):** A rota pública é protegida por uma chave de autenticação dinâmica salva em `profiles.emergency_token`. Se o paciente trocar de token ou revogar o cartão no app nativo, a URL pública antiga retorna imediatamente erro "404 - Acesso Revogado", apagando a exposição.
*   **Contrato de Dados Zod (Schema):** Toda a estruturação e validação do Cartão de Emergência deve seguir rigorosamente a regra **R-021** (Zod 4). O schema deve ser implementado no pacote core e exportado sob `@dosiq/core/schemas/emergencyProfileSchema.js`:
    ```javascript
    import { z } from 'zod';

    export const emergencyProfileSchema = z.object({
      patient_id: z.string().uuid(),
      emergency_token: z.string().length(32), // MD5/Hex token de acesso dinâmico
      blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).nullable(),
      known_allergies: z.string().max(1000, 'Limite de 1000 caracteres para alergias').default('Nenhuma declarada'),
      critical_conditions: z.string().max(1000, 'Limite de 1000 caracteres para condições clínicas').nullable(),
      emergency_contacts: z.array(z.object({
        name: z.string().min(2, 'Nome do contato inválido').max(100),
        phone: z.string().min(10, 'Telefone inválido (mínimo 10 dígitos)').max(20),
        relationship: z.string().max(50).default('Familiar')
      })).min(1, 'É obrigatório ter pelo menos 1 contato de emergência'),
      critical_medicines: z.array(z.object({
        medicine_name: z.string().min(1).max(200),
        dosage: z.string().max(100).nullable(),
        contraindication_alert: z.string().max(500, 'Alerta de contraindicação muito longo').nullable()
      })).default([])
    });
    ```

### 🌐 F6.2 — Geração de PDF Médico

| Superfície | Status |
|-----------|--------|
| Mobile | 🆕 Novo — implementar via `expo-print` |
| PWA | ✅ Já existe — `jsPDF` + `jspdf-autotable` (lazy-loaded, AP-B03) |

*   **O que faz:** Gera um relatório médico em PDF completo, estilizado em padrão clínico institucional para impressão ou envio por e-mail/WhatsApp para equipes de saúde.
*   **Diferenciação Tecnológica:**
    *   No **PWA/Web**: Utiliza a biblioteca `jsPDF` + `jspdf-autotable` encapsulada em *lazy-loading* dinâmico (**AP-B03 / D0**) para não impactar o carregamento do bundle principal. **✅ Já existe e funcional.**
    *   No **Native App**: Utiliza o *Print API* nativo do dispositivo (`expo-print`) que gera o PDF a partir de uma marcação HTML inline minimalista e estilizada, compartilhando o mesmo design visual do relatório web. **🆕 Portar — esforço ~3 SP.**

### 🌐 F6.3 — Exportação Completa de Dados (Conformidade LGPD)

| Superfície | Status |
|-----------|--------|
| Mobile | 🆕 Novo — usar `expo-file-system` + `expo-sharing` |
| PWA | ✅ Já existe — export CSV/JSON via `Blob` + `URL.createObjectURL()` |

*   **Interface:** Aba *Configurações > Privacidade e Dados* no App Nativo e Web.
*   **Ação:** Abre uma modal com caixas de seleção (*Checkboxes*):
    *   [ ] Perfil & Configurações.
    *   [ ] Histórico Completo de Doses (Logs).
    *   [ ] Lista de Medicamentos & Tratamentos.
    *   [ ] Histórico de Estoque & Compras.
*   **Formato de Saída:** O usuário pode escolher baixar os dados estruturados em **JSON** ou **CSV** compactados. O processamento é inteiramente realizado no cliente para não gerar sobrecarga no servidor Supabase gratuito.
*   **Implementação por Plataforma:**
    *   **PWA:** `Blob` + `URL.createObjectURL()` + `<a download>`. **✅ Já existe.**
    *   **Mobile:** `expo-file-system` para escrever arquivo em diretório temporário + `expo-sharing` para compartilhar via sheet nativo (AirDrop, WhatsApp, email). **NÃO usar `Blob` do browser — não funciona em React Native.** 🆕 Portar — esforço ~3 SP.

---

## 📋 Qualidade & Critérios de Aceitação (QA Gates)

*   **Gate G1 (Cópia/Mobile):** As telas de histórico e aderência em linha devem registrar taxa de quadros (FPS) estável ≥ 55fps nos simuladores iOS e Android de teste.
*   **Gate G2 (Extração Core):** A modelagem lógica de dados do Cartão de Emergência e exportação LGPD deve viver no `@dosiq/core/repositories/createEmergencyRepository.js`.
*   **Gate G3 (Adoção Web):** A página pública do Cartão de Emergência na web deve carregar em < 1 segundo no Lighthouse Mobile, com zero chamadas de autenticação do Supabase no first load.
*   **Gate G4 (dose_instances):** Nenhuma feature de adesão deve ler diretamente de `medicine_logs` para calcular scores. Todas devem usar `dose_instances` como fonte de verdade (pós-refactor Fase 3).

---

*Backlog unificado de paridade clínica - Dosiq 2026.*  
*Versão 1.1 — Revisão com tags de superfície, refs cruzadas e dependência dose_instances.*
