# Fase 5 & 6 — Paridade Clínica & Além (Dosiq 2026)

Este documento especifica os requisitos de implementação para as **Fases 5 e 6**, focando em fechar a paridade de valor clínico entre o aplicativo nativo e a plataforma web de forma otimizada, introduzindo ferramentas analíticas, exportação segura e portabilidade médica.

---

## 1. Fase 5 — Analíticas & Histórico (Mobile-Led)

O objetivo desta fase é trazer as ferramentas de visualização de dados de saúde para o dispositivo móvel, utilizando agregação local eficiente e cache SWR.

### 📱 M1.1 — Histórico de Doses do Paciente
*   **Interface:** Calendário compacto expansível em linha na Home do app ou em aba dedicada. Cada dia exibe uma coluna clicável com altura/largura ≥ 60px para fácil manipulação por idosos.
*   **Visualização:** Exibe lista cronológica de medicamentos tomados, perdidos e pendentes com chips coloridos de fácil assimilação visual.
*   **Ações:** Clicar em um registro de dose abre uma modal/sheet nativa permitindo:
    *   Registrar retroativamente (se o paciente esqueceu de marcar).
    *   Excluir/reverter um registro de dose tomado por engano.
    *   *Constraint:* Operações de mutação usam `useMutation()` do Form Kit com invalidação imediata do cache de aderência diária.

### 📱 M1.2 — Dashboard de Aderência Expandida
*   **Visão Geral:** Substitui o indicador básico por filtros rápidos de 7, 30 e 90 dias.
*   **Elementos Visuais:**
    *   **Ring Gauge Hero:** Anel dinâmico colorido de adesão agregada.
    *   **Sparkline/Line Chart:** Gráfico de linha leve da evolução da adesão ao longo das semanas.
    *   **Heatmap Temporal:** Matriz simplificada mostrando taxas de adesão por período do dia (Manhã, Tarde, Noite, Madrugada) e dias da semana para detecção de padrões de esquecimento.
*   **Performance:** A computação deve ser realizada puramente no *client-side* sobre o cache de dados local (`cachedAdherenceService`), respeitando as regras **R-111 a R-114** para evitar queries adicionais ao Supabase.

### 🌐 M1.3 — Modo Consulta (Visualização da Ficha Médica)
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
*   **Cenário de Uso:** Em uma situação de acidente ou emergência, o socorrista (ou médico socorrista) escaneia um QR Code físico impresso no chaveiro, pulseira ou carteira do paciente.
*   **Implementação Técnica:**
    *   O QR Code aponta para uma rota web pública e extremamente leve: `dosiq.app/emergency/patient_id?auth_token=xxx`.
    *   Esta página abre de forma **instantânea** (sem requisições de auth pesadas, sem necessidade de login, bundle size < 50kB).
    *   Exibe dados estritamente críticos de emergência (Alergias conhecidas, Tipo sanguíneo, Contatos de emergência do cuidador primário, Medicamentos que não podem ser interrompidos ou que possuem alta contraindicação - ex: anticoagulantes).
*   **Segurança (LGPD):** A rota pública é protegida por uma chave de autenticação dinâmica salva em `profiles.emergency_token`. Se o paciente trocar de token ou revogar o cartão no app nativo, a URL pública antiga retorna imediatamente erro "404 - Acesso Revogado", apagando a exposição.

### 🌐 F6.2 — Geração de PDF Médico
*   **O que faz:** Gera um relatório médico em PDF completo, estilizado em padrão clínico institucional para impressão ou envio por e-mail/WhatsApp para equipes de saúde.
*   **Diferenciação Tecnológica:**
    *   No **PWA/Web**: Utiliza a biblioteca `jsPDF` + `jspdf-autotable` encapsulada em *lazy-loading* dinâmico (**AP-B03 / D0**) para não impactar o carregamento do bundle principal.
    *   No **Native App**: Utiliza o *Print API* nativo do dispositivo (`expo-print`) que gera o PDF a partir de uma marcação HTML inline minimalista e estilizada, compartilhando o mesmo design visual do relatório web.

### 🌐 F6.3 — Exportação Completa de Dados (Conformidade LGPD)
*   **Interface:** Aba *Configurações > Privacidade e Dados* no App Nativo e Web.
*   **Ação:** Abre uma modal com caixas de seleção (*Checkboxes*):
    *   [ ] Perfil & Configurações.
    *   [ ] Histórico Completo de Doses (Logs).
    *   [ ] Lista de Medicamentos & Tratamentos.
    *   [ ] Histórico de Estoque & Compras.
*   **Formato de Saída:** O usuário pode escolher baixar os dados estruturados em **JSON** ou **CSV** compactados. O processamento é inteiramente realizado no cliente para não gerar sobrecarga no servidor Supabase gratuito.

---

## 📋 Qualidade & Critérios de Aceitação (QA Gates)

*   **Gate G1 (Cópia/Mobile):** As telas de histórico e aderência em linha devem registrar taxa de quadros (FPS) estável ≥ 55fps nos simuladores iOS e Android de teste.
*   **Gate G2 (Extração Core):** A modelagem lógica de dados do Cartão de Emergência e exportação LGPD deve viver no `@dosiq/core/repositories/createEmergencyRepository.js`.
*   **Gate G3 (Adoção Web):** A página pública do Cartão de Emergência na web deve carregar em < 1 segundo no Lighthouse Mobile, com zero chamadas de autenticação do Supabase no first load.

---

*Backlog unificado de paridade clínica - Dosiq 2026.*
