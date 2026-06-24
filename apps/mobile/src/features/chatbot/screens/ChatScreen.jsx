// ChatScreen.jsx — Chat IA full-screen nativo (spec 015 onda 2; PO-D2/PO-3).
//
// Full-screen (stack), FlatList invertido, bolhas assimétricas (ChatBubble), disclaimer
// fixo no topo, chips de sugestão acima do input, loading branded "Iniciando IA do dosiq…"
// (fetch-on-open, FR-012), offline desabilita envio + banner. Teclado: KeyboardAvoidingView
// (AP-174/R-233). Segurança server-side (AP-237) — cliente só envia contexto+mensagem.

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, X, Send, Trash2, BotMessageSquare } from 'lucide-react-native'
import NetInfo from '@react-native-community/netinfo'
import { colors, spacing } from '@shared/styles/tokens'
import { lightTap } from '@shared/utils/haptics'
import ChatBubble from '@features/chatbot/components/ChatBubble'
import { buildMobilePatientContext, sendChatMessage } from '../services/chatbotService'
import { loadHistory, saveHistory, clearHistory } from '../services/chatHistoryStore'
import { CHATBOT_DISCLAIMER, CHATBOT_QUICK_SUGGESTIONS, createWelcomeMessage } from '../config/chatbotConfig'

/** Bolha "digitando" com pontos pulsando (1→2→3→repete). Reusa o estilo do ChatBubble. */
function TypingBubble() {
  const [dots, setDots] = useState(1)
  useEffect(() => {
    const id = setInterval(() => setDots((n) => (n >= 3 ? 1 : n + 1)), 400)
    return () => clearInterval(id)
  }, [])
  return <ChatBubble role="assistant" content={'.'.repeat(dots)} />
}

/** Header do chat: voltar · branding (BotMessageSquare + título) · limpar/fechar. */
function ChatHeader({ onReset, onClose }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={hit} accessibilityLabel="Voltar">
        <ChevronLeft size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <View style={styles.titleWrap}>
        <BotMessageSquare size={20} color={colors.brand.primary} strokeWidth={1.75} />
        <Text style={styles.title}>Assistente Dosiq IA</Text>
      </View>
      <View style={styles.headerActions}>
        <TouchableOpacity onPress={onReset} style={styles.iconBtn} hitSlop={hit} accessibilityLabel="Limpar conversa">
          <Trash2 size={20} color={colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={hit} accessibilityLabel="Fechar">
          <X size={22} color={colors.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function ChatScreen({ navigation }) {
  // 1. States
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [initializing, setInitializing] = useState(true) // fetch-on-open (FR-012)
  const [sending, setSending] = useState(false)
  const [offline, setOffline] = useState(false)

  // Refs
  const contextRef = useRef(null) // patientContext cacheado por sessão de chat

  // 2. Memos
  const reversed = useMemo(() => [...messages].reverse(), [messages])
  const hasUserMsg = useMemo(() => messages.some((m) => m.role === 'user'), [messages])
  const canSend = input.trim().length > 0 && !sending && !offline && !initializing

  // 3. Effects
  // 3a. Monitor de conectividade
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(!(state.isConnected && state.isInternetReachable !== false))
    })
    return unsub
  }, [])

  // 3b. Fetch-on-open: carrega histórico + monta contexto via core (loading branded)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const persisted = await loadHistory()
      if (!alive) return
      setMessages(persisted.length ? persisted : [createWelcomeMessage(Date.now())])
      try {
        contextRef.current = await buildMobilePatientContext()
      } catch {
        contextRef.current = '' // degrada: chat ainda funciona, server lida com contexto vazio
      }
      if (alive) setInitializing(false)
    })()
    return () => { alive = false }
  }, [])

  // 3c. Persistir histórico a cada mudança (best-effort)
  useEffect(() => {
    if (!initializing) saveHistory(messages)
  }, [messages, initializing])

  // 4. Handlers
  const handleClose = useCallback(() => navigation?.goBack(), [navigation])

  // Reseta o chat ao estado original: limpa histórico, recompõe a welcome e RE-BUSCA o
  // contexto do paciente (paridade com o trash-2 da web) — útil p/ começar conversa limpa
  // e p/ recarregar o payload após mudanças nos dados.
  const handleReset = useCallback(async () => {
    lightTap()
    await clearHistory()
    setInput('')
    setMessages([createWelcomeMessage(Date.now())])
    setInitializing(true)
    try {
      contextRef.current = await buildMobilePatientContext()
    } catch {
      contextRef.current = ''
    }
    setInitializing(false)
  }, [])

  const handleSend = useCallback(async (text) => {
    const message = (text ?? input).trim()
    if (!message || sending || offline) return
    lightTap()
    setInput('')
    const userMsg = { role: 'user', content: message, timestamp: Date.now() }
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, userMsg])
    setSending(true)
    const { response } = await sendChatMessage({
      message,
      history,
      patientContext: contextRef.current ?? '',
    })
    setMessages((prev) => [...prev, { role: 'assistant', content: response, timestamp: Date.now() }])
    setSending(false)
  }, [input, sending, offline, messages])

  // Render
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ChatHeader onReset={handleReset} onClose={handleClose} />

      {offline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Sem conexão — o envio está desabilitado.</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {initializing ? (
          <View style={styles.initBox}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
            <Text style={styles.initText}>Iniciando IA do Dosiq…</Text>
          </View>
        ) : (
          <FlatList
            data={reversed}
            inverted
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => <ChatBubble role={item.role} content={item.content} />}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={sending ? <TypingBubble /> : null}
            // Lista invertida: o Footer renderiza no TOPO visual (acima da 1ª mensagem) e
            // rola junto com as bolhas — disclaimer deixa de ocupar espaço fixo (telas pequenas).
            ListFooterComponent={
              <View style={styles.disclaimer}>
                <Text style={styles.disclaimerText}>⚠ {CHATBOT_DISCLAIMER}</Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* Chips de sugestão (estado inicial) */}
        {!initializing && !hasUserMsg && (
          <View style={styles.chips}>
            {CHATBOT_QUICK_SUGGESTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.chip}
                onPress={() => handleSend(s)}
                disabled={offline || sending}
                accessibilityLabel={`Sugestão: ${s}`}
              >
                <Text style={styles.chipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Pergunte ao assistente…"
            placeholderTextColor={colors.text.muted}
            maxLength={500}
            editable={!offline && !initializing}
            multiline
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!canSend}
            accessibilityLabel="Enviar mensagem"
          >
            <Send size={20} color={colors.text.inverse} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const hit = { top: 8, bottom: 8, left: 8, right: 8 }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.screen },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.bg.card,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  title: { fontSize: 17, fontWeight: '700', color: colors.text.primary },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  disclaimer: {
    backgroundColor: colors.status.warningLight,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 8,
    marginHorizontal: spacing[3],
    marginBottom: spacing[2],
  },
  disclaimerText: { fontSize: 12, color: colors.status.warning, lineHeight: 16 },
  offlineBanner: { backgroundColor: colors.status.errorLight, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  offlineText: { fontSize: 12, color: colors.status.error },
  initBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  initText: { fontSize: 15, color: colors.text.secondary },
  listContent: { paddingVertical: spacing[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], paddingHorizontal: spacing[4], paddingBottom: spacing[2] },
  chip: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 16,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  chipText: { fontSize: 13, color: colors.brand.primary, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.bg.card,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    backgroundColor: colors.bg.screen,
    borderRadius: 22,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    fontSize: 15,
    color: colors.text.primary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
})
