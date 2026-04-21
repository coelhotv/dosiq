# Spec de Execucao — Fase 8: Experiencia Inteligente & Wow Factor

**Versao:** 1.1
**Data:** 20/03/2026 (atualizado 2026-03-20)
**Status:** 1/4 sprints entregues ✅ | 13/44 SP | Sprint 8.3 complete + 8.3.1 bugfix + 8.3.2 Telegram
**Baseline:** v3.4.0 (Fase 6 completa) → v4.1.0 (Fase 8 completa)
**Pendente:** 3 sprints (8.1, 8.2, 8.4)
**Escopo:** 44 SP | 4 features | 4 sprints sequenciais com paralelizacao parcial
**Referencias:** `PHASE_8_SPEC.md` (overview), `ROADMAP_v4.md` (timeline), `CLAUDE.md` (convencoes)

---

## 1. Contexto

A Fase 8 eleva a experiencia do paciente com **voz**, **IA conversacional** e **alertas de interacoes medicamentosas**. O foco nao e monetizacao — e entregar conveniencia e fator wow que tornam o app insubstituivel.

**Decisao estrategica:** Fase 7 (WhatsApp + Cuidador) foi adiada. Fase 8 segue diretamente apos Fase 6 (v3.4.0). Consequencias:
- F8.1 Chatbot: integra com web + Telegram apenas (sem WhatsApp por enquanto)
- Serverless budget: 6/12 usado → F8.1 usa 1 slot → 7/12 (5 slots restantes)
- Sem dependencias de Fase 7 — todas as features de Fase 8 sao self-contained

**Stack nova:**
- `groq-sdk` (~20KB, server-side only) — unica dependencia npm nova em toda a fase
- Web Speech API (nativa do browser, custo zero, sem dependencia)
- JSON estatico de interacoes (~30-50KB, lazy-loaded)

---

## 2. Regras Criticas para Fase 8 (suplementar a skill `deliver-sprint`)

**Antes de comecar cada sprint, agente DEVE invocar:**
```
/deliver-sprint plans/EXEC_SPEC_FASE_8.md
```

**Regras criticas adicionais (alem de CLAUDE.md + .memory/):**

1. **Lazy loading OBRIGATORIO (R-117, AP-B03):** Todos os novos componentes DEVEM ser `React.lazy()`. Nenhum e critico no first load. Isso inclui:
   - `ChatWindow`, `VoiceFAB`, `VoiceConfirmation`, `InteractionAlert`, `InteractionBadge`
   - `interactions.json` DEVE ser `import()` dinamico, NUNCA import estatico
   - `groq-sdk` so carrega server-side (serverless function)

2. **Barrel exports PROIBIDOS (AP-B04):** Nao re-exportar novos components/services em `@shared/services/index.js` ou barrels existentes. Import direto do arquivo fonte sempre.

3. **Auth: getCurrentUser() cacheado (R-128):** Chatbot precisa de contexto do usuario — usar `getCurrentUser()` (cacheado), nao `supabase.auth.getUser()` direto.

4. **Serverless budget (R-090, AP-S10):** Antes de criar `api/chatbot.js`, verificar budget:
   ```bash
   find api -name "*.js" -not -path "*/_*" | wc -l
   ```
   Budget atual: 6/12. Apos F8.1: 7/12. Maximo permitido: 12.

5. **Graceful degradation:** Voz e chatbot sao features opcionais. Se browser nao suporta Web Speech API, botao de voz NAO aparece. Se Groq falha, chatbot mostra mensagem amigavel.

6. **Disclaimer medico OBRIGATORIO:** Toda interacao do chatbot DEVE incluir: "Nao substitui orientacao medica". Interacoes medicamentosas DEVEM incluir: "Base parcial — consulte seu farmaceutico".

7. **Bundle impact maximo:** +50KB total (lazy-loaded, sem impacto no main bundle). Lighthouse Performance DEVE permanecer >=90.

---

## 3. Grafo de Dependencias (Sprint → Sprint)

```
Sprint 8.1: V01 (Registro por Voz) — 13 SP
  ↓ (V02 estende V01)
Sprint 8.2: V02 (Resumo por Voz) — 5 SP
  ↓ (F8.1 pode paralelizar com 8.2)

Sprint 8.3: F8.1 (Chatbot IA) — 13 SP — INDEPENDENTE de 8.1/8.2
Sprint 8.4: F8.2 (ANVISA Interacoes) — 13 SP — INDEPENDENTE de 8.1/8.2/8.3

PARALELIZACAO SEGURA:
  8.1 → 8.2 (sequencial obrigatorio: V02 estende hooks de V01)
  8.3 e 8.4 sao independentes entre si e de 8.1/8.2

ORDEM SUGERIDA:
  Opcao A (sequencial): 8.1 → 8.2 → 8.3 → 8.4
  Opcao B (paralela):   8.1 → 8.2  |  8.3  |  8.4 (3 agentes apos 8.1)

TIMELINE COM PARALELIZACAO:
- Sprint 8.1: 4-6 horas (1 agente, Web Speech API + fuzzy match)
- Sprint 8.2: 2-3 horas (1 agente, estende 8.1)
- Sprint 8.3: 5-7 horas (1 agente, Groq API + serverless + UI)
- Sprint 8.4: 4-6 horas (1 agente, JSON seed + services + UI)
- Total sequencial: ~18 horas
- Total paralelo (8.3 e 8.4 apos 8.1): ~12 horas
```

---

## 3.5. Padroes Reutilizaveis

### Pattern A: Web Speech API — Feature Detection + Graceful Degradation
```javascript
// Hook wrapper que retorna null se browser nao suporta
export function useSpeechRecognition() {
  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  if (!isSupported) return { isSupported: false }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  // ... implementation
  return { isSupported: true, start, stop, transcript, isListening }
}

// Componente so renderiza se suportado
function VoiceFAB() {
  const { isSupported } = useSpeechRecognition()
  if (!isSupported) return null
  // ... render
}
```

### Pattern B: Lazy-loaded Feature com Dynamic Import
```javascript
// Em App.jsx ou parent component
const ChatWindow = lazy(() => import('@features/chatbot/components/ChatWindow'))

// No handler, dynamic import do service (nao top-level)
const handleSubmit = async () => {
  const { interactionService } = await import('@features/interactions/services/interactionService')
  const result = interactionService.check(medicines)
  // ...
}
```

### Pattern C: Chatbot — Context Building (dados do cache SWR)
```javascript
// contextBuilder.js — monta contexto do paciente para o LLM
export function buildPatientContext({ medicines, protocols, logs, stocks, adherence }) {
  return {
    medicamentos_ativos: medicines.map(m => ({
      nome: m.name,
      dosagem: `${m.dosage_per_pill}${m.dosage_unit}`,
    })),
    protocolos: protocols.filter(p => p.active).map(p => ({
      medicamento: medicines.find(m => m.id === p.medicine_id)?.name,
      frequencia: p.frequency,
      horarios: p.time_schedule,
    })),
    doses_hoje: logs.filter(l => isToday(l.taken_at)).length,
    adesao_7d: adherence?.adherence7d ?? null,
    // NUNCA incluir IDs, UUIDs ou dados desnecessarios
  }
}
```

### Pattern D: Safety Guard (Chatbot)
```javascript
// safetyGuard.js — filtros de seguranca
const BLOCKED_INTENTS = ['dosagem', 'diagnostico', 'substituir', 'parar de tomar']

export function validateUserMessage(message) {
  const lower = message.toLowerCase()
  for (const intent of BLOCKED_INTENTS) {
    if (lower.includes(intent)) {
      return {
        blocked: true,
        reason: 'Nao posso recomendar dosagens ou diagnosticos. Consulte seu medico.',
      }
    }
  }
  return { blocked: false }
}

export const SYSTEM_DISCLAIMER = 'Sou um assistente virtual. Nao substituo orientacao medica.'
```

---

## 4. Checklist Pre-Codigo (Phase 1 da skill deliver-sprint)

**Arquivos que SEMPRE existem (ler antes de cada sprint):**
- `src/shared/hooks/useCachedQuery.js` — `(key, fetcher, options) → { data, isLoading, error, refetch }`
- `src/utils/dateUtils.js` — `parseLocalDate()`, `formatLocalDate()`, `daysDifference()`
- `src/features/dashboard/services/insightService.js` — Como gerar alerts
- `src/App.jsx` — Padrao de lazy loading + Suspense
- `vite.config.js` — manualChunks existentes

**Verificacoes por sprint (Phase 1 da skill — Explore Codebase):**

### Sprint 8.1 (V01 — Registro por Voz)
- [ ] Web Speech API: `window.SpeechRecognition || window.webkitSpeechRecognition` — suporte atual em Chrome, Safari, Edge?
- [ ] Lista de medicamentos ativos: qual service/hook ja retorna isso? (`useCachedQuery('medicines', ...)`)
- [ ] LogForm / registerDose: qual e a interface para registrar dose programaticamente?
- [ ] Dashboard.jsx ou App.jsx: onde posicionar o VoiceFAB? (canto inferior direito, acima do BottomNav?)
- [ ] `useDoseZones()` ja existe? Onde? (para V02 no sprint 8.2)

### Sprint 8.2 (V02 — Resumo por Voz)
- [ ] `useDoseZones()`: retorno exato (zones, pending, completed)?
- [ ] Web Speech Synthesis: `window.speechSynthesis` — suporte em pt-BR?
- [ ] VoiceFAB ja criado no Sprint 8.1? Estender com nova intencao

### Sprint 8.3 (F8.1 — Chatbot IA)
- [ ] Serverless budget: `find api -name "*.js" -not -path "*/_*" | wc -l` (deve ser <= 11)
- [ ] Groq API: modelo a usar (`llama-3.3-70b-versatile` ou `mixtral-8x7b-32768`)?
- [ ] `getCurrentUser()` cacheado: onde esta? (`src/shared/utils/supabase.js`?)
- [ ] Telegram bot: como integrar mensagens de chatbot? (`server/bot/commands/` pattern)
- [ ] Header do app: existe espaco para botao de chat? Ou usar drawer/modal?

### Sprint 8.4 (F8.2 — Interacoes ANVISA)
- [ ] `medicineDatabase.json`: estrutura (`name`, `activeIngredient`, `therapeuticClass`) — campo `activeIngredient` permite matching de interacoes
- [ ] MedicineForm.jsx: onde interceptar o submit para verificar interacoes?
- [ ] SmartAlert pattern: como exibir alertas? (`insightService` types existentes)
- [ ] Modo Consulta / PDF: onde adicionar secao de interacoes?

---

## 5. Sprint 8.1 — Registro de Dose por Voz (13 SP)

### V01: Web Speech API + Fuzzy Match + Registro

| Campo | Valor |
|-------|-------|
| **Criar** | `src/features/voice/hooks/useSpeechRecognition.js` |
| **Criar** | `src/features/voice/hooks/useVoiceCommand.js` |
| **Criar** | `src/features/voice/components/VoiceFAB.jsx` |
| **Criar** | `src/features/voice/components/VoiceConfirmation.jsx` |
| **Testar** | `src/features/voice/__tests__/useVoiceCommand.test.js` |
| **Testar** | `src/features/voice/__tests__/VoiceFAB.test.js` |
| **Modificar** | `src/App.jsx` (adicionar VoiceFAB lazy-loaded) |
| **Modificar** | `vite.config.js` (opcional: adicionar `feature-voice` chunk) |
| **Dependencias npm** | Nenhuma nova. Web Speech API e nativa do browser |

#### 5.1. useSpeechRecognition.js

```javascript
// src/features/voice/hooks/useSpeechRecognition.js

import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Hook wrapper para Web Speech API com feature detection.
 * Retorna isSupported=false se browser nao suporta.
 *
 * @param {Object} options
 * @param {string} options.lang - Idioma (default: 'pt-BR')
 * @param {boolean} options.continuous - Reconhecimento continuo (default: false)
 * @param {Function} options.onResult - Callback com transcricao final
 * @param {Function} options.onError - Callback com erro
 * @returns {{
 *   isSupported: boolean,
 *   isListening: boolean,
 *   transcript: string,
 *   interimTranscript: string,
 *   start: () => void,
 *   stop: () => void,
 *   error: string|null
 * }}
 */
export function useSpeechRecognition({
  lang = 'pt-BR',
  continuous = false,
  onResult,
  onError,
} = {}) {
  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (!isSupported) return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = lang
    recognition.continuous = continuous
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      if (final) {
        setTranscript(final)
        onResult?.(final)
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (event) => {
      const errorMsg = event.error === 'not-allowed'
        ? 'Permissao de microfone negada'
        : event.error === 'no-speech'
          ? 'Nenhuma fala detectada'
          : `Erro: ${event.error}`
      setError(errorMsg)
      setIsListening(false)
      onError?.(errorMsg)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      recognition.abort()
    }
  }, [isSupported, lang, continuous]) // onResult/onError excluidos para estabilidade

  const start = useCallback(() => {
    if (!recognitionRef.current) return
    setError(null)
    setTranscript('')
    setInterimTranscript('')
    recognitionRef.current.start()
    setIsListening(true)
  }, [])

  const stop = useCallback(() => {
    if (!recognitionRef.current) return
    recognitionRef.current.stop()
    setIsListening(false)
  }, [])

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    start,
    stop,
    error,
  }
}
```

#### 5.2. useVoiceCommand.js

```javascript
// src/features/voice/hooks/useVoiceCommand.js

/**
 * Parser de intencao + medicamento a partir de transcricao de voz.
 * Usa fuzzy match contra lista de medicamentos ativos do paciente.
 *
 * Intencoes suportadas:
 * - REGISTRAR_DOSE: "tomei", "tomar", "registrar", "dose"
 * - CONSULTAR_PENDENTES: "o que falta", "pendente", "falta tomar" (usado no Sprint 8.2)
 *
 * @param {Array} activeMedicines - Lista de medicamentos ativos [{id, name}]
 * @returns {{
 *   parseCommand: (transcript: string) => {
 *     intent: 'REGISTRAR_DOSE'|'CONSULTAR_PENDENTES'|'DESCONHECIDO',
 *     medicine: {id, name, confidence}|null,
 *     matches: Array<{id, name, confidence}>,
 *     raw: string
 *   }
 * }}
 */
export function useVoiceCommand(activeMedicines = []) {
  const parseCommand = (transcript) => {
    const normalized = transcript.toLowerCase().trim()
    const raw = transcript

    // 1. Detectar intencao
    const intent = detectIntent(normalized)

    // 2. Se REGISTRAR_DOSE, buscar medicamento por fuzzy match
    if (intent === 'REGISTRAR_DOSE') {
      const matches = findMedicineMatches(normalized, activeMedicines)
      return {
        intent,
        medicine: matches.length === 1 ? matches[0] : null,
        matches,
        raw,
      }
    }

    return { intent, medicine: null, matches: [], raw }
  }

  return { parseCommand }
}

// -- Funcoes internas --

const REGISTER_KEYWORDS = ['tomei', 'tomar', 'registrar', 'dose', 'tomando']
const QUERY_KEYWORDS = ['o que falta', 'pendente', 'falta tomar', 'que remedio', 'quais remedios']

function detectIntent(text) {
  if (QUERY_KEYWORDS.some(kw => text.includes(kw))) return 'CONSULTAR_PENDENTES'
  if (REGISTER_KEYWORDS.some(kw => text.includes(kw))) return 'REGISTRAR_DOSE'
  return 'DESCONHECIDO'
}

/**
 * Fuzzy match de nome de medicamento na transcricao.
 * Algoritmo: substring match + distancia de Levenshtein simplificada.
 *
 * @param {string} text - Transcricao normalizada
 * @param {Array} medicines - [{id, name}]
 * @returns {Array<{id, name, confidence: number}>} - Ordenado por confidence DESC
 */
function findMedicineMatches(text, medicines) {
  return medicines
    .map(med => {
      const medName = med.name.toLowerCase()
      let confidence = 0

      // Match exato do nome no texto
      if (text.includes(medName)) {
        confidence = 1.0
      }
      // Match parcial (primeiras 4+ letras)
      else if (medName.length >= 4 && text.includes(medName.slice(0, 4))) {
        confidence = 0.7
      }
      // Match por palavras individuais do nome
      else {
        const medWords = medName.split(/\s+/)
        const matchedWords = medWords.filter(w => w.length >= 3 && text.includes(w))
        if (matchedWords.length > 0) {
          confidence = 0.5 * (matchedWords.length / medWords.length)
        }
      }

      return confidence > 0 ? { id: med.id, name: med.name, confidence } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence)
}
```

#### 5.3. VoiceFAB.jsx

```jsx
// src/features/voice/components/VoiceFAB.jsx

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useVoiceCommand } from '../hooks/useVoiceCommand'

/**
 * Botao flutuante de microfone para registro de dose por voz.
 * Graceful degradation: nao renderiza se browser nao suporta Web Speech API.
 *
 * @param {Object} props
 * @param {Array} props.activeMedicines - [{id, name}]
 * @param {Function} props.onRegisterDose - (medicineId, dosage) => Promise<void>
 * @param {Function} props.onRequestPending - () => void (para V02 Sprint 8.2)
 */
export default function VoiceFAB({ activeMedicines, onRegisterDose, onRequestPending }) {
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [parsedCommand, setParsedCommand] = useState(null)

  const { parseCommand } = useVoiceCommand(activeMedicines)

  const handleResult = useCallback((transcript) => {
    const command = parseCommand(transcript)

    switch (command.intent) {
      case 'REGISTRAR_DOSE':
        if (command.medicine) {
          setParsedCommand(command)
          setShowConfirmation(true)
        } else if (command.matches.length > 1) {
          // Multiplos matches — mostrar opcoes
          setParsedCommand(command)
          setShowConfirmation(true)
        } else {
          // Nenhum match
          setParsedCommand({ ...command, error: 'Nao identifiquei o medicamento' })
          setShowConfirmation(true)
        }
        break
      case 'CONSULTAR_PENDENTES':
        onRequestPending?.()
        break
      default:
        setParsedCommand({
          intent: 'DESCONHECIDO',
          error: 'Nao entendi. Diga "tomei [nome do remedio]"',
          raw: transcript,
        })
        setShowConfirmation(true)
    }
  }, [parseCommand, onRequestPending])

  const {
    isSupported,
    isListening,
    interimTranscript,
    start,
    stop,
    error,
  } = useSpeechRecognition({ onResult: handleResult })

  // Graceful degradation
  if (!isSupported) return null

  const handleConfirm = async (medicineId) => {
    await onRegisterDose?.(medicineId)
    setShowConfirmation(false)
    setParsedCommand(null)
    // Feedback haptico
    if (navigator.vibrate) navigator.vibrate(100)
  }

  const handleDismiss = () => {
    setShowConfirmation(false)
    setParsedCommand(null)
  }

  return (
    <>
      {/* FAB button */}
      <motion.button
        className="voice-fab"
        onClick={isListening ? stop : start}
        whileTap={{ scale: 0.9 }}
        animate={isListening ? { scale: [1, 1.1, 1] } : {}}
        transition={isListening ? { repeat: Infinity, duration: 1.5 } : {}}
        aria-label={isListening ? 'Parar gravacao' : 'Registrar dose por voz'}
        style={{
          position: 'fixed',
          bottom: '80px', // Acima do BottomNav
          right: '16px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          border: 'none',
          background: isListening
            ? 'var(--color-error, #ef4444)'
            : 'var(--color-primary, #3b82f6)',
          color: 'white',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isListening ? '⏹' : '🎤'}
      </motion.button>

      {/* Interim transcript */}
      <AnimatePresence>
        {isListening && interimTranscript && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed',
              bottom: '145px',
              right: '16px',
              background: 'var(--color-surface, #1e1e1e)',
              color: 'var(--color-text, #fff)',
              padding: '8px 16px',
              borderRadius: '12px',
              fontSize: '14px',
              maxWidth: '250px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              zIndex: 1000,
            }}
          >
            {interimTranscript}...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast */}
      {error && (
        <div style={{
          position: 'fixed',
          bottom: '145px',
          right: '16px',
          background: 'var(--color-error, #ef4444)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          zIndex: 1000,
        }}>
          {error}
        </div>
      )}

      {/* Confirmation modal — lazy import no Sprint final */}
      {showConfirmation && parsedCommand && (
        <VoiceConfirmationInline
          command={parsedCommand}
          onConfirm={handleConfirm}
          onDismiss={handleDismiss}
        />
      )}
    </>
  )
}

/**
 * Inline confirmation (pode ser extraido para VoiceConfirmation.jsx).
 * Mostra o resultado do parsing e pede confirmacao.
 */
function VoiceConfirmationInline({ command, onConfirm, onDismiss }) {
  if (command.error) {
    return (
      <div className="voice-confirmation-overlay" onClick={onDismiss} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
      }}>
        <div style={{
          background: 'var(--color-surface, #1e1e1e)', borderRadius: '16px',
          padding: '24px', maxWidth: '300px', textAlign: 'center',
          color: 'var(--color-text, #fff)',
        }} onClick={e => e.stopPropagation()}>
          <p style={{ marginBottom: '16px' }}>{command.error}</p>
          <p style={{ fontSize: '12px', opacity: 0.7 }}>Voce disse: "{command.raw}"</p>
          <button onClick={onDismiss} style={{
            marginTop: '16px', padding: '8px 24px', borderRadius: '8px',
            border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer',
          }}>
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (command.medicine) {
    return (
      <div className="voice-confirmation-overlay" onClick={onDismiss} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
      }}>
        <div style={{
          background: 'var(--color-surface, #1e1e1e)', borderRadius: '16px',
          padding: '24px', maxWidth: '300px', textAlign: 'center',
          color: 'var(--color-text, #fff)',
        }} onClick={e => e.stopPropagation()}>
          <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            Registrar dose?
          </p>
          <p style={{ fontSize: '16px', marginBottom: '16px' }}>
            {command.medicine.name}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={onDismiss} style={{
              padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-text)', cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button onClick={() => onConfirm(command.medicine.id)} style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none',
              background: 'var(--color-success, #22c55e)', color: 'white', cursor: 'pointer',
            }}>
              Confirmar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Multiplos matches
  if (command.matches.length > 1) {
    return (
      <div className="voice-confirmation-overlay" onClick={onDismiss} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
      }}>
        <div style={{
          background: 'var(--color-surface, #1e1e1e)', borderRadius: '16px',
          padding: '24px', maxWidth: '300px',
          color: 'var(--color-text, #fff)',
        }} onClick={e => e.stopPropagation()}>
          <p style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', textAlign: 'center' }}>
            Qual medicamento?
          </p>
          {command.matches.slice(0, 5).map(match => (
            <button
              key={match.id}
              onClick={() => onConfirm(match.id)}
              style={{
                display: 'block', width: '100%', padding: '12px',
                marginBottom: '8px', borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'transparent', color: 'var(--color-text)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              {match.name}
            </button>
          ))}
          <button onClick={onDismiss} style={{
            display: 'block', width: '100%', padding: '10px',
            marginTop: '8px', borderRadius: '8px', border: 'none',
            background: 'var(--color-error)', color: 'white', cursor: 'pointer',
          }}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return null
}
```

#### 5.4. Integracao no App.jsx

```jsx
// Adicionar ao App.jsx — lazy-loaded
const VoiceFAB = lazy(() => import('@features/voice/components/VoiceFAB'))

// No render, APOS autenticacao:
{user && (
  <Suspense fallback={null}>
    <VoiceFAB
      activeMedicines={medicines}
      onRegisterDose={handleVoiceRegisterDose}
      onRequestPending={handleVoicePending}
    />
  </Suspense>
)}
```

> **NOTA:** O VoiceFAB usa `fallback={null}` (nao ViewSkeleton) porque e um FAB flutuante, nao uma view. Nao precisa de skeleton.

#### 5.5. Cenarios de Teste

```javascript
describe('useVoiceCommand', () => {
  const medicines = [
    { id: '1', name: 'Losartana' },
    { id: '2', name: 'Metformina' },
    { id: '3', name: 'Losartana Potassica' },
  ]

  afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

  describe('detectIntent', () => {
    it('detecta REGISTRAR_DOSE com "tomei"', () => {})
    it('detecta REGISTRAR_DOSE com "tomar"', () => {})
    it('detecta CONSULTAR_PENDENTES com "o que falta"', () => {})
    it('retorna DESCONHECIDO para texto generico', () => {})
  })

  describe('findMedicineMatches', () => {
    it('match exato: "tomei losartana" → confidence 1.0', () => {})
    it('match parcial: "tomei losar" → confidence 0.7', () => {})
    it('match multiplo: "tomei losartana" com Losartana + Losartana Potassica', () => {})
    it('nenhum match: "tomei aspirina" → matches vazio', () => {})
    it('case insensitive: "TOMEI LOSARTANA"', () => {})
  })

  describe('parseCommand', () => {
    it('retorna medicine quando match unico', () => {})
    it('retorna matches[] quando multiplos', () => {})
    it('retorna intent DESCONHECIDO sem keywords', () => {})
  })
})

describe('VoiceFAB', () => {
  afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

  it('nao renderiza quando Web Speech API nao suportada', () => {})
  it('renderiza botao de microfone quando suportada', () => {})
  it('muda visual quando escutando', () => {})
  it('mostra confirmacao com match unico', () => {})
  it('mostra lista quando multiplos matches', () => {})
  it('mostra erro quando nenhum match', () => {})
  it('chama onRegisterDose ao confirmar', () => {})
  it('dispara haptic feedback ao confirmar', () => {})
})
```

### Quality Gate Sprint 8.1

- [ ] `useSpeechRecognition.js` criado com feature detection
- [ ] `useVoiceCommand.js` criado com fuzzy match + intencoes
- [ ] `VoiceFAB.jsx` criado com graceful degradation
- [ ] `VoiceConfirmation` funcional (inline ou componente separado)
- [ ] VoiceFAB lazy-loaded no App.jsx com `fallback={null}`
- [ ] Testes >= 90% cobertura para useVoiceCommand
- [ ] Web Speech API mockada nos testes (window.SpeechRecognition)
- [ ] Zero dependencias npm novas
- [ ] `npm run validate:agent` passa
- [ ] Botao de voz NAO aparece em browser sem suporte
- [ ] Botao de voz funciona em Chrome/Edge desktop (para demo/teste)
- [ ] Branch: `feature/fase-8/sprint-1-voice-register`
- [ ] Bundle: main bundle nao aumenta (VoiceFAB e lazy-loaded)

---

## 6. Sprint 8.2 — Resumo de Doses por Voz (5 SP)

### V02: Speech Synthesis + Integracao com useDoseZones

| Campo | Valor |
|-------|-------|
| **Criar** | `src/features/voice/hooks/useVoiceSummary.js` |
| **Modificar** | `src/features/voice/components/VoiceFAB.jsx` (adicionar handler de pendentes) |
| **Testar** | `src/features/voice/__tests__/useVoiceSummary.test.js` |
| **Dependencias** | Sprint 8.1 (V01) — usa hooks de voz ja criados |

#### 6.1. useVoiceSummary.js

```javascript
// src/features/voice/hooks/useVoiceSummary.js

import { useCallback, useRef } from 'react'

/**
 * Hook para sintese de voz — le em voz alta o resumo de doses pendentes.
 * Usa Web Speech Synthesis API (nativa, custo zero).
 *
 * @param {Object} options
 * @param {string} options.lang - Idioma (default: 'pt-BR')
 * @returns {{
 *   isSupported: boolean,
 *   isSpeaking: boolean,
 *   speak: (text: string) => void,
 *   stop: () => void,
 *   speakPendingDoses: (pendingDoses: Array<{name, time}>) => void,
 *   speakAllDone: () => void
 * }}
 */
export function useVoiceSummary({ lang = 'pt-BR' } = {}) {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const utteranceRef = useRef(null)

  const speak = useCallback((text) => {
    if (!isSupported) return
    // Cancelar fala anterior
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.9 // Levemente mais lento para clareza

    // Selecionar voz pt-BR se disponivel
    const voices = window.speechSynthesis.getVoices()
    const ptVoice = voices.find(v => v.lang.startsWith('pt'))
    if (ptVoice) utterance.voice = ptVoice

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [isSupported, lang])

  const stop = useCallback(() => {
    if (!isSupported) return
    window.speechSynthesis.cancel()
  }, [isSupported])

  /**
   * Monta e fala o texto com doses pendentes.
   * @param {Array<{name: string, time: string}>} pendingDoses
   */
  const speakPendingDoses = useCallback((pendingDoses) => {
    if (pendingDoses.length === 0) {
      speak('Parabens! Voce ja tomou todos os medicamentos de hoje.')
      return
    }

    const doseList = pendingDoses
      .map(d => `${d.name} as ${d.time}`)
      .join(', e ')

    const text = pendingDoses.length === 1
      ? `Voce ainda precisa tomar ${doseList}.`
      : `Voce ainda precisa tomar ${doseList}.`

    speak(text)
  }, [speak])

  const speakAllDone = useCallback(() => {
    speak('Parabens! Voce ja tomou todos os medicamentos de hoje.')
  }, [speak])

  return {
    isSupported,
    isSpeaking: isSupported && window.speechSynthesis?.speaking,
    speak,
    stop,
    speakPendingDoses,
    speakAllDone,
  }
}
```

#### 6.2. Integracao no VoiceFAB

```javascript
// Adicionar ao VoiceFAB.jsx — handler para CONSULTAR_PENDENTES

import { useVoiceSummary } from '../hooks/useVoiceSummary'

// Dentro do VoiceFAB:
const { speakPendingDoses } = useVoiceSummary()

// No onRequestPending callback (recebido via props):
const handleRequestPending = useCallback(() => {
  // pendingDoses vem do useDoseZones() no componente pai
  if (onRequestPending) {
    const pending = onRequestPending() // Retorna [{name, time}]
    speakPendingDoses(pending)
  }
}, [onRequestPending, speakPendingDoses])
```

#### 6.3. Cenarios de Teste

```javascript
describe('useVoiceSummary', () => {
  afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

  it('retorna isSupported=false sem speechSynthesis', () => {})
  it('fala texto em pt-BR', () => {})
  it('seleciona voz pt-BR quando disponivel', () => {})
  it('monta texto com 1 dose pendente', () => {})
  it('monta texto com multiplas doses pendentes', () => {})
  it('fala "parabens" quando tudo tomado', () => {})
  it('cancela fala anterior ao iniciar nova', () => {})
})
```

### Quality Gate Sprint 8.2

- [ ] `useVoiceSummary.js` criado com Speech Synthesis API
- [ ] VoiceFAB atualizado com handler de pendentes
- [ ] Integrado com `useDoseZones()` no componente pai
- [ ] Testes >= 90% cobertura
- [ ] Fala funciona em pt-BR (Chrome/Edge desktop)
- [ ] Graceful degradation quando speechSynthesis indisponivel
- [ ] `npm run validate:agent` passa
- [ ] Branch: `feature/fase-8/sprint-2-voice-summary`

---

## 7. Sprint 8.3 — Chatbot IA Multi-Canal (13 SP)

### F8.1: Groq API + Context Builder + Safety Guard + Chat UI

| Campo | Valor |
|-------|-------|
| **Criar** | `src/features/chatbot/services/chatbotService.js` |
| **Criar** | `src/features/chatbot/services/contextBuilder.js` |
| **Criar** | `src/features/chatbot/services/safetyGuard.js` |
| **Criar** | `src/features/chatbot/components/ChatWindow.jsx` |
| **Criar** | `src/features/chatbot/components/ChatMessage.jsx` |
| **Criar** | `src/features/chatbot/components/ChatInput.jsx` |
| **Criar** | `api/chatbot.js` (serverless function — 1 slot) |
| **Testar** | `src/features/chatbot/__tests__/contextBuilder.test.js` |
| **Testar** | `src/features/chatbot/__tests__/safetyGuard.test.js` |
| **Testar** | `src/features/chatbot/__tests__/chatbotService.test.js` |
| **Modificar** | `src/App.jsx` (adicionar ChatWindow lazy-loaded) |
| **Dependencias npm** | `groq-sdk` (~20KB, server-side only) |

> ⚠️ **VERIFICAR BUDGET SERVERLESS ANTES DE CRIAR `api/chatbot.js`:**
> ```bash
> find api -name "*.js" -not -path "*/_*" | wc -l
> ```
> Resultado esperado: 6. Apos criar: 7/12. Se >= 12, consolidar em router existente.

#### 7.1. contextBuilder.js

```javascript
// src/features/chatbot/services/contextBuilder.js

import { parseLocalDate } from '@utils/dateUtils'

/**
 * Monta contexto compacto do paciente para enviar ao LLM.
 * Dados vem do cache SWR — ZERO chamadas ao Supabase.
 *
 * REGRAS:
 * - NUNCA incluir IDs, UUIDs, ou dados que identifiquem o usuario
 * - NUNCA incluir dados de outros usuarios
 * - Manter o contexto compacto (<2000 tokens) para nao estourar free tier
 *
 * @param {Object} params
 * @param {Array} params.medicines - Medicamentos ativos
 * @param {Array} params.protocols - Protocolos ativos
 * @param {Array} params.logs - Logs do dia
 * @param {Array} params.stocks - Estoque atual
 * @param {Object} params.adherence - Resumo de adesao (7d)
 * @returns {string} - Contexto formatado para system prompt
 */
export function buildPatientContext({ medicines, protocols, logs, stocks, adherence }) {
  const today = new Date()
  const todayStr = today.toLocaleDateString('pt-BR')

  const medsContext = medicines.map(med => {
    const protocol = protocols.find(p => p.medicine_id === med.id && p.active)
    const stock = stocks
      .filter(s => s.medicine_id === med.id)
      .reduce((sum, s) => sum + s.quantity, 0)

    return {
      nome: med.name,
      dosagem: `${med.dosage_per_pill ?? ''}${med.dosage_unit ?? ''}`.trim(),
      frequencia: protocol?.frequency ?? 'sem protocolo',
      horarios: protocol?.time_schedule ?? [],
      estoque: stock,
    }
  })

  const todayLogs = logs.filter(log => {
    const logDate = new Date(log.taken_at)
    return logDate.toDateString() === today.toDateString()
  })

  return [
    `Data: ${todayStr}`,
    `Medicamentos ativos: ${medsContext.length}`,
    ...medsContext.map(m =>
      `- ${m.nome} (${m.dosagem}): ${m.frequencia}, horarios ${m.horarios.join(', ') || 'nao definidos'}, estoque ${m.estoque} un.`
    ),
    `Doses registradas hoje: ${todayLogs.length}`,
    adherence?.adherence7d != null
      ? `Adesao ultimos 7 dias: ${Math.round(adherence.adherence7d)}%`
      : '',
  ].filter(Boolean).join('\n')
}

/**
 * System prompt para o LLM.
 */
export function buildSystemPrompt(patientContext) {
  return [
    'Voce e um assistente virtual do app Dosiq.',
    'Voce ajuda o paciente a gerenciar seus medicamentos de forma amigavel.',
    'REGRAS ABSOLUTAS:',
    '- NUNCA recomende dosagens, diagnosticos ou substituicoes de medicamentos.',
    '- NUNCA sugira parar ou alterar tratamento sem consultar o medico.',
    '- Sempre inclua: "Nao substituo orientacao medica." em respostas sobre saude.',
    '- Responda em portugues brasileiro, de forma concisa (max 3 frases).',
    '- Use os dados do paciente abaixo para contextualizar respostas.',
    '',
    'DADOS DO PACIENTE:',
    patientContext,
  ].join('\n')
}
```

#### 7.2. safetyGuard.js

```javascript
// src/features/chatbot/services/safetyGuard.js

/**
 * Filtros de seguranca para mensagens do chatbot.
 * Bloqueia intencoes perigosas e adiciona disclaimer.
 */

const BLOCKED_PATTERNS = [
  /qual\s+(dosagem|dose)\s+(devo|posso|preciso)/i,
  /posso\s+(parar|interromper|suspender)\s+de\s+tomar/i,
  /substituir\s+.+\s+por/i,
  /diagnostico|diagnosticar/i,
  /receitar|prescrever/i,
  /efeito\s+colateral\s+grave/i,
]

const DISCLAIMER = 'Não substituo orientação médica. Consulte seu médico para decisões sobre o seu tratamento.'

/**
 * Valida mensagem do usuario antes de enviar ao LLM.
 * @param {string} message
 * @returns {{ blocked: boolean, reason?: string }}
 */
export function validateUserMessage(message) {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(message)) {
      return {
        blocked: true,
        reason: 'Não posso recomendar dosagens, diagnósticos ou mudanças no tratamento. Consulte seu médico.',
      }
    }
  }

  if (message.length > 500) {
    return {
      blocked: true,
      reason: 'Mensagem muito longa. Tente ser mais conciso (máx 500 caracteres).',
    }
  }

  return { blocked: false }
}

/**
 * Adiciona disclaimer a resposta do LLM se necessario.
 * @param {string} response
 * @returns {string}
 */
export function addDisclaimerIfNeeded(response) {
  const healthKeywords = ['medicamento', 'remedio', 'dose', 'tratamento', 'saude', 'sintoma']
  const hasHealthContent = healthKeywords.some(kw => response.toLowerCase().includes(kw))

  if (hasHealthContent && !response.includes('Não substituo')) {
    return `${response}\n\n_${DISCLAIMER}_`
  }

  return response
}

export { DISCLAIMER }
```

#### 7.3. chatbotService.js (client-side)

```javascript
// src/features/chatbot/services/chatbotService.js

import { validateUserMessage, addDisclaimerIfNeeded } from './safetyGuard'
import { buildPatientContext, buildSystemPrompt } from './contextBuilder'

const MAX_HISTORY = 10 // Manter ultimas 10 mensagens para contexto
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hora
const RATE_LIMIT_MAX = 30

/**
 * Envia mensagem ao chatbot e retorna resposta.
 *
 * @param {Object} params
 * @param {string} params.message - Mensagem do usuario
 * @param {Array} params.history - Historico de mensagens [{role, content}]
 * @param {Object} params.patientData - Dados do paciente para contexto
 * @returns {Promise<{
 *   response: string,
 *   blocked: boolean,
 *   reason?: string,
 *   rateLimited: boolean
 * }>}
 */
export async function sendChatMessage({ message, history = [], patientData }) {
  // 1. Rate limiting (client-side)
  if (isRateLimited()) {
    return {
      response: '',
      blocked: false,
      rateLimited: true,
      reason: 'Limite de mensagens atingido. Tente novamente em alguns minutos.',
    }
  }

  // 2. Safety guard
  const validation = validateUserMessage(message)
  if (validation.blocked) {
    return {
      response: validation.reason,
      blocked: true,
      rateLimited: false,
    }
  }

  // 3. Build context
  const context = buildPatientContext(patientData)
  const systemPrompt = buildSystemPrompt(context)

  // 4. Enviar para serverless function
  try {
    const response = await fetch('/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: history.slice(-MAX_HISTORY),
        systemPrompt,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    const safeResponse = addDisclaimerIfNeeded(data.response)

    incrementRateCounter()

    return {
      response: safeResponse,
      blocked: false,
      rateLimited: false,
    }
  } catch (error) {
    return {
      response: 'Desculpe, estou com dificuldades tecnicas. Tente novamente em instantes.',
      blocked: false,
      rateLimited: false,
    }
  }
}

// -- Rate limiting (localStorage) --

function isRateLimited() {
  if (typeof window === 'undefined') return false
  try {
    const data = JSON.parse(localStorage.getItem('mr_chat_rate') || '{}')
    if (Date.now() - (data.windowStart || 0) > RATE_LIMIT_WINDOW) return false
    return (data.count || 0) >= RATE_LIMIT_MAX
  } catch {
    return false
  }
}

function incrementRateCounter() {
  if (typeof window === 'undefined') return
  try {
    const data = JSON.parse(localStorage.getItem('mr_chat_rate') || '{}')
    const now = Date.now()
    if (now - (data.windowStart || 0) > RATE_LIMIT_WINDOW) {
      localStorage.setItem('mr_chat_rate', JSON.stringify({ windowStart: now, count: 1 }))
    } else {
      localStorage.setItem('mr_chat_rate', JSON.stringify({
        windowStart: data.windowStart,
        count: (data.count || 0) + 1,
      }))
    }
  } catch {
    // Silently fail
  }
}
```

#### 7.4. api/chatbot.js (serverless function)

```javascript
// api/chatbot.js — Vercel serverless function para Groq API
// SLOT: 7/12 apos criacao

import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const MAX_TOKENS = 300

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validar API key
  if (!process.env.GROQ_API_KEY) {
    console.error('[chatbot] GROQ_API_KEY nao configurada')
    return res.status(500).json({ error: 'Chatbot nao configurado' })
  }

  try {
    const { message, history = [], systemPrompt } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem obrigatoria' })
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Mensagem muito longa (max 500 caracteres)' })
    }

    // Montar mensagens para Groq
    const messages = [
      { role: 'system', content: systemPrompt || 'Voce e um assistente de medicamentos.' },
      ...history.slice(-10).map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ]

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      top_p: 0.9,
    })

    const response = completion.choices[0]?.message?.content || 'Desculpe, nao consegui responder.'

    return res.status(200).json({
      response,
      model: MODEL,
      usage: completion.usage,
    })
  } catch (error) {
    console.error('[chatbot] Erro Groq:', error.message)

    if (error.status === 429) {
      return res.status(429).json({
        error: 'Limite de requisicoes atingido. Tente novamente em alguns segundos.',
      })
    }

    return res.status(500).json({
      error: 'Erro ao processar mensagem',
    })
  }
}
```

#### 7.5. ChatWindow.jsx (componente principal)

```jsx
// src/features/chatbot/components/ChatWindow.jsx

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sendChatMessage } from '../services/chatbotService'
import { DISCLAIMER } from '../services/safetyGuard'

/**
 * Drawer lateral de chat com o assistente IA.
 * Lazy-loaded — nao impacta main bundle.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Object} props.patientData - Dados do cache SWR
 */
export default function ChatWindow({ isOpen, onClose, patientData }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Ola! Sou seu assistente de medicamentos. Como posso ajudar?\n\n_Nao substituo orientacao medica._',
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const result = await sendChatMessage({
        message: userMessage,
        history: messages,
        patientData,
      })

      if (result.rateLimited) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.reason }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: result.response }])
      }
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, patientData])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Sugestoes rapidas
  const quickSuggestions = [
    'Tomei meu remedio hoje?',
    'Como esta minha adesao?',
    'Quando preciso repor estoque?',
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.5)', zIndex: 1100,
            }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed', top: 0, right: 0,
              width: '100%', maxWidth: '400px', height: '100%',
              background: 'var(--color-background, #0f0f0f)',
              display: 'flex', flexDirection: 'column',
              zIndex: 1101,
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px', borderBottom: '1px solid var(--color-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>
                Assistente
              </span>
              <button onClick={onClose} style={{
                background: 'none', border: 'none',
                color: 'var(--color-text)', fontSize: '20px', cursor: 'pointer',
              }}>
                ✕
              </button>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '16px',
              display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    background: msg.role === 'user'
                      ? 'var(--color-primary, #3b82f6)'
                      : 'var(--color-surface, #1e1e1e)',
                    color: 'var(--color-text, #fff)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    maxWidth: '85%',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              ))}

              {isLoading && (
                <div style={{
                  alignSelf: 'flex-start',
                  background: 'var(--color-surface)',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                }}>
                  Pensando...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick suggestions (quando poucas mensagens) */}
            {messages.length <= 2 && (
              <div style={{
                padding: '0 16px 8px',
                display: 'flex', gap: '8px', flexWrap: 'wrap',
              }}>
                {quickSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(suggestion); }}
                    style={{
                      padding: '6px 12px', borderRadius: '16px',
                      border: '1px solid var(--color-border)',
                      background: 'transparent', color: 'var(--color-text-secondary)',
                      fontSize: '12px', cursor: 'pointer',
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--color-border)',
              display: 'flex', gap: '8px',
            }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua pergunta..."
                disabled={isLoading}
                style={{
                  flex: 1, padding: '10px 14px',
                  borderRadius: '20px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: '14px', outline: 'none',
                }}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                style={{
                  padding: '10px 16px', borderRadius: '20px',
                  border: 'none', background: 'var(--color-primary)',
                  color: 'white', cursor: 'pointer',
                  opacity: isLoading || !input.trim() ? 0.5 : 1,
                }}
              >
                Enviar
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

#### 7.6. Integracao no App.jsx

```jsx
// Lazy load do ChatWindow
const ChatWindow = lazy(() => import('@features/chatbot/components/ChatWindow'))

// State no App ou Dashboard:
const [isChatOpen, setIsChatOpen] = useState(false)

// Botao no header ou FAB:
<button onClick={() => setIsChatOpen(true)}>💬</button>

// Render:
{isChatOpen && (
  <Suspense fallback={null}>
    <ChatWindow
      isOpen={isChatOpen}
      onClose={() => setIsChatOpen(false)}
      patientData={{ medicines, protocols, logs, stocks, adherence }}
    />
  </Suspense>
)}
```

#### 7.7. Integracao com Telegram (opcional neste sprint)

```javascript
// server/bot/commands/ — adicionar handler para mensagens de texto generico
// Se a mensagem nao e um comando conhecido (/start, /status, etc.),
// encaminhar para Groq via chatbotService server-side.
//
// ATENCAO: Requer GROQ_API_KEY como env var no server.
// Pode ser implementado como melhoria futura apos validar no web.
```

> **NOTA:** Integracao com Telegram pode ser um follow-up apos validar chatbot no web. Nao e bloqueante para este sprint.

#### 7.8. Cenarios de Teste

```javascript
describe('contextBuilder', () => {
  afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

  it('monta contexto com medicamentos ativos', () => {})
  it('inclui horarios do protocolo', () => {})
  it('inclui estoque atual', () => {})
  it('inclui adesao 7d quando disponivel', () => {})
  it('nao inclui IDs ou UUIDs', () => {})
  it('retorna string com menos de 2000 caracteres', () => {})
  it('lida com dados vazios (sem medicamentos)', () => {})
})

describe('safetyGuard', () => {
  afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

  describe('validateUserMessage', () => {
    it('bloqueia pergunta sobre dosagem', () => {})
    it('bloqueia pergunta sobre parar tratamento', () => {})
    it('bloqueia pergunta sobre substituicao', () => {})
    it('bloqueia mensagem > 500 caracteres', () => {})
    it('permite pergunta sobre adesao', () => {})
    it('permite pergunta sobre estoque', () => {})
    it('permite saudacao', () => {})
  })

  describe('addDisclaimerIfNeeded', () => {
    it('adiciona disclaimer quando resposta menciona medicamento', () => {})
    it('nao duplica disclaimer', () => {})
    it('nao adiciona disclaimer em resposta generica', () => {})
  })
})

describe('chatbotService', () => {
  afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

  it('retorna blocked=true para mensagem perigosa', () => {})
  it('retorna rateLimited=true apos 30 mensagens/hora', () => {})
  it('envia mensagem para /api/chatbot', () => {})
  it('adiciona disclaimer na resposta', () => {})
  it('lida com erro de rede gracefully', () => {})
  it('lida com HTTP 429 (rate limit Groq)', () => {})
  it('limita historico a 10 mensagens', () => {})
})
```

### Quality Gate Sprint 8.3

- [ ] `contextBuilder.js` criado sem incluir IDs/UUIDs
- [ ] `safetyGuard.js` bloqueia intencoes perigosas
- [ ] `chatbotService.js` com rate limiting client-side
- [ ] `api/chatbot.js` criado (verificar budget: <= 12 funcoes)
- [ ] `ChatWindow.jsx` com drawer lateral responsivo
- [ ] Disclaimer medico em toda interacao de saude
- [ ] ChatWindow lazy-loaded no App.jsx
- [ ] `npm install groq-sdk` (unica dependencia nova)
- [ ] `GROQ_API_KEY` documentada como env var necessaria
- [ ] Testes >= 90% cobertura (contextBuilder + safetyGuard + chatbotService)
- [ ] `npm run validate:agent` passa
- [ ] Quick suggestions funcionais
- [ ] Rate limit: 30 msg/hora/usuario
- [ ] Branch: `feature/fase-8/sprint-3-chatbot`
- [ ] Budget serverless: maximo 7/12 apos este sprint
- [ ] Rewrite em `vercel.json` adicionado ANTES do catch-all (R-040, AP-011)

---

## 7.9. Post-Delivery Bugfix: Hallucinations (Sprint 8.3.1)

**Data:** 2026-03-20 (mesmo dia da entrega)
**PR:** #408 | **Commit:** `1e47cfb`
**Problema:** LLM alucinava respostas farmacológicas (ex: "Selozok = Sertralina" em vez de "Metoprolol")

### Soluções Aplicadas

#### 1. Grounding com Contexto Farmacológico (Opção E)
- Adicionar `active_ingredient` + `therapeutic_class` ao contexto enviado ao LLM
- **Antes:** `- SeloZok (50mg): diario, ...`
- **Depois:** `- SeloZok [Succinato de Metoprolol, Betabloqueador] (50mg): diario, ...`
- Garantir `null` não expõe texto "null" no contexto (usar `filter(Boolean)`)

#### 2. Ajuste de Parâmetros (Temperature + Top_p)
```javascript
// api/chatbot.js linhas 57-58
temperature: 0.2,    // 0.7 → 0.2 (respostas factuais, menos aleatoriedade)
top_p: 1.0,          // 0.9 → 1.0 (desativar nucleus sampling)
```

#### 3. Modelo Inteligente
- Trocar para `groq/compound` (seleção automática de modelo conforme pedido)

### Files Modificados
- `api/chatbot.js` — parâmetros ajustados (linhas 57-58)
- `src/features/chatbot/services/contextBuilder.js` — incluir `principioAtivo` + `classeTerapeutica`
- `src/features/chatbot/__tests__/contextBuilder.test.js` — testes para campos novos
- `src/features/chatbot/__tests__/chatbotService.test.js` — corrigir localStorage mock (AP-T03)

### Quality Gates
- ✅ 33/33 testes passando
- ✅ Nenhum `null` ou `undefined` exposto no contexto
- ✅ localStorage mock corrigido
- ✅ Sem impacto em UX — mudanças internas

### Aprendizados
1. **Alucinação = falta de grounding + parâmetros altos:** restricoes no prompt sozinhas não impedem o LLM de inventar. Precisa de contexto factual + temperatura conservadora.
2. **Dados já existiam no BD:** `active_ingredient` + `therapeutic_class` estavam nas medicines — só não estavam sendo enviados ao LLM.
3. **Temperature é crítico em medical chatbots:** 0.2 vs 0.7 muda drasticamente a disposição do modelo em "arriscar" respostas.

---

## 7.10. Sprint 8.3.2 — Chatbot IA no Telegram

**Data:** 2026-03-20
**PR:** #409 | **Commit:** `bc59836`
**Motivação:** Validado em produção (web) no mesmo dia → estender para Telegram (sugestão 7.7)

### O que foi implementado

#### server/bot/services/chatbotServerService.js (NOVO)
- `fetchPatientData(userId)` — Supabase: medicines + protocols + logs (filtro timezone) + stock
- `buildServerContext()` — mesmo formato do web (com `active_ingredient` + `therapeutic_class`)
- `validateServerMessage()` — safetyGuard patterns (5 regex)
- `addServerDisclaimer()` — disclaimer médico condicional
- Rate limiting em memória (Map): 30 msg/hora/userId
- Histórico por userId (Map): máx 10 mensagens
- Groq SDK direto: `temperature: 0.2, top_p: 1.0` (anti-alucinação)

#### server/bot/commands/chatbot.js (NOVO)
- `handleChatbotMessage(bot, msg)` para `bot.on('message')`
- Graceful degradation: sem GROQ_API_KEY, usuário não vinculado, erros Groq

#### server/index.js (MODIFICADO)
- `bot.on('message', (msg) => handleChatbotMessage(bot, msg))`

#### server/package.json (MODIFICADO)
- `groq-sdk ^1.1.1`

### Quality Gates
- ✅ 539/539 testes passando
- ✅ Lint: zero erros
- ✅ Graceful degradation em todos os caminhos
- ✅ Contexto idêntico ao canal web (anti-alucinação garantido)

---

## 8. Sprint 8.4 — Base ANVISA Interacoes Medicamentosas (13 SP)

### F8.2: JSON Seed + Interaction Service + UI Alerts

| Campo | Valor |
|-------|-------|
| **Criar** | `src/features/interactions/data/interactions.json` |
| **Criar** | `src/features/interactions/services/interactionService.js` |
| **Criar** | `src/features/interactions/services/severityClassifier.js` |
| **Criar** | `src/features/interactions/components/InteractionAlert.jsx` |
| **Criar** | `src/features/interactions/components/InteractionBadge.jsx` |
| **Testar** | `src/features/interactions/__tests__/interactionService.test.js` |
| **Testar** | `src/features/interactions/__tests__/severityClassifier.test.js` |
| **Modificar** | `src/features/medications/components/MedicineForm.jsx` (verificar no submit) |
| **Modificar** | `vite.config.js` (opcional: chunk `feature-interactions`) |
| **Dependencias npm** | Nenhuma nova |

> ⚠️ **LAZY LOADING OBRIGATORIO (AP-B03, R-117):**
> `interactions.json` e todos os services/components de interacao DEVEM ser `import()` dinamico.
> Um import estatico de `interactions.json` (30-50KB) no MedicineForm ou no main bundle
> inviabiliza o trabalho de bundle optimization ja feito (M2: 989KB → 102kB).
> Padrao correto:
> ```javascript
> // Dentro do handler de submit do MedicineForm:
> const { checkInteractions } = await import('@features/interactions/services/interactionService')
> const result = checkInteractions(newMedicine, existingMedicines)
> ```

#### 8.1. interactions.json (seed)

```json
// src/features/interactions/data/interactions.json
// Seed de 50-80 interacoes de alta prevalencia no Brasil.
// Source: bulas ANVISA + literatura clinica aberta.
// Campo "activeIngredient" deve corresponder ao campo do medicineDatabase.json.
[
  {
    "pair": ["losartana", "ibuprofeno"],
    "severity": "moderada",
    "description": "AINEs podem reduzir efeito anti-hipertensivo e aumentar risco renal",
    "recommendation": "Monitorar pressao arterial. Preferir paracetamol para dor",
    "category": "anti-hipertensivo-aine"
  },
  {
    "pair": ["enalapril", "ibuprofeno"],
    "severity": "moderada",
    "description": "AINEs podem reduzir efeito anti-hipertensivo de IECA e aumentar risco renal",
    "recommendation": "Monitorar pressao arterial e funcao renal",
    "category": "anti-hipertensivo-aine"
  },
  {
    "pair": ["varfarina", "ibuprofeno"],
    "severity": "grave",
    "description": "AINEs aumentam risco de sangramento em pacientes anticoagulados",
    "recommendation": "Evitar uso concomitante. Consultar medico antes",
    "category": "anticoagulante-aine"
  },
  {
    "pair": ["sinvastatina", "genfibrozila"],
    "severity": "grave",
    "description": "Risco aumentado de rabdomiolise (lesao muscular grave)",
    "recommendation": "Combinacao contraindicada. Informar medico imediatamente",
    "category": "estatina-fibrato"
  },
  {
    "pair": ["metformina", "alcool"],
    "severity": "grave",
    "description": "Risco de acidose latica potencialmente fatal",
    "recommendation": "Evitar consumo de alcool durante tratamento com Metformina",
    "category": "antidiabetico-alcool"
  },
  {
    "pair": ["omeprazol", "clopidogrel"],
    "severity": "moderada",
    "description": "Omeprazol pode reduzir a eficacia do Clopidogrel",
    "recommendation": "Preferir pantoprazol como IBP alternativo",
    "category": "ipp-antiplaquetario"
  }
]
// ... mais 44-74 pares na versao final
```

> **NOTA:** O JSON completo deve ter 50-80 pares. A seed acima e um exemplo. O agente deve expandir com interacoes de alta prevalencia no Brasil (anti-hipertensivos, diabetes, cardiovascular, AINEs, anticoagulantes, etc).

#### 8.2. interactionService.js

```javascript
// src/features/interactions/services/interactionService.js

/**
 * Verifica interacoes medicamentosas entre medicamentos do paciente.
 * Carrega interactions.json via import() dinamico (AP-B03).
 *
 * @param {Object} params
 * @param {Object} params.newMedicine - Medicamento sendo cadastrado/ativado
 * @param {Array} params.existingMedicines - Medicamentos ja ativos
 * @returns {Promise<Array<{
 *   pair: [string, string],
 *   severity: 'leve'|'moderada'|'grave'|'contraindicada',
 *   description: string,
 *   recommendation: string,
 *   medicineNames: [string, string]
 * }>>}
 */
export async function checkInteractions({ newMedicine, existingMedicines }) {
  // Dynamic import — nunca top-level (AP-B03)
  const { default: interactionsData } = await import('../data/interactions.json')
  const { classifySeverity } = await import('./severityClassifier')

  const newIngredient = normalizeIngredient(
    newMedicine.activeIngredient || newMedicine.name
  )

  const found = []

  for (const existing of existingMedicines) {
    const existingIngredient = normalizeIngredient(
      existing.activeIngredient || existing.name
    )

    // Buscar match nos pares de interacao
    for (const interaction of interactionsData) {
      const [a, b] = interaction.pair.map(normalizeIngredient)

      const isMatch =
        (newIngredient.includes(a) && existingIngredient.includes(b)) ||
        (newIngredient.includes(b) && existingIngredient.includes(a))

      if (isMatch) {
        found.push({
          ...interaction,
          severity: classifySeverity(interaction.severity),
          medicineNames: [newMedicine.name, existing.name],
        })
      }
    }
  }

  // Ordenar por severidade (mais grave primeiro)
  const SEVERITY_ORDER = { contraindicada: 0, grave: 1, moderada: 2, leve: 3 }
  return found.sort((a, b) =>
    (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
  )
}

/**
 * Verifica interacoes entre TODOS os medicamentos ativos (para PDF/Modo Consulta).
 * @param {Array} medicines - Todos os medicamentos ativos
 * @returns {Promise<Array>}
 */
export async function checkAllInteractions(medicines) {
  const { default: interactionsData } = await import('../data/interactions.json')
  const { classifySeverity } = await import('./severityClassifier')

  const found = []
  const checked = new Set() // Evitar duplicatas

  for (let i = 0; i < medicines.length; i++) {
    for (let j = i + 1; j < medicines.length; j++) {
      const medA = medicines[i]
      const medB = medicines[j]
      const pairKey = [medA.id, medB.id].sort().join('-')
      if (checked.has(pairKey)) continue
      checked.add(pairKey)

      const ingA = normalizeIngredient(medA.activeIngredient || medA.name)
      const ingB = normalizeIngredient(medB.activeIngredient || medB.name)

      for (const interaction of interactionsData) {
        const [a, b] = interaction.pair.map(normalizeIngredient)
        if ((ingA.includes(a) && ingB.includes(b)) || (ingA.includes(b) && ingB.includes(a))) {
          found.push({
            ...interaction,
            severity: classifySeverity(interaction.severity),
            medicineNames: [medA.name, medB.name],
          })
        }
      }
    }
  }

  const SEVERITY_ORDER = { contraindicada: 0, grave: 1, moderada: 2, leve: 3 }
  return found.sort((a, b) =>
    (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
  )
}

/**
 * Normaliza nome de ingrediente para matching.
 */
function normalizeIngredient(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim()
}
```

#### 8.3. severityClassifier.js

```javascript
// src/features/interactions/services/severityClassifier.js

/**
 * Severidades de interacao medicamentosa.
 */
export const SEVERITIES = {
  LEVE: 'leve',
  MODERADA: 'moderada',
  GRAVE: 'grave',
  CONTRAINDICADA: 'contraindicada',
}

export const SEVERITY_COLORS = {
  leve: 'var(--color-info, #3b82f6)',        // Azul
  moderada: 'var(--color-warning, #f59e0b)',  // Amarelo
  grave: 'var(--color-error, #ef4444)',       // Vermelho
  contraindicada: '#7c3aed',                  // Roxo
}

export const SEVERITY_LABELS = {
  leve: 'Leve',
  moderada: 'Moderada',
  grave: 'Grave',
  contraindicada: 'Contraindicada',
}

export const SEVERITY_ICONS = {
  leve: 'ℹ️',
  moderada: '⚠️',
  grave: '🔴',
  contraindicada: '🚫',
}

/**
 * Classifica e valida severidade.
 * @param {string} severity
 * @returns {'leve'|'moderada'|'grave'|'contraindicada'}
 */
export function classifySeverity(severity) {
  const normalized = (severity || '').toLowerCase().trim()
  if (Object.values(SEVERITIES).includes(normalized)) return normalized
  return SEVERITIES.MODERADA // Default seguro
}
```

#### 8.4. InteractionAlert.jsx

```jsx
// src/features/interactions/components/InteractionAlert.jsx

import { motion } from 'framer-motion'
import { SEVERITY_COLORS, SEVERITY_LABELS, SEVERITY_ICONS } from '../services/severityClassifier'

/**
 * Alerta visual de interacao medicamentosa.
 * Lazy-loaded — aparece apenas quando interacao detectada.
 *
 * @param {Object} props
 * @param {Array} props.interactions - [{severity, description, recommendation, medicineNames}]
 * @param {Function} props.onDismiss
 */
export default function InteractionAlert({ interactions, onDismiss }) {
  if (!interactions || interactions.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        position: 'fixed', top: '16px', left: '16px', right: '16px',
        background: 'var(--color-surface)', borderRadius: '16px',
        padding: '16px', zIndex: 1200,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        border: `2px solid ${SEVERITY_COLORS[interactions[0].severity]}`,
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '12px',
      }}>
        <span style={{ fontWeight: 'bold', color: 'var(--color-text)', fontSize: '16px' }}>
          {SEVERITY_ICONS[interactions[0].severity]} Interacao Medicamentosa
        </span>
        <button onClick={onDismiss} style={{
          background: 'none', border: 'none', color: 'var(--color-text)',
          fontSize: '18px', cursor: 'pointer',
        }}>
          ✕
        </button>
      </div>

      {interactions.map((interaction, i) => (
        <div key={i} style={{
          marginBottom: i < interactions.length - 1 ? '12px' : 0,
          padding: '10px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '8px',
          borderLeft: `3px solid ${SEVERITY_COLORS[interaction.severity]}`,
        }}>
          <div style={{
            fontSize: '13px', fontWeight: 'bold',
            color: SEVERITY_COLORS[interaction.severity],
            marginBottom: '4px',
          }}>
            {SEVERITY_LABELS[interaction.severity]} — {interaction.medicineNames.join(' + ')}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text)', marginBottom: '4px' }}>
            {interaction.description}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            {interaction.recommendation}
          </div>
        </div>
      ))}

      <div style={{
        marginTop: '12px', fontSize: '11px',
        color: 'var(--color-text-secondary)', fontStyle: 'italic',
      }}>
        Base parcial — consulte seu farmaceutico para lista completa.
      </div>
    </motion.div>
  )
}
```

#### 8.5. Integracao no MedicineForm.jsx

```javascript
// No handler de submit do MedicineForm (ou no hook que chama o submit):
const handleSaveMedicine = async (medicineData) => {
  // 1. Salvar medicamento normalmente
  const saved = await medicineService.create(medicineData)

  // 2. Verificar interacoes (dynamic import — AP-B03)
  try {
    const { checkInteractions } = await import(
      '@features/interactions/services/interactionService'
    )
    const interactions = await checkInteractions({
      newMedicine: { ...medicineData, ...saved },
      existingMedicines: medicines.filter(m => m.id !== saved.id),
    })

    if (interactions.length > 0) {
      setDetectedInteractions(interactions) // State para mostrar InteractionAlert
    }
  } catch (error) {
    // Silently fail — interacoes sao complementares, nao bloqueantes
    console.warn('[interactions] Erro ao verificar:', error.message)
  }
}
```

#### 8.6. Momentos de Verificacao

1. **Cadastro de novo medicamento** → `checkInteractions()` no submit do MedicineForm
2. **Ativacao de protocolo pausado** → `checkInteractions()` ao alterar `active: true`
3. **Geracao de PDF / Modo Consulta** → `checkAllInteractions()` para secao dedicada
   - Integrar no `pdfGeneratorService.js` (similar a INT-01 de Sprint 6.3)

#### 8.7. Cenarios de Teste

```javascript
describe('interactionService', () => {
  afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

  describe('checkInteractions', () => {
    it('detecta interacao Losartana + Ibuprofeno', () => {})
    it('detecta interacao bidirecional (A+B == B+A)', () => {})
    it('normaliza acentos e case', () => {})
    it('nao detecta falso positivo para meds sem interacao', () => {})
    it('ordena por severidade (grave primeiro)', () => {})
    it('retorna array vazio sem interacoes', () => {})
    it('lida com activeIngredient ausente (usa nome)', () => {})
  })

  describe('checkAllInteractions', () => {
    it('verifica todos os pares N*(N-1)/2', () => {})
    it('evita duplicatas (par A-B nao repete como B-A)', () => {})
    it('retorna array vazio com <2 medicamentos', () => {})
  })
})

describe('severityClassifier', () => {
  afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

  it('classifica severidades validas', () => {})
  it('retorna moderada como default para valores invalidos', () => {})
  it('normaliza case e espacos', () => {})
})

describe('InteractionAlert', () => {
  afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

  it('nao renderiza sem interacoes', () => {})
  it('mostra alerta com cor da severidade', () => {})
  it('exibe disclaimer "base parcial"', () => {})
  it('chama onDismiss ao fechar', () => {})
  it('mostra multiplas interacoes', () => {})
})
```

### Quality Gate Sprint 8.4

- [ ] `interactions.json` com 50-80 pares de alta prevalencia
- [ ] `interactionService.js` com matching bidirecional + normalizacao
- [ ] `severityClassifier.js` com 4 niveis
- [ ] `InteractionAlert.jsx` lazy-loaded com cores por severidade
- [ ] `InteractionBadge.jsx` para card do medicamento (badge discreto)
- [ ] Integracao no MedicineForm (submit handler com dynamic import)
- [ ] Disclaimer "base parcial" em todo alerta
- [ ] interactions.json lazy-loaded (dynamic import, NUNCA import estatico)
- [ ] Zero impacto no main bundle (verificar com `npm run build`)
- [ ] Testes >= 90% cobertura
- [ ] `npm run validate:agent` passa
- [ ] Branch: `feature/fase-8/sprint-4-interactions`
- [ ] Lighthouse Performance mantido >= 90

---

## 9. Status de Entrega

| Sprint | Feature | SP | Status | Commit | Data | Quality Gates |
|--------|---------|-----|--------|--------|------|---------------|
| 8.1 | V01 — Registro por Voz | 13 | ⬚ PENDENTE | — | — | — |
| 8.2 | V02 — Resumo por Voz | 5 | ⬚ PENDENTE | — | — | — |
| 8.3 | F8.1 — Chatbot IA | 13 | ✅ ENTREGUE | 5a708ad (#407) | 2026-03-20 | 539/539 testes ✅ |
| 8.3.1 | Bugfix: Hallucinations (Contexto Farmacológico) | — | ✅ MERGED | 1e47cfb (#408) | 2026-03-20 | 33/33 testes ✅ |
| 8.4 | F8.2 — Interacoes ANVISA | 13 | ⬚ PENDENTE | — | — | — |

**Total:** 13/44 SP entregues (30%) + bugfix hallucinations

---

## 10. Env Vars Necessarias

| Variavel | Sprint | Obrigatoria | Descricao |
|----------|--------|-------------|-----------|
| `GROQ_API_KEY` | 8.3 | Sim (para chatbot) | API key do Groq (free tier: 30 req/min) |
| `GROQ_MODEL` | 8.3 | Nao (default: `llama-3.3-70b-versatile`) | Modelo Groq a usar |

---

## 11. Impacto no Bundle (Projecao)

| Chunk | Tamanho Estimado | Carregamento |
|-------|------------------|--------------|
| `feature-voice` (V01+V02) | ~15KB gzip | Lazy (apos mount, se suportado) |
| `feature-chatbot` (F8.1) | ~20KB gzip | Lazy (ao abrir drawer) |
| `feature-interactions` (F8.2) | ~30-50KB gzip (JSON + services) | Dynamic import (no submit) |
| `groq-sdk` (server-side) | ~20KB | Nunca no client bundle |
| **Total impacto main bundle** | **0 KB** | Tudo lazy-loaded |

**Regra:** Se `npm run build` mostrar aumento no main bundle, algo foi importado estaticamente — corrigir antes de PR.

---

## 12. Integracao com deliver-sprint

Cada sprint DEVE seguir o workflow da skill `/deliver-sprint`:

```
/deliver-sprint plans/EXEC_SPEC_FASE_8.md
```

**Fases da skill (7 passos):**

1. **Pre-Planning & Setup** — Ler spec, explorar codebase, criar branch
2. **Setup** — Verificar dependencias, aliases, budget serverless
3. **Implementation** — Schemas → Services → Components → Views → Tests → Styles
4. **Validation** — `npm run validate:agent` (10-min kill switch)
5. **Git** — Commits semanticos, atualizar `.memory/`
6. **Push & Review** — Criar PR, aguardar Gemini Code Assist
7. **Merge** — Apos aprovacao, merge --no-ff, deletar branch
8. **Documentation** — Atualizar este doc (status, commits, datas)

**Este EXEC_SPEC complementa a skill com:**
- Codigo de referencia detalhado (services, hooks, components)
- Quality gates especificos por sprint
- Dependencias e ordem de execucao
- Regras de performance (lazy loading, bundle impact)

---

## 13. Pos-Fase 8 — Atualizacoes Necessarias

Apos completar todos os 4 sprints:

1. **ROADMAP_v4.md** — Marcar Fase 8 como COMPLETA, atualizar versao para v4.1.0
2. **CLAUDE.md** — Adicionar features de Fase 8 na secao Estado Atual
3. **`.memory/journal/YYYY-WWW.md`** — Journal entry para cada sprint
4. **`.memory/rules.md`** — Novas regras descobertas (Web Speech API, Groq, etc.)
5. **`.memory/anti-patterns.md`** — Novos anti-patterns encontrados
6. **`vite.config.js`** — Confirmar chunks novos se adicionados
7. **`vercel.json`** — Confirmar rewrite para `/api/chatbot`

---

*Documento criado 20/03/2026.*
*Baseado em: `PHASE_8_SPEC.md` v1.1, `EXEC_SPEC_FASE_6.md` v2.1 (formato/estrutura).*
