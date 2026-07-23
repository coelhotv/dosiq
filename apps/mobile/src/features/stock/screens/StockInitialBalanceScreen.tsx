// StockInitialBalanceScreen — "Estoque inicial" (spec 044, F4b / T017).
//
// Coleta o saldo atual de cada medicamento ativo ANTES de ligar o FIFO (PO-3 — sem
// retro-consumo). 3 entradas convergem aqui, todas passando `source` para instrumentar
// o analytics no stockPreferenceService (F4b / T019):
//   - Settings (useStockToggle): OFF→ON de quem nunca teve estoque (neverHadStock)
//   - Onboarding: opção "também avisar quando acabando" (dívida da F3)
//   - Upsell (card do dashboard): outra sessão navega para esta mesma rota
//
// `source`/`onDone` chegam via props (uso direto, ex.: wrapper do onboarding) OU via
// route.params (uso como Stack.Screen comum) — props sempre vencem.
//
// Mock: plans/mocks_app_mobile/export/044-dose-only-mode/liga-estoque-saldo-inicial.png
// Copy §9 do SPEC_044_DOSE-ONLY_DECISOES (copiada, não reescrita).
// R-010: States → Memos → Effects → Handlers.

import { useCallback } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ChevronLeft, Pill } = LucideIcons as any
import LoadingState from '@shared/components/states/LoadingState'
import ErrorState from '@shared/components/states/ErrorState'
import EmptyState from '@shared/components/states/EmptyState'
import type { StockPreferenceSource } from '@profile/services/stockPreferenceService'
import { useStockInitialBalance, balanceHint } from '@stock/hooks/useStockInitialBalance'
import { useKeyboardVisible } from '@shared/hooks/useKeyboardVisible'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

interface StockInitialBalanceScreenProps {
  source?: StockPreferenceSource
  onDone?: () => void
}

export default function StockInitialBalanceScreen({
  source: sourceProp,
  onDone: onDoneProp,
}: StockInitialBalanceScreenProps = {}) {
  const navigation = useNavigation<any>()
  const route = useRoute()
  const routeParams = (route.params ?? {}) as { source?: StockPreferenceSource }

  // States
  const goBack = useCallback(() => navigation.goBack(), [navigation])
  const source: StockPreferenceSource = sourceProp ?? routeParams.source ?? 'settings'
  const onDone = onDoneProp ?? goBack
  const state = useStockInitialBalance(source, onDone)
  const insets = useSafeAreaInsets()
  const keyboardVisible = useKeyboardVisible()

  return (
    // Só `top` aqui: o inset de BAIXO é aplicado pelo rodapé, e só quando o teclado está
    // fechado (ver `footerPadBottom`). Deixar a SafeAreaView reservar a faixa inferior
    // permanentemente descolaria o rodapé do teclado quando ele sobe.
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* AppBar */}
      <View style={styles.header}>
        <Pressable
          onPress={state.cancel}
          style={styles.headerBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <ChevronLeft size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Estoque inicial</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* O rodapé fica DENTRO do KeyboardAvoidingView junto com a lista: fora dele, o teclado
          subiria por cima dos botões (e da última linha da lista).
          ⚠️ Android precisa de `behavior='height'` — NÃO `undefined`: o app roda com
          `edgeToEdgeEnabled` (app.config.js), e sob edge-to-edge o Android não redimensiona mais
          a janela, então o `adjustResize` do AndroidManifest vira letra morta e um KAV sem
          behavior não faz nada (a lista fica embaixo do teclado). É o mesmo behavior das telas
          que convivem com teclado de verdade — ChatScreen e DoseRegisterModal. */}
      {/* offset ZERO: o `keyboardVerticalOffset={60}` dos formulários compensa a altura do header
          de NAVEGAÇÃO — e esta tela não tem um (o AppBar é próprio, já dentro da SafeAreaView).
          Copiar o 60 daqui virava folga morta: o rodapé descolava do teclado. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      {state.loading ? (
        <LoadingState message="Carregando seus medicamentos…" />
      ) : state.loadError ? (
        <ErrorState message={state.loadError} onRetry={state.reload} />
      ) : (
        <ScrollView
          // `flex: 1` no ScrollView (não só no contentContainer): dentro do KeyboardAvoidingView
          // ele cresceria com o conteúdo e empurraria o rodapé para fora da tela.
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.subtitle}>
            Informe a quantidade atual que você tem de cada remédio. Pode pular os que não quiser contar agora.
          </Text>

          {state.medicines && state.medicines.length === 0 ? (
            <EmptyState
              icon="💊"
              message="Você ainda não tem medicamentos ativos. Pode ativar o controle de estoque mesmo assim — os saldos entram quando você cadastrar."
            />
          ) : (
            <View style={styles.list}>
              {state.medicines?.map((medicine) => {
                const item = state.getItem(medicine.id)
                const hint = balanceHint(medicine, item.value)
                return item.skipped ? (
                  <View key={medicine.id} style={[styles.card, styles.cardSkipped]}>
                    <View style={styles.rowTop}>
                      <View style={styles.icon}>
                        <Pill size={18} color={colors.brand.primary} strokeWidth={1.75} />
                      </View>
                      <View style={styles.rowText}>
                        <View style={styles.nameRow}>
                          <Text style={styles.name} numberOfLines={1}>
                            {medicine.name}
                          </Text>
                          {medicine.dosePill ? (
                            <View style={styles.dosePill}>
                              <Text style={styles.dosePillText}>{medicine.dosePill}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.skippedCaption}>
                          Pulado · sem alerta até a primeira compra
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => state.unskip(medicine.id)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Informar saldo de ${medicine.name}`}
                      >
                        <Text style={styles.linkText}>Informar</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View key={medicine.id} style={styles.card}>
                    <View style={styles.rowTop}>
                      <View style={styles.icon}>
                        <Pill size={18} color={colors.brand.primary} strokeWidth={1.75} />
                      </View>
                      <View style={styles.rowText}>
                        <View style={styles.nameRow}>
                          <Text style={styles.name} numberOfLines={1}>
                            {medicine.name}
                          </Text>
                          {medicine.dosePill ? (
                            <View style={styles.dosePill}>
                              <Text style={styles.dosePillText}>{medicine.dosePill}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      {/* Coluna do input: o hint é IRMÃO da caixa, não filho do card — assim ele
                          fica ancorado ao número que explica, alinhado pela borda direita. */}
                      <View style={styles.inputCol}>
                        <View style={styles.inputBox}>
                          <TextInput
                            style={styles.input}
                            value={item.value}
                            onChangeText={(raw) => state.setValue(medicine.id, raw)}
                            placeholder="0"
                            placeholderTextColor={colors.text.muted}
                            keyboardType="decimal-pad"
                            maxLength={6}
                            accessibilityLabel={`Saldo atual de ${medicine.name}, em ${
                              medicine.stockUnit === 'mL' ? 'mililitros' : 'unidades'
                            }`}
                          />
                          {/* Unidade REAL do saldo — a mesma que o cadastro de compra pede
                              (líquido persiste em ml). Literal "un." aqui pediria a quantidade
                              numa unidade e gravaria em outra. */}
                          <Text style={styles.inputSuffix}>{medicine.stockUnit}</Text>
                        </View>

                        {/* Equivalência — mesma frase da compra e do modal de dose (consistência
                            de vocabulário: a mesma pergunta tem a mesma resposta em todas as
                            telas). */}
                        {hint ? (
                          <Text style={styles.hint} numberOfLines={1}>
                            ✨ {hint}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <Pressable
                      onPress={() => state.skip(medicine.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Não quero contar ${medicine.name}`}
                    >
                      <Text style={styles.linkText}>Não quero contar este</Text>
                    </Pressable>
                  </View>
                )
              })}
            </View>
          )}

          {state.submitError ? <Text style={styles.submitError}>{state.submitError}</Text> : null}
        </ScrollView>
      )}

      {/* Rodapé fixo: Cancelar (flex 1) + Ativar estoque (flex 2, primary).
          Teclado FECHADO → reserva a barra do sistema (Android) / home indicator (iOS), senão os
          botões ficam por baixo deles. Teclado ABERTO → essa faixa não existe (o teclado ocupa o
          lugar dela) e manter o inset deixaria o rodapé boiando acima do teclado. */}
      <View style={[styles.footer, { paddingBottom: keyboardVisible ? spacing[3] : insets.bottom + spacing[3] }]}>
        <Pressable
          style={styles.secondaryButton}
          onPress={state.cancel}
          disabled={state.submitting}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryLabel}>Cancelar</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, (state.submitting || state.loading) && styles.buttonDisabled]}
          onPress={state.activate}
          disabled={state.submitting || state.loading}
          accessibilityRole="button"
        >
          <Text style={styles.primaryLabel}>{state.submitting ? 'Ativando…' : 'Ativar estoque'}</Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: typography.fontFamily.bold || 'System',
    fontWeight: '800',
    color: colors.text.primary,
    textAlign: 'center',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    // Folga generosa no fim: com o teclado aberto, o último remédio da lista precisa CABER
    // acima dele — senão não dá para ver o que se digita nem rolar para "levantar" os de baixo.
    paddingBottom: spacing[10] || 40,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.regular || 'System',
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing[5],
  },
  list: {
    gap: spacing[3],
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg || 16,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[4],
    gap: spacing[3],
  },
  cardSkipped: {
    opacity: 0.55,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md || 12,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 16,
    fontFamily: typography.fontFamily.medium || 'System',
    fontWeight: '700',
    color: colors.text.primary,
  },
  dosePill: {
    backgroundColor: colors.neutral[100] || colors.bg.screen,
    borderRadius: borderRadius.full || 999,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  dosePillText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium || 'System',
    color: colors.text.secondary,
  },
  skippedCaption: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  inputBox: {
    minWidth: 96,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md || 12,
    backgroundColor: colors.bg.screen,
  },
  input: {
    fontSize: 18,
    fontFamily: typography.fontFamily.bold || 'System',
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'right',
    minWidth: 32,
    padding: 0,
  },
  inputSuffix: {
    fontSize: 13,
    color: colors.text.muted,
  },
  linkText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium || 'System',
    fontWeight: '600',
    color: colors.brand.primary,
  },
  // Coluna do input (caixa + hint). `flexShrink: 0` protege a caixa numérica: quem cede espaço
  // quando o nome do remédio é longo é o texto, nunca o alvo de toque.
  inputCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  // Colado na caixa que explica e alinhado pela MESMA borda direita — é apoio à leitura do
  // número, não uma ação (por isso discreto, sem cor de link).
  hint: {
    marginTop: 4,
    fontSize: 11.5,
    lineHeight: 14,
    textAlign: 'right',
    fontFamily: typography.fontFamily.regular || 'System',
    color: colors.text.secondary,
  },
  submitError: {
    marginTop: spacing[4],
    fontSize: 13,
    color: colors.status.error,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    // Nunca some nem encolhe: é a única saída da tela (Cancelar) e a ação principal.
    flexShrink: 0,
    backgroundColor: colors.bg.screen,
  },
  secondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: borderRadius.lg || 16,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 15,
    fontFamily: typography.fontFamily.medium || 'System',
    fontWeight: '600',
    color: colors.text.primary,
  },
  primaryButton: {
    flex: 2,
    height: 50,
    borderRadius: borderRadius.lg || 16,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryLabel: {
    fontSize: 15,
    fontFamily: typography.fontFamily.medium || 'System',
    fontWeight: '700',
    color: colors.text.inverse,
  },
})
