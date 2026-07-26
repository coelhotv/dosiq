// VersionGateOverlay.tsx — overlay full-screen não-dismissível do kill switch (spec 051-A FR-018)
//
// O guard OBEDECE o resolver puro do core — não decide por conta (AP-303). Renderiza apenas quando
// `useVersionGate()` devolve `blocked: true`; qualquer outra decisão renderiza `null` (o app segue
// normal, sem splash bloqueante).
//
// 🔴 Obrigação clínica > bloqueio de update. Se `AlarmFullScreen` for a rota atual
// (`useAlarmScreenActive`), este overlay CEDE — renderiza `null` mesmo com `blocked: true`. A
// decisão pura do resolver não muda (o app continua "bloqueado" no sentido de update pendente);
// só a UI escolhe não desenhar por cima do alerta de dose crítica. Mesmo que os botões de ação do
// alarme falhem por bug de banco/registro, o aviso VISUAL da dose tem que aparecer — negar isso é
// pior que o próprio binário desatualizado.
//
// Conteúdo remoto (`message`, `storeUrl`) é NÃO-CONFIÁVEL (RC-SEC-2 S-8/S-9, PO-SEC-6):
//  - `message` é `<Text>` puro, com cap — nunca markdown/HTML/link tocável.
//  - `storeUrl` só abre se estiver na allowlist (`isAllowedStoreUrl`); fora dela, cai para a
//    constante compilada por plataforma (nunca fica inerte).
//  - O link para https://dosiq.app é CONSTANTE COMPILADA — nunca vem da linha do gate (D7/D9): a
//    saída de emergência não pode ser removível pela mesma config que aplica o bloqueio.

import { View, Text, Image, Pressable, StyleSheet, Linking, Platform } from 'react-native'
import { isAllowedStoreUrl, GATE_MESSAGE_MAX_LENGTH } from '@dosiq/core'
import { useVersionGate } from './useVersionGate'
import { useAlarmScreenActive } from './useAlarmScreenActive'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

// Mesmo lockup usado no AlarmFullScreen (branding no topo, reconhecimento imediato) — versão
// mono-black porque este overlay é full-screen claro (`colors.bg.screen`), sem o fundo escuro do
// alarme. Reforça "tela oficial do app", não "alerta genérico de sistema".
const BRAND_MARK = require('../../../assets/dosiq-full-mono-black.png')

const DEFAULT_MESSAGE = 'É necessária uma atualização do app para continuar usando o dosiq com segurança.'

// Saída honesta do kill switch (spec 051-A FR-018 / ADR-091 D7): CONSTANTE COMPILADA, nunca vem
// da linha do gate (2º vetor do S-8 + saída removível pela config que bloqueia).
const DOSIQ_WEB_URL = 'https://dosiq.app'

/**
 * Lojas por plataforma — fallback COMPILADO quando `store_url` remoto está ausente ou fora da
 * allowlist (S-8). Prefixos batem `STORE_URL_ALLOWLIST` (`@dosiq/core`).
 * ⚠️ Android é o link direto e funcional (`androidPackage` — app.config.js). iOS aponta para a
 * busca até o app publicar e o PO preencher o Apple App ID real aqui.
 */
const STORE_FALLBACK_URLS = {
  ios: 'https://apps.apple.com/br/app/dosiq-inteligencia-em-doses/id6762740948',
  android: 'https://play.google.com/store/apps/details?id=com.coelhotv.dosiq',
} as const

export function VersionGateOverlay() {
  const decision = useVersionGate()
  const alarmActive = useAlarmScreenActive()

  if (decision.blocked === false) return null
  if (alarmActive) return null // obrigação clínica cede o topo da tela ao alarme (ver nota acima)

  const storeUrl = isAllowedStoreUrl(decision.storeUrl)
    ? (decision.storeUrl as string)
    : STORE_FALLBACK_URLS[Platform.OS === 'android' ? 'android' : 'ios']

  const message = (decision.message ?? DEFAULT_MESSAGE).slice(0, GATE_MESSAGE_MAX_LENGTH)

  return (
    <View style={styles.overlay}>
      {/* Branding no topo — mesmo lockup do AlarmFullScreen. É a 1ª coisa que o usuário vê: sinal
          imediato de "tela oficial do dosiq", não alerta genérico de sistema/vírus. */}
      <View style={styles.brandRow}>
        <Image source={BRAND_MARK} style={styles.brandImg} resizeMode="contain" />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Atualize seu app para continuar</Text>
        <Text style={styles.message}>{message}</Text>
        <Pressable style={styles.button} onPress={() => { Linking.openURL(storeUrl).catch(() => {}) }}>
          <Text style={styles.buttonText}>Atualizar</Text>
        </Pressable>
      </View>

      {/* Card separado (não empilhado como texto corrido) — demota a saída web de "mais um aviso"
          para "informação de apoio", mesmo tom calmo de uma tela de manutenção oficial. */}
      <View style={styles.webCard}>
        <Text style={styles.webHint}>
          Enquanto isso, seus dados de saúde continuam sempre acessíveis pelo navegador:
        </Text>
        <Pressable onPress={() => { Linking.openURL(DOSIQ_WEB_URL).catch(() => {}) }}>
          <Text style={styles.webLink}>{DOSIQ_WEB_URL}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    backgroundColor: colors.bg.brand,
    paddingTop: spacing[12],
    paddingBottom: spacing[8],
    paddingHorizontal: spacing[6],
  },
  brandRow: {
    paddingTop: spacing[12],
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandImg: {
    width: 200,
    height: 100, // PNG 900x450 (2:1) — mesma proporção do lockup do AlarmFullScreen
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text.primary,
  },
  message: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 15,
    textAlign: 'center',
    color: colors.text.secondary,
  },
  button: {
    marginTop: spacing[3],
    alignSelf: 'stretch',
    backgroundColor: colors.brand.primary,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: typography.fontFamily.medium,
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  webCard: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    padding: spacing[4],
    gap: spacing[2],
  },
  webHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    textAlign: 'center',
    color: colors.text.muted,
  },
  webLink: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 14,
    textAlign: 'center',
    color: colors.brand.primary,
    textDecorationLine: 'underline',
  },
})
