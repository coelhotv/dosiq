# PRD Fase 7: Voz, IA Aplicada e Expansão Internacional (Condicional)

**Versão:** 2.0
**Status:** DRAFT
**Data:** 21/02/2026
**Fase do Roadmap:** 7 de 7
**Baseline:** v2.8.1 + Fases 5, 5.5 e 6 concluídas
**Princípio:** Custo operacional R$ 0 (Voice + i18n + B2B) ou R$ 1-20/mês (Groq + OCR — condicionais)
**Condicional:** Ativação depende de gatilhos de validação

---

## 1. Visão Geral e Objetivos Estratégicos

A Fase 7 opera em dois modos simultâneos:

**Modo gratuito (V01-V02, L01-L04, B01-B02):** Features de voz, internacionalização e portal B2B que custam R$ 0 e podem ser ativadas assim que os gatilhos mínimos forem atingidos.

**Modo condicional (F7.1-F7.4):** IA, backup e OCR com custo variável (R$ 1-20/mês), ativados apenas com validação de base de usuários.

**Contexto acumulado das fases anteriores que potencializa a Fase 7:**
- Usuários têm meses de dados históricos → Groq chatbot tem contexto rico (medicamentos, aderência, histórico)
- WhatsApp Bot (F6.0) é o canal pelo qual o chatbot também responderá
- Heatmap de padrões e score de risco (Fase 5.5) → Voice interface pode narrar esses insights
- Portal Médico (B01) usa o mesmo modelo de compartilhamento do Modo Cuidador (F6.1)

### Gatilhos de Ativação

| Gatilho | Meta | Status |
|---------|------|--------|
| Usuários registrados | >= 100 | Pendente |
| Usuários ativos mensais | >= 50 | Pendente |
| Receita mensal potencial validada | >= R$ 500 | Pendente |
| Instalações PWA | >= 30% dos usuários mobile | Pendente |

**Regra:** Ativar features condicionais (F7.1-F7.4) quando pelo menos 2 dos 4 gatilhos forem atingidos. Features gratuitas (Voice, i18n, B2B) podem ser ativadas com apenas 1 gatilho atingido.

### Objetivos Estratégicos

| ID | Objetivo | Métrica Primária |
|----|----------|-----------------|
| OE7.1 | Oferecer registro de dose por voz (acessibilidade) | > 20% dos registros via voz em usuários 50+ |
| OE7.2 | Preparar internacionalização (PT-PT, ES, mercado LATAM) | App funcional em PT-PT e ES |
| OE7.3 | Criar canal B2B para profissionais de saúde | > 5% usuários compartilham com médico via portal |
| OE7.4 | Oferecer assistente IA para dúvidas sobre medicamentos | > 2 perguntas/dia/usuário ativo |
| OE7.5 | Garantir segurança de dados com backup criptografado | > 30% usuários com backup ativo |
| OE7.6 | Simplificar cadastro de medicamentos via OCR | > 80% acurácia na identificação |
| OE7.7 | Validar modelo de monetização | > 5% conversão freemium ou receita via B2B |

### Pré-requisitos

- ✅ Fase 6 concluída (WhatsApp Bot, Cuidador multi-canal, Multi-perfil)
- ✅ Fase 5.5 concluída (insights preditivos com dados históricos ricos)
- Gatilhos de ativação atingidos (ao menos 1 para features gratuitas, 2 para condicionais)
- Conta Groq API configurada (free tier: 30 req/min) — apenas para F7.4

---

## 2. Escopo de Features

### Grupo A — Gratuito (custo R$ 0, ativar com 1 gatilho)

| ID | Feature | Prioridade | Story Points | Novas Dependências |
|----|---------|------------|-------------|-------------------|
| **V01** | **Registro de Dose por Voz** | **P0** | **13** | **Nenhuma (Web Speech API nativa)** |
| **V02** | **Resumo de Doses por Voz** | **P1** | **5** | **Nenhuma (Web Speech Synthesis nativa)** |
| **L01** | **Arquitetura i18n (react-i18next)** | **P0** | **8** | **react-i18next (~30KB)** |
| **L02** | **Português Portugal (PT-PT)** | **P1** | **3** | **Nenhuma** |
| **L03** | **Espanhol (ES)** | **P1** | **5** | **Nenhuma** |
| **L04** | **Abstração de Base de Medicamentos por País** | **P2** | **8** | **Nenhuma** |
| **B01** | **Portal Médico/Farmacêutico (read-only)** | **P1** | **13** | **Nenhuma** |
| **B02** | **Integração Farmácia via Afiliação** | **P2** | **8** | **Nenhuma** |

**Esforço Grupo A:** 63 SP

### Grupo B — Condicional (custo R$ 1-20/mês, ativar com 2 gatilhos)

| ID | Feature | Prioridade | Story Points | Custo Estimado |
|----|---------|------------|-------------|---------------|
| F7.1 | Chatbot IA com Groq (multi-canal: web + WhatsApp) | P0 | 13 | R$ 0-5/mês (free tier) |
| F7.2 | Backup Automático Criptografado | P1 | 8 | R$ 0-5/mês (storage) |
| F7.3 | Notificações Avançadas Cuidador (relatório semanal) | P1 | 5 | R$ 0 (bot) |
| F7.4 | Importação via Foto OCR | P2 | 21 | R$ 0-10/mês (Tesseract.js) |

**Esforço Grupo B:** 47 SP
**Esforço Total Fase 7:** 110 SP

---

## 3. Descrição Detalhada — Grupo A (Gratuito)

### V01 Registro de Dose por Voz ⭐ NOVO

**Título:** Registro de dose via reconhecimento de voz (Web Speech API — custo zero)
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 7, V01

**Descrição:**
"Tomei meu remédio" → o app reconhece a fala, exibe os protocolos do horário atual para confirmação e registra a dose. Usa Web Speech API (nativa em todos os browsers modernos — Chrome, Safari 17+, Firefox), sem dependência de serviço externo, funciona offline com reconhecimento local em devices modernos.

**Por que é diferencial no mercado BR:**
- 40% dos usuários de apps de saúde no Brasil têm 50+ anos
- Interface por voz elimina 3-4 toques de precisão por um comando natural
- Nenhuma solução de saúde digital no Brasil oferece registro de dose por voz
- Acessibilidade real para usuários com dificuldade motora (~15M no Brasil)

**Fluxo de Interação:**

```
Usuário fala: "Tomei meu remédio"
  → Speech Recognition → texto transcrito
  → Parser: identifica intenção "registrar dose"
  → Mostra protocolos do horário atual (sem abrir teclado)
  → Usuário confirma por voz ("sim") ou toque
  → Dose registrada → feedback por voz: "Losartana registrada!"
```

**Frases suportadas (parser de intenção):**
- "Tomei meu remédio" / "Já tomei" / "Tomei agora"
- "Qual remédio preciso tomar?" → aciona V02
- "Quanto estoque tenho de [nome]?" → consulta estoque
- "Minha adesão essa semana" → lê o score em voz

**Requisitos Técnicos:**
- Hook `src/shared/hooks/useVoiceInput.js` (Speech Recognition API)
- Service `src/features/dashboard/services/voiceIntentParser.js` (regex + NLP simples)
- Componente `src/shared/components/ui/VoiceButton.jsx` (microfone FAB)
- Feature flag: desabilitado se browser não suporta (`'webkitSpeechRecognition' in window`)
- Graceful degradation: exibe mensagem "Voz não suportada" e mantém interface táctil

**Suporte por Browser:**

| Browser | Suporte | Nota |
|---------|---------|------|
| Chrome (Android/Desktop) | ✅ Pleno | Reconhecimento local desde Chrome 88 |
| Safari (iOS 17+) | ✅ Pleno | iOS 17 adicionou suporte |
| Safari (iOS < 17) | ⚠️ Limitado | Graceful degradation |
| Firefox | ⚠️ Limitado | API disponível mas menos robusta |

**Critérios de Aceitação:**
- [ ] Ativação via botão de microfone no dashboard (FAB acessível)
- [ ] Reconhece "Tomei meu remédio" com > 85% de precisão
- [ ] Exibe protocolos do horário atual para confirmação sem teclado
- [ ] Confirmação por voz ("sim"/"não") ou toque
- [ ] Feedback de voz ao registrar ("Losartana de 8h registrada")
- [ ] Feature flag: desativado graciosamente em browsers sem suporte
- [ ] Respeita `prefers-reduced-motion` (sem animações excessivas durante voz)
- [ ] LGPD: nenhum áudio enviado a servidores (processamento local)

**Dependências:** Nenhuma nova (Web Speech API nativa)
**Impacto Financeiro:** R$ 0

---

### V02 Resumo de Doses por Voz ⭐ NOVO

**Título:** Narração das próximas doses e status do dia por síntese de voz
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 7, V02

**Descrição:**
"Quais remédios ainda preciso tomar?" → síntese de voz lista as doses pendentes do dia. Usa Web Speech Synthesis API (nativa, zero custo). Complementa V01 — juntos formam uma interface hands-free completa.

**Frases de ativação:**
- "Quais remédios ainda preciso tomar?"
- "Meu próximo remédio é qual?"
- "Meu histórico de hoje"

**Resposta de voz (exemplo):**
> "Você ainda tem 2 doses para hoje: Metformina às 13h e Rivotril às 21h. Sua adesão hoje é de 67%. Bora caprichar!"

**Critérios de Aceitação:**
- [ ] Síntese de voz clara em português brasileiro
- [ ] Velocidade de fala ajustável (configuração do sistema respeitada)
- [ ] Botão de interrupção (parar narração)
- [ ] Funciona com app em segundo plano (notificação do sistema)

**Dependências:** V01 (hook useVoiceInput), Web Speech Synthesis (nativa)
**Impacto Financeiro:** R$ 0

---

### L01 Arquitetura i18n (react-i18next) ⭐ NOVO

**Título:** Scaffold de internacionalização para múltiplos idiomas sem reescrita
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 7, L01

**Descrição:**
Refatoração pontual para extrair todas as strings hardcoded para arquivos de locale. A estrutura do código não muda — apenas strings são externalizadas. Habilita PT-PT, ES e qualquer idioma futuro sem reescrita.

**Estratégia de migração:**
1. Instalar `react-i18next` e configurar
2. Criar `src/locales/pt-BR/` com todas as strings atuais (linha de base)
3. Usar `i18n.t('key')` nas strings identificadas (gradual, por feature)
4. Não quebrar nada — PT-BR continua idêntico

**Estrutura de locales:**
```
src/locales/
├── pt-BR/            ← baseline (extraído das strings atuais)
│   ├── common.json   ← botões, labels, ações genéricas
│   ├── dashboard.json
│   ├── medications.json
│   ├── protocols.json
│   ├── stock.json
│   ├── adherence.json
│   └── errors.json
├── pt-PT/            ← L02 (diferenças mínimas: "comprimido" vs "comprido", etc.)
└── es/               ← L03
```

**Critérios de Aceitação:**
- [ ] Zero regressão em PT-BR após migração
- [ ] Todas as strings da UI externalizadas para `pt-BR/`
- [ ] Strings de erro em português mantidas (já estavam corretas)
- [ ] `i18n.changeLanguage()` muda idioma instantaneamente sem reload
- [ ] Bundle de locale carregado sob demanda (lazy)

**Dependências:** react-i18next (~30KB)
**Impacto Financeiro:** R$ 0

---

### L02 Português Portugal (PT-PT) ⭐ NOVO

**Título:** Primeiro idioma adicional — Português de Portugal
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 7, L02

**Justificativa:** Portugal tem mercado de saúde digital subatendido. Zero adaptação de banco de dados (mesmo schema). ANVISA → INFARMED (Portugal) para interações medicamentosas.

**Diferenças PT-BR vs PT-PT (exemplos):**
- "comprimido" → "comprimido" (igual)
- "celular" → "telemóvel"
- "aplicativo" → "aplicação"
- "você" → "você/tu" (ajuste de tom)
- Unidades monetárias: R$ → €

**Critérios de Aceitação:**
- [ ] Arquivo `pt-PT/` com 100% das strings traduzidas
- [ ] Detecção automática por `navigator.language`
- [ ] Opção de seleção manual em Configurações
- [ ] Fuso horário: Europe/Lisbon suportado

**Dependências:** L01 (arquitetura i18n)
**Impacto Financeiro:** R$ 0

---

### L03 Espanhol (ES) ⭐ NOVO

**Título:** Espanhol para mercado LATAM e hispânicos nos EUA
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 7, L03

**Mercado potencial:**
- Chile, Argentina, Colômbia, México: ~100M de usuários potenciais
- US Hispanic market: ~60M pessoas, maior comunidade imigrante
- App stores em espanhol: mercado 5x maior que Brasil

**Escopo:** Espanhol neutro (LATAM) como primeira variante. ES-ES e ES-MX como variantes futuras.

**Critérios de Aceitação:**
- [ ] Arquivo `es/` com 100% das strings traduzidas
- [ ] Detecção automática por `navigator.language`
- [ ] Unidades monetárias: $ (neutro)
- [ ] Validações de data respeitam localização

**Dependências:** L01 (arquitetura i18n)
**Impacto Financeiro:** R$ 0

---

### L04 Abstração de Base de Medicamentos por País ⭐ NOVO

**Título:** Interface IDrugDatabase com adapters por país para interações medicamentosas
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 7, L04

**Descrição:**
A base de interações medicamentosas da Fase 5 (F5.6) foi construída sobre dados ANVISA (Brasil). Para expandir internacionalmente, é necessário abstrair a fonte de dados:

```javascript
// Interface
interface IDrugDatabase {
  checkInteractions(medications: string[]): Interaction[]
  getDrugInfo(name: string): DrugInfo | null
  searchDrug(query: string): DrugSuggestion[]
}

// Adapters
AnvisaAdapter implements IDrugDatabase  // Brasil (já existe)
InfarmedAdapter implements IDrugDatabase // Portugal
FDAAdapter implements IDrugDatabase      // EUA
EMAAdapter implements IDrugDatabase      // Europa
```

**Critérios de Aceitação:**
- [ ] `AnvisaAdapter` refatora a base existente sem regressão
- [ ] `InfarmedAdapter` para PT-PT com dados básicos
- [ ] Seleção automática do adapter pelo `navigator.language`
- [ ] Fallback para ANVISA se adapter do país não encontrado

**Dependências:** L01, F5.6 (interações existentes)
**Impacto Financeiro:** R$ 0

---

### B01 Portal Médico/Farmacêutico ⭐ NOVO

**Título:** Link read-only compartilhado com profissional de saúde (com consentimento LGPD)
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 7, B01

**Descrição:**
O paciente gera um link temporário (com expiração) para o médico ou farmacêutico visualizar seus dados clínicos em uma interface otimizada para profissionais: adesão histórica, protocolos, timeline de titulação, estoque. Sem necessidade de o profissional ter conta no app.

**Diferenciação vs Modo Cuidador (F6.1):**

| | Modo Cuidador | Portal Profissional |
|--|---|---|
| Quem usa | Familiar/amigo | Médico/Farmacêutico |
| Conta necessária | Sim | Não |
| Notificações | Sim (alertas de dose) | Não |
| Foco | Acompanhamento contínuo | Consulta pontual |
| Link | Permanente (revogável) | Temporário (expiração: 7/30 dias) |
| Interface | Dashboard adaptado | Visão clínica resumida |

**Requisitos Técnicos:**
- Endpoint `api/professional-view/:token` (sem autenticação, token de acesso)
- Token gerado com expiração: `token = jwt.sign({ userId, scope }, secret, { expiresIn: '7d' })`
- Página pública `src/views/ProfessionalView.jsx` (sem layout do app)
- Dados exibidos: adesão (gráfico), protocolos ativos, última dose, estoque, score de risco (Fase 5.5)
- LGPD: consentimento explícito ao gerar o link ("Você está compartilhando seus dados com um profissional")

**Potential Premium Feature:**
- Link básico (7 dias, 1 profissional): gratuito
- Link avançado (30 dias, múltiplos profissionais, histórico completo): Premium

**Critérios de Aceitação:**
- [ ] Link gerado com expiração configurável (7 ou 30 dias)
- [ ] Página pública funciona sem login
- [ ] Exibe: adesão, protocolos, estoque, score de risco (Fase 5.5)
- [ ] Consentimento explícito LGPD ao gerar (double opt-in)
- [ ] Link pode ser revogado a qualquer momento
- [ ] Não exibe dados sensíveis além dos clínicos (sem histórico de pagamentos, configurações)
- [ ] Validade visível na página: "Dados de [data] — válido até [data]"

**Dependências:** F5.1 (dados de relatório), Fase 5.5 (score de risco), F6.1 (modelo de compartilhamento)
**Impacto Financeiro:** R$ 0

---

### B02 Integração Farmácia via Afiliação ⭐ NOVO

**Título:** Link afiliado para farmácias quando estoque está crítico
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 7, B02

**Descrição:**
Quando o estoque de um medicamento está baixo (< 7 dias), o app exibe um CTA "Comprar em [Farmácia]" com link de afiliação para farmácias parceiras (Ultrafarma, Droga Raia, Drogasil). Modelo CPA (custo por aquisição) — zero custo de integração, receita variável.

**Implementação:** Deep links para busca pré-preenchida nas farmácias:
```
https://www.ultrafarma.com.br/busca?q=losartana+50mg&referral=meusremedios
```

**Critérios de Aceitação:**
- [ ] CTA aparece nos alertas de estoque baixo (SmartAlerts e StockAlertsWidget)
- [ ] Link abre a farmácia com busca pré-preenchida pelo nome do medicamento
- [ ] Mínimo 3 farmácias BR como opções
- [ ] Tracking de cliques via `analyticsService.js` existente (✅ F4.4)
- [ ] Desativável pelo usuário (configuração de privacidade)
- [ ] Zero coleta de dados de compra — apenas o clique é rastreado localmente

**Dependências:** analyticsService (✅ F4.4), SmartAlerts (✅ HCC)
**Impacto Financeiro:** R$ 0 (receita potencial via CPA)

---

## 4. Descrição Detalhada — Grupo B (Condicional)

### F7.1 Chatbot IA com Groq (multi-canal)

**Título:** Assistente IA para dúvidas sobre medicamentos via web e WhatsApp
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 7, C01

**Descrição:**
Chatbot integrado ao app web **e ao WhatsApp Bot** (F6.0) que responde dúvidas sobre medicamentos do usuário. Usa Groq API (LLaMA 3) com free tier (30 req/min). Contexto rico: inclui medicamentos cadastrados, adesão recente, insights preditivos da Fase 5.5.

**System Prompt Atualizado (com contexto da Fase 5.5):**

```
Você é um assistente de saúde do app Meus Remédios.

REGRAS OBRIGATÓRIAS:
1. SEMPRE inclua: "Esta informação não substitui orientação médica."
2. NUNCA recomende iniciar, parar ou alterar dosagem.
3. NUNCA faça diagnósticos.
4. Responda APENAS sobre os medicamentos listados abaixo.
5. Respostas em português brasileiro, linguagem acessível.

Contexto do usuário:
- Medicamentos: {medications_context}
- Adesão últimos 30d: {adherence_score}%
- Streak atual: {streak} dias
- Score de risco: {risk_score_context}  ← novo (Fase 5.5)
- Próxima reposição prevista: {refill_prediction}  ← novo (Fase 5.5)
```

**Canais:**
- Web: componente `src/features/dashboard/components/ChatInterface.jsx`, rota `#/assistente`
- WhatsApp: comando `/perguntar {texto}` ou `/p {texto}` via `WhatsAppAdapter` (F6.0)
- Telegram: comando `/perguntar {texto}` (já existente, adaptar)

**Critérios de Aceitação:**
- [ ] Chatbot responde em < 5s
- [ ] Disclaimer em TODAS as respostas
- [ ] Funciona via web, WhatsApp e Telegram
- [ ] Rate limit: 10 perguntas/hora/usuário
- [ ] Contexto inclui insights preditivos da Fase 5.5
- [ ] Feedback thumbs up/down por resposta
- [ ] Fallback gracioso se Groq API indisponível

**Exemplos de Interação com Contexto Fase 5.5:**

| Pergunta | Resposta com Contexto |
|----------|----------------------|
| "Posso tomar Losartana com café?" | "Sim, pode tomar com ou sem alimentos. Ps: vi que sua adesão está em 73% essa semana — tente tomar no mesmo horário do café da manhã para lembrar. Esta informação não substitui orientação médica." |

**Dependências:** Groq API, WhatsApp Bot (F6.0), Fase 5.5 (contexto)
**Impacto Financeiro:** R$ 0-5/mês (Groq free tier: 30 req/min, 14.4K tokens/min)

---

### F7.2 Backup Automático Criptografado

*(Conteúdo original preservado — sem mudanças de escopo)*

**Criptografia (Web Crypto API — nativa, zero dependências):**
- Derivação de chave: PBKDF2 (100.000 iterações, SHA-256)
- Criptografia: AES-256-GCM
- Salt único por backup (armazenado no header)
- Zero dependências externas

**Dados Incluídos no Backup:**
- Medicamentos, Protocolos, Histórico de doses (últimos 365 dias)
- Estoque, Perfis, Configurações, Rituais (localStorage)
- Insights preditivos cacheados (Fase 5.5) — *novo*

**Critérios de Aceitação:**
- [ ] Backup criptografado com AES-256-GCM
- [ ] Chave derivada com PBKDF2 (100K iterações)
- [ ] Restauração funcional com senha correta em outro dispositivo
- [ ] Auto-backup semanal (se habilitado)
- [ ] Tamanho do backup < 5MB
- [ ] Upload para Supabase Storage com RLS

**Dependências:** Supabase Storage (free tier: 1GB), Web Crypto API
**Impacto Financeiro:** R$ 0-5/mês

---

### F7.3 Notificações Avançadas Cuidador

**Título:** Relatórios semanais automáticos e alertas críticos para cuidadores
**Rastreabilidade:** Roadmap 2026 v3.2 - Fase 7, C04

**Descrição:**
Expande o Modo Cuidador (F6.1) com relatórios semanais automáticos. O cuidador recebe pelo canal configurado (WhatsApp ou Telegram — graças ao adapter pattern da F6.0) um resumo semanal da adesão do paciente.

**Relatório Semanal (via canal configurado do cuidador):**

```
📊 Relatório Semanal — [Nome do paciente]
Período: [data início] a [data fim]

Adesão Geral: [score]% | Streak: [streak] dias
Doses Tomadas: [tomadas]/[total]
⚠️ Estoque Crítico: [medicamentos com < 7 dias]
🎯 Risco de Abandono: [protocolos com score Crítico]  ← Fase 5.5

Detalhes por medicamento:
- Losartana 50mg: [score]% ([tomadas]/[total])
```

**Alertas Críticos:**

| Alerta | Condição | Canal |
|--------|----------|-------|
| Doses consecutivas perdidas | >= 3 doses seguidas | WhatsApp ou Telegram |
| Estoque zerado | Quantidade = 0 | WhatsApp ou Telegram |
| Protocolo em risco | Score Crítico por 3 dias (Fase 5.5) | WhatsApp ou Telegram |

**Critérios de Aceitação:**
- [ ] Relatório semanal enviado todo domingo às 9h pelo canal configurado
- [ ] Inclui score de risco da Fase 5.5 como dado novo
- [ ] Alerta crítico enviado em até 6h após condição
- [ ] Cuidador pode desativar relatório semanal independentemente
- [ ] Usa adapter pattern de F6.0 (Telegram ou WhatsApp conforme canal do cuidador)

**Dependências:** F6.1 (Modo Cuidador), WhatsApp Bot (F6.0), Fase 5.5 (score de risco)
**Impacto Financeiro:** R$ 0

---

### F7.4 Importação via Foto OCR

*(Conteúdo original preservado — sem mudanças de escopo)*

**Opção preferida: Tesseract.js client-side (custo R$ 0)**
- ~2MB worker, lazy loaded
- Modelo português (`por`)
- Processamento 100% no dispositivo

**Fluxo:**
```
[Câmera/Galeria] → [Pré-processamento (crop, contraste)]
  → [OCR (Tesseract.js)] → [Regex para extrair nome + dosagem]
  → [Fuzzy match com base ANVISA (~5.000 medicamentos)]
  → [Resultado para confirmação do usuário]
  → [Cadastro do medicamento]
```

**Critérios de Aceitação:**
- [ ] OCR identifica nome com > 80% acurácia
- [ ] OCR identifica dosagem com > 70% acurácia
- [ ] Resultado editável antes de confirmar
- [ ] Processamento < 8s (client-side)
- [ ] Fallback manual se OCR falhar
- [ ] LGPD: imagem nunca enviada ao servidor (Tesseract.js local)

**Dependências:** Tesseract.js (~2MB, lazy loaded)
**Impacto Financeiro:** R$ 0 (Tesseract.js) ou R$ 0-10/mês (API externa)

---

## 5. Modelo de Monetização

### 5.1 Freemium

| Tier | Preço | Features |
|------|-------|----------|
| Free | R$ 0 | Todas as features das Fases 1–6 + Voice + i18n |
| Premium | R$ 9,90/mês | Chatbot IA ilimitado, backup automático, OCR, Portal Profissional avançado (30 dias, múltiplos profissionais), suporte prioritário |
| Família | R$ 14,90/mês | Premium + até 5 perfis + Cuidador avançado |

### 5.2 Canal B2B (novo)

| Modelo | Implementação | Potencial |
|--------|--------------|-----------|
| Afiliação farmácias (B02) | CPA — zero custo de integração | R$ 1-50/mês dependendo do volume |
| Portal Profissional Premium (B01) | Plano Premium cobre link de 30 dias | Parte do tier Premium |
| White-label para clínicas | Não nesta fase — roadmap futuro | Fase 8+ |

### 5.3 Decisão

Freemium vs doação será decidido com base em dados de engajamento das Fases 3-6. Se DAU/MAU > 30%, freemium. Se moderado, doação via PIX.

---

## 6. Requisitos Não-Funcionais

| Requisito | Especificação | Métrica |
|-----------|--------------|---------|
| Performance | Resposta chatbot | < 5s |
| Performance | OCR client-side | < 8s |
| Performance | Voice recognition (V01) | < 2s para início de reconhecimento |
| Performance | Backup criptografia | < 3s para 5MB |
| Segurança | Criptografia backup | AES-256-GCM + PBKDF2 100K |
| Segurança | Groq API key | Server-side only (Vercel env) |
| Segurança | Portal Profissional | JWT com expiração, revogável |
| Privacidade | OCR | Zero upload de imagens (Tesseract local) |
| Privacidade | Voice | Nenhum áudio enviado a servidores |
| Privacidade | Chatbot | Histórico local only |
| Privacidade | Portal B2B | Consentimento LGPD explícito |
| Disponibilidade | Chatbot | Fallback gracioso se Groq indisponível |
| i18n | PT-PT e ES | 100% das strings cobertas |
| Regulatório | Chatbot | Disclaimer obrigatório, sem diagnósticos |

---

## 7. Plano de Testes

### 7.1 Testes Unitários (Vitest)

| Componente | Cenários |
|------------|----------|
| useVoiceInput | Reconhece "tomei meu remédio", graceful degradation, feature flag |
| voiceIntentParser | Parser de intenções, frases variadas, fora do escopo |
| i18n locale PT-BR | Zero strings faltando, 100% cobertura |
| i18n locale PT-PT | Diferenças BR→PT respeitadas |
| IDrugDatabase adapters | AnvisaAdapter, InfarmedAdapter — contrato respeitado |
| Portal Profissional | Token gerado, expiração, revogação |
| ChatInterface | Disclaimer presente, rate limit, contexto Fase 5.5 incluído |
| backupService | Criptografa, descriptografa, senha errada |

### 7.2 Testes de Integração

| Cenário | Validação |
|---------|-----------|
| Voice end-to-end | Fala → reconhecimento → confirmação → dose registrada |
| i18n switch | Muda idioma → toda UI atualiza instantaneamente |
| Portal Profissional | Gera link → médico acessa → vê dados corretos → link expira |
| Chatbot multi-canal | Pergunta via web e WhatsApp → resposta com disclaimer |
| Backup + restore cross-device | Cria → novo dispositivo → restaura com senha |
| OCR + cadastro | Foto → OCR → confirmação → medicamento cadastrado |
| F7.3 Cuidador semanal | Cron executa → cuidador recebe via WhatsApp |

### 7.3 Testes de Segurança

| Cenário | Validação |
|---------|-----------|
| Backup senha errada | Erro claro, sem dados parciais |
| Groq API key exposure | Key nunca exposta no client |
| Portal link expirado | Retorna 410 Gone após expiração |
| RLS backup storage | Usuário A não acessa backup de B |
| Voice — nenhum áudio enviado | Verificação de rede (DevTools) |

---

## 8. Indicadores de Sucesso

| KPI | Baseline | Meta | Ferramenta |
|-----|----------|------|------------|
| Registros de dose por voz | 0 | > 20% em usuários 50+ | Analytics local |
| App funcional em PT-PT | — | ✅ 100% strings traduzidas | i18n coverage |
| App funcional em ES | — | ✅ 100% strings traduzidas | i18n coverage |
| Portal Profissional usado | 0 | > 5% usuários | Analytics local |
| Uso chatbot | 0 | > 2 perguntas/dia/usuário | Supabase query |
| Satisfação chatbot | 0 | > 70% thumbs up | Analytics local |
| Backups ativos | 0 | > 30% usuários | Supabase Storage |
| OCR acurácia | 0 | > 80% nome, > 70% dosagem | Analytics local |
| Conversão freemium | 0 | > 5% | Stripe/Pix dashboard |
| Receita via afiliação (B02) | R$ 0 | Tracking de cliques | analyticsService |
| Custo operacional | R$ 0 | < R$ 20/mês | Groq + Supabase |

---

## 9. Riscos e Mitigações

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Web Speech API limitado em iOS < 17 | Alta | Médio | Feature flag, graceful degradation para input manual |
| Groq free tier descontinuado | Média | Alto | Alternativas: Cloudflare Workers AI (free), Ollama self-hosted |
| i18n retrofit causa regressão em PT-BR | Média | Alto | Migração gradual por feature, testes a cada commit |
| Portal Profissional mal usado (dados sem consentimento) | Baixa | Alto | Consentimento duplo, link com expiração curta, revogação |
| Tesseract.js lento em devices antigos | Alta | Médio | Timeout de 15s, fallback manual sempre disponível |
| Custo Groq excede R$ 20/mês | Baixa | Médio | Rate limiting agressivo, cache de respostas comuns |
| Regulatório: chatbot interpretado como conselho médico | Baixa | Crítico | Disclaimer em 100% das respostas, termos de uso claros |

---

## 10. Considerações LGPD e Regulatórias

### LGPD

| Feature | Tratamento |
|---------|-----------|
| Voice Interface | Nenhum áudio enviado a servidores — processamento local |
| Chatbot | Histórico local only, nenhum dado persistido no Groq |
| Backup | Criptografado com chave do usuário, servidor não tem acesso |
| OCR | Tesseract.js local — imagem nunca enviada |
| Portal Profissional | Consentimento explícito, link temporário, revogação a qualquer momento |
| Afiliação farmácias | Opt-out disponível, apenas clique rastreado (sem dados de compra) |

### Regulatório Saúde

| Feature | Tratamento |
|---------|-----------|
| Chatbot | NÃO é dispositivo médico, NÃO faz diagnóstico, disclaimer obrigatório |
| Portal Profissional | Dados informativos para profissional já habilitado — não é aconselhamento |
| Interações (L04) | Informativo apenas, fonte citada, recomendação de consultar médico |

---

## 11. Cronograma de Implementação

### Grupo A — Gratuito (assim que 1 gatilho atingido)

| Ordem | Feature | Dependência | SP |
|-------|---------|-------------|-----|
| 1 | L01 Arquitetura i18n | react-i18next | 8 |
| 2 | V01 Registro por Voz | Web Speech API (nativa) | 13 |
| 3 | V02 Resumo por Voz | V01 | 5 |
| 4 | L02 PT-PT | L01 | 3 |
| 5 | L03 Espanhol | L01 | 5 |
| 6 | B01 Portal Profissional | F5.5 (score risco), F6.1 (modelo) | 13 |
| 7 | B02 Afiliação Farmácias | analyticsService ✅ | 8 |
| 8 | L04 Drug DB Abstraction | L01, F5.6 | 8 |

### Grupo B — Condicional (2 gatilhos atingidos)

| Ordem | Feature | Dependência | SP |
|-------|---------|-------------|-----|
| 1 | F7.1 Chatbot Groq (multi-canal) | Groq API, WhatsApp Bot ✅ | 13 |
| 2 | F7.2 Backup Criptografado | Supabase Storage, Web Crypto | 8 |
| 3 | F7.3 Notificações Avançadas Cuidador | F6.1 ✅, WhatsApp Bot ✅ | 5 |
| 4 | F7.4 Importação OCR | Tesseract.js | 21 |

---

## 12. Definição de Pronto (DoD)

**Grupo A:**
- [ ] Voice interface com graceful degradation em iOS < 17
- [ ] Zero regressão em PT-BR após i18n retrofit
- [ ] PT-PT e ES com 100% de strings traduzidas
- [ ] Portal Profissional com consentimento LGPD e expiração
- [ ] Links de afiliação rastreados via analyticsService existente
- [ ] Testes críticos continuando passando

**Grupo B (adicional):**
- [ ] Chatbot com disclaimer em 100% das respostas
- [ ] Chatbot funcional via web e WhatsApp
- [ ] Backup criptografado funcional (criar + restaurar cross-device)
- [ ] OCR com > 80% acurácia em testes com 50 imagens
- [ ] Custo operacional monitorado e < R$ 20/mês
- [ ] Modelo de monetização definido e implementado

---

*Documento revisado em: 21/02/2026*
*Referência: Roadmap 2026 v3.2 - Fase 7*
*Baseline: v2.8.1 + Fases 5, 5.5 e 6*
*NOTA: Features do Grupo A (Voice, i18n, B2B) têm custo R$ 0 e podem ser ativadas com 1 gatilho. Features do Grupo B (IA, OCR, Backup) são condicionais a 2 gatilhos.*
*Próxima revisão: quando gatilhos de ativação forem atingidos*
